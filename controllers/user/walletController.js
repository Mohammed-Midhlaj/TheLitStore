const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require("../../models/transactionSchema");
const User = require("../../models/userSchema");

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const transactions = userData.walletHistory.sort((a, b) => b.date - a.date);
        res.render("wallet", {
            user: userData,
            transactions,
            isAuthenticated: true
        });
    } catch (error) {
        console.log("Error loading wallet page:", error);
        res.redirect('/pageNotFound');
    }
}

const createWalletOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ status: false, message: "Invalid amount" });
        }
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });
        const options = {
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: `wallet_${Date.now()}`.slice(0, 40)
        };
        const order = await razorpay.orders.create(options);
        res.json({ status: true, order });
    } catch (error) {
        console.log("Error creating wallet order:", error);
        res.status(500).json({ status: false, message: "Server error" });
    }
}

const verifyWalletPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user;
        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const expectedSignature = hmac.digest('hex');
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ status: false, message: "Payment verification failed" });
        }
        // Update wallet balance and add transaction to walletHistory
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }
        user.walletBalance = (user.walletBalance || 0) + Number(amount);
        user.walletHistory.push({
            amount: Number(amount),
            type: 'credit',
            description: 'Money added via Razorpay',
            date: new Date()
        });
        await user.save();
        res.json({ status: true, message: "Money added successfully", newBalance: user.walletBalance });
    } catch (error) {
        console.log("Error verifying wallet payment:", error);
        res.status(500).json({ status: false, message: "Server error" });
    }
}

module.exports = {
    loadWallet,
    createWalletOrder,
    verifyWalletPayment
};