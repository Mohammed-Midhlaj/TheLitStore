const User = require("../../models/userSchema");
const Order = require('../../models/orderSchema');
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");
const Coupon = require('../../models/couponSchema');

let razorpay;
try {
    razorpay = require('../../config/razorpay');
} catch (error) {
    console.log('Razorpay configuration not found');
}

// ---Check out page---

const loadCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        let totalPrice = cart.items.reduce((acc, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            return acc + (price * quantity);
        }, 0);

        const deliveryCharge = 149;
        const finalAmount = totalPrice + deliveryCharge;

        const addresses = await Address.find({ userId });

        // Fetch available coupons
        const availableCoupons = await Coupon.find({
            isListed: true,
            expireOn: { $gt: new Date() }
        });

        // Get user's used coupons
        const usedCoupons = await Order.find({
            user: userId,
            couponCode: { $exists: true, $ne: null }
        }).distinct('couponCode');

        // Filter out used coupons
        const validCoupons = availableCoupons.filter(coupon => !usedCoupons.includes(coupon.name));

        // Defensive: filter out any expired coupons (in case of clock skew)
        const now = new Date();
        const filteredValidCoupons = validCoupons.filter(coupon => new Date(coupon.expireOn) > now);

        res.render("checkout", {
            user,
            cartItems: cart.items,
            totalPrice,
            deliveryCharge,
            finalAmount,
            addresses,
            validCoupons: filteredValidCoupons
        });

    } catch (error) {
        console.log("Error loading checkout page: ", error);
        res.redirect('/pageNotFound')
    }
}

// ---OrderPlace---

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        // Accept both paymentMethod and payment from req.body
        const { billingAddress, couponCode } = req.body;
        const paymentMethod = req.body.paymentMethod || req.body.payment;

        // Find cart (try both user and userId fields)
        let cart = await Cart.findOne({ user: userId }).populate('items.productId');
        if (!cart) {
            cart = await Cart.findOne({ userId: userId }).populate('items.productId');
        }

        // Find the address as a subdocument
        const addressDoc = await Address.findOne({ userId: userId });
        let selectedAddress = null;
        if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
            selectedAddress = addressDoc.address.find(addr => addr._id.toString() === billingAddress);
        }

        if (!cart || !selectedAddress) {
            return res.status(400).json({ 
                status: false, 
                message: 'Cart or address not found' 
            });
        }

        // Defensive: check for empty cart
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).json({ status: false, message: 'Your cart is empty.' });
        }

        // Calculate totals
        let subtotal = 0;
        let discount = 0;
        let couponDiscount = 0;

        for (const item of cart.items) {
            const product = item.productId;
            if (!product || (typeof product.salePrice === 'undefined' && typeof product.regularPrice === 'undefined')) {
                console.log('DEBUG product or price missing:', product);
                return res.status(400).json({ status: false, message: 'Product or price missing in cart.' });
            }
            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    status: false, 
                    message: `Insufficient stock for ${product.name || product.productName}` 
                });
            }
            const price = typeof product.salePrice !== 'undefined' ? product.salePrice : product.regularPrice;
            subtotal += Number(price) * Number(item.quantity);
        }

        // Debug log for calculation
        console.log('DEBUG subtotal:', subtotal);

        // Apply coupon if provided
        if (couponCode) {
            const coupon = await Coupon.findOne({ 
                name: couponCode,
                isListed: true,
                expireOn: { $gt: new Date() }
            });
            if (coupon && subtotal >= coupon.minimumPrice) {
                couponDiscount = Number(coupon.offerPrice);
                discount += couponDiscount;
            }
        }

        // Calculate shipping
        const shipping = subtotal > 1000 ? 0 : 149;
        const finalAmount = subtotal + shipping - discount;

        // Debug log for all calculation variables
        console.log('DEBUG subtotal:', subtotal, 'shipping:', shipping, 'discount:', discount, 'finalAmount:', finalAmount);

        // Defensive: ensure all numbers
        if (isNaN(subtotal) || isNaN(shipping) || isNaN(discount) || isNaN(finalAmount)) {
            return res.status(500).json({ status: false, message: 'Order calculation error.' });
        }

        // Create order object (not saved yet)
        const orderDetails = {
            user: userId,
            orderedItem: cart.items.map(item => {
                const product = item.productId;
                const price = typeof product.salePrice !== 'undefined' ? product.salePrice : product.regularPrice;
                return {
                    product: product._id,
                    quantity: item.quantity,
                    price: price
                };
            }),
            billingAddress: selectedAddress,
            paymentMethod: paymentMethod,
            totalPrice: subtotal,
            shipping: shipping,
            discount: discount,
            couponDiscount: couponDiscount,
            couponCode: couponCode || null,
            finalAmount: finalAmount,
            status: 'Pending',
            paymentStatus: 'Pending'
        };

        // For COD, save the order immediately
        if (paymentMethod === 'cod') {
            const order = new Order(orderDetails);
            await order.save();
            // For COD, clear cart and redirect to success page
            console.log('Clearing cart for COD order, user ID:', userId);
            const cartUpdateResult = await Cart.findOneAndUpdate(
                { userId: userId },
                { $set: { items: [] } },
                { new: true }
            );
            console.log('Cart cleared for COD:', cartUpdateResult ? 'Yes' : 'No');
            return res.redirect(`/order-success/${order._id}`);
        }

        // For Wallet payment
        if (paymentMethod === 'wallet') {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ status: false, message: 'User not found' });
            }
            if (user.walletBalance < finalAmount) {
                return res.status(400).json({ status: false, message: 'Insufficient wallet balance' });
            }
            // Deduct from wallet and add to history
            user.walletBalance -= finalAmount;
            user.walletHistory.push({
                amount: finalAmount,
                type: 'debit',
                description: 'Order payment',
                date: new Date()
            });
            await user.save();
            // Mark order as paid
            orderDetails.paymentStatus = 'Completed';
            const order = new Order(orderDetails);
            await order.save();
            // Clear cart
            console.log('Clearing cart for wallet payment, user ID:', userId);
            const cartUpdateResult = await Cart.findOneAndUpdate(
                { userId: userId },
                { $set: { items: [] } },
                { new: true }
            );
            console.log('Cart cleared for wallet:', cartUpdateResult ? 'Yes' : 'No');
            return res.redirect(`/order-success/${order._id}`);
        }

        // For Razorpay, do not save the order yet
        if (paymentMethod === 'razorpay') {
            if (!razorpay) {
                return res.status(400).json({
                    status: false,
                    message: 'Razorpay payment is not configured'
                });
            }
            // Create Razorpay order
            const shortUserId = String(userId).slice(-6);
            const receiptStr = `temp_${Date.now()}_${shortUserId}`;
            // Ensure receipt is no more than 40 characters
            const safeReceipt = receiptStr.slice(0, 40);
            const razorpayOrder = await razorpay.orders.create({
                amount: finalAmount * 100, // Convert to paise
                currency: 'INR',
                receipt: safeReceipt
            });
            res.json({
                status: true,
                razorpayOrderId: razorpayOrder.id,
                amount: finalAmount,
                orderDetails // send to frontend for payment verification
            });
        }
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ 
            status: false, 
            message: 'Error placing order. Please try again.' 
        });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;

        // Find the coupon
        const coupon = await Coupon.findOne({ 
            name: couponCode,
            isListed: true,
            expireOn: { $gt: new Date() }
        });

        if (!coupon) {
            return res.json({ 
                status: false, 
                message: 'Invalid or expired coupon code' 
            });
        }

        // Get cart total
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        
        if (!cart) {
            return res.json({ 
                status: false, 
                message: 'Cart not found' 
            });
        }

        const cartTotal = cart.items.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);

        // Check minimum purchase amount
        if (cartTotal < coupon.minimumPrice) {
            return res.json({ 
                status: false, 
                message: `Minimum purchase amount of ₹${coupon.minimumPrice} required` 
            });
        }

        // Check if user has already used this coupon
        const existingOrder = await Order.findOne({
            user: userId,
            couponCode: couponCode
        });

        if (existingOrder) {
            return res.json({ 
                status: false, 
                message: 'You have already used this coupon' 
            });
        }

        res.json({ 
            status: true, 
            message: 'Coupon applied successfully',
            coupon: {
                name: coupon.name,
                offerPrice: coupon.offerPrice,
                minimumPrice: coupon.minimumPrice
            }
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        res.json({ 
            status: false, 
            message: 'Error applying coupon. Please try again.' 
        });
    }
};

const orderSuccessPage = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId).populate({
            path: 'orderedItem.product',
            model: 'Product'
        });
        if (!order) {
            return res.status(404).send('Order not found');
        }
        const user = await User.findById(order.user);
        res.render('user/order', { order, user });
    } catch (error) {
        console.error('Error loading order success page:', error);
        res.status(500).send('Error loading order success page');
    }
};

const orderFailedPage = (req, res) => {
    res.render('user/orderFailed');
};

module.exports = {
    loadCheckoutPage,
    placeOrder,
    applyCoupon,
    orderSuccessPage,
    orderFailedPage
}

