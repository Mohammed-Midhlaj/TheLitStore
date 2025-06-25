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
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const expectedSignature = hmac.digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Create and save the order
            const Order = require('../models/orderSchema');
            const Cart = require('../models/cartSchema');
            const Product = require('../models/productSchema');
            const order = new Order(orderDetails);
            await order.save();
            // Update product quantities
            for (const item of order.orderedItem) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: -item.quantity }
                });
            }
            // Clear the cart for the user who placed the order
            if (order && order.user) {
                await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });
            }
            res.json({ success: true, message: "Payment verified successfully!", redirect: `/order-success/${order._id}` });
        } else {
            res.status(400).json({ success: false, message: "Payment verification failed." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    createOrder,
    verifyPayment,
}