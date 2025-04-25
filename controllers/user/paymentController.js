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

const verifyPayment = (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const expectedSignature = hmac.digest('hex');

        if (expectedSignature === razorpay_signature) {
            res.json({ success: true, message: "Payment verified successfully!" });
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