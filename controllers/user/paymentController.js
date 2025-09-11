const Razorpay = require('razorpay');
const crypto = require("crypto");
const env = require("dotenv").config();

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})


const createOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: amount,
            currency: "INR",
            receipt: "receipt_thelitstore_001"
        };
        const order = await razorpayInstance.orders.create(options);
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderDetails } = req.body;
        
        console.log('Payment verification request received:', {
            razorpay_order_id,
            razorpay_payment_id,
            orderDetails: orderDetails ? 'Present' : 'Missing'
        });
        
        // Verify the payment signature
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const expectedSignature = hmac.digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Import required models
            const Order = require('../../models/orderSchema');
            const Cart = require('../../models/cartSchema');
            const Product = require('../../models/productSchema');
            
            // Helper function to clear cart
            const clearUserCart = async (userId) => {
                try {
                    // Try both field names to ensure compatibility
                    const cartUpdateResult = await Cart.findOneAndUpdate(
                        { userId: userId },
                        { $set: { items: [] } },
                        { new: true }
                    );
                    
                    if (!cartUpdateResult) {
                        // Fallback to user field if userId doesn't work
                        const fallbackResult = await Cart.findOneAndUpdate(
                            { user: userId },
                            { $set: { items: [] } },
                            { new: true }
                        );
                        console.log('Cart cleared with fallback method:', fallbackResult ? 'Yes' : 'No');
                        return fallbackResult;
                    }
                    
                    console.log('Cart cleared successfully:', cartUpdateResult ? 'Yes' : 'No');
                    return cartUpdateResult;
                } catch (error) {
                    console.error('Error clearing cart:', error);
                    return null;
                }
            };
            
            try {
                // Check for idempotency - if order with same razorpay_order_id already exists
                const existingOrder = await Order.findOne({ razorpay_order_id: razorpay_order_id });
                if (existingOrder) {
                    console.log('Order with razorpay_order_id already exists, returning existing order');
                    return res.json({
                        success: true,
                        message: "Payment verified successfully!",
                        redirect: `/order-success/${existingOrder._id}`,
                        existingOrder: true
                    });
                }
                
                // At this point, stock should already be reserved (decremented) in checkoutController for Razorpay flow
                
                // Add payment details to orderDetails and remove fields not in schema
                const { shipping, couponDiscount, couponCode, ...cleanOrderDetails } = orderDetails;
                const orderData = {
                    ...cleanOrderDetails,
                    razorpay_order_id: razorpay_order_id,
                    razorpay_payment_id: razorpay_payment_id,
                    paymentStatus: 'Completed',
                    status: 'Processing'
                };
                
                console.log('Creating order with data:', orderData);
                
                // Create the order
                const order = new Order(orderData);
                await order.save();
                
                console.log('Order created successfully with ID:', order._id);
                
                // Clear the cart for the user who placed the order
                if (order && order.user) {
                    console.log('Clearing cart for user:', order.user);
                    await clearUserCart(order.user);
                }
                
                // Clear any reservation from session after success
                req.session.stockReservation = null;
                
                res.json({
                    success: true,
                    message: "Payment verified successfully!",
                    redirect: `/order-success/${order._id}`,
                    orderId: order._id
                });
                
            } catch (operationError) {
                console.error('Operation error:', operationError);
                // On any failure after reservation, restore stock if reserved in session
                try {
                    const Product = require('../../models/productSchema');
                    const reservation = req.session.stockReservation;
                    if (reservation && Array.isArray(reservation.items)) {
                        for (const r of reservation.items) {
                            await Product.findByIdAndUpdate(r.productId, { $inc: { quantity: r.quantity } });
                        }
                        req.session.stockReservation = null;
                    }
                } catch (restoreErr) {
                    console.error('Error restoring stock after failure:', restoreErr);
                }
                res.status(400).json({
                    success: false,
                    message: operationError.message || "Operation failed. Please try again."
                });
            }
        } else {
            res.status(400).json({ 
                success: false, 
                message: "Payment verification failed. Invalid signature." 
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        // On signature/verification error, restore reserved stock as well
        try {
            const Product = require('../../models/productSchema');
            const reservation = req.session.stockReservation;
            if (reservation && Array.isArray(reservation.items)) {
                for (const r of reservation.items) {
                    await Product.findByIdAndUpdate(r.productId, { $inc: { quantity: r.quantity } });
                }
                req.session.stockReservation = null;
            }
        } catch (restoreErr) {
            console.error('Error restoring stock after verification error:', restoreErr);
        }
        res.status(500).json({ 
            success: false, 
            message: "Payment verification failed. Please try again." 
        });
    }
};


module.exports = {
    createOrder,
    verifyPayment,
    restoreReservation: async (req, res) => {
        try {
            const reservation = req.session.stockReservation;
            if (!reservation || !Array.isArray(reservation.items) || reservation.items.length === 0) {
                return res.json({ success: true, message: 'No reservation to restore' });
            }
            const Product = require('../../models/productSchema');
            for (const r of reservation.items) {
                await Product.findByIdAndUpdate(r.productId, { $inc: { quantity: r.quantity } });
            }
            req.session.stockReservation = null;
            return res.json({ success: true, message: 'Stock restored' });
        } catch (error) {
            console.error('Error restoring reservation:', error);
            return res.status(500).json({ success: false, message: 'Failed to restore stock' });
        }
    }
}