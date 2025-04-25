const User = require("../../models/userSchema");
const Order = require('../../models/orderSchema');
const Cart = require("../../models/cartSchema");
const Address = require("../../models/addressSchema");
const Product = require("../../models/productSchema");



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

        res.render("checkout", {
            user,
            cartItems: cart.items,
            totalPrice,
            deliveryCharge,
            finalAmount,
            addresses
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
        const { billingAddress, payment } = req.body;

        if (!billingAddress) {
            return res.status(400).json({ status: false, message: "Billing address is required" });
        }

        if (!payment) {
            return res.status(400).json({ status: false, message: "Payment method is required" });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ status: false, message: "Your cart is empty" });
        }

        const userAddresses = await Address.findOne({ userId });
        if (!userAddresses) {
            return res.status(400).json({ status: false, message: "No addresses found for user" });
        }

        const selectedAddress = userAddresses.address.find(addr => addr._id.toString() === billingAddress);
        if (!selectedAddress) {
            return res.status(400).json({ status: false, message: "Selected address not found" });
        }

        let totalPrice = 0;
        const orderedItem = cart.items.map(item => {
            totalPrice += item.totalPrice;
            return {
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price
            };
        });

        const deliveryCharge = 149;
        const discount = 0;
        const finalAmount = totalPrice + deliveryCharge - discount;

        const newOrder = new Order({
            orderedItem,
            totalPrice,
            discount,
            finalAmount,
            billingAddress: selectedAddress,
            user: userId,
            paymentMethod: payment,
            paymentStatus: payment === "cod" ? "Pending" : "Completed",
            status: "Pending",
            invoiceDate: new Date()
        });

        await newOrder.save();

        await Promise.all(orderedItem.map(async (item) => {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
        }));

        cart.items = [];
        await cart.save();

        res.status(200).json({ status: true, message: "Order placed successfully" });

    } catch (error) {
        console.error("Error placing order:", error);
        res.status(500).redirect("/pageNotFound");
    }
};



module.exports = {
    loadCheckoutPage,
    placeOrder,
}
