const Transaction = require("../../models/transactionSchema");
const User = require("../../models/userSchema");

const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const transactions = await Transaction.find({ user: userId }).sort({ createdAt: -1 });
        
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

const addMoneyToWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ status: false, message: "Invalid amount" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ status: false, message: "User not found" });
        }

        // Create transaction record
        const transaction = new Transaction({
            user: userId,
            amount: amount,
            type: 'credit',
            description: 'Money added to wallet'
        });
        await transaction.save();

        // Update user's wallet balance
        user.wallet += amount;
        await user.save();

        return res.status(200).json({ 
            status: true, 
            message: "Money added successfully",
            newBalance: user.wallet
        });

    } catch (error) {
        console.log("Error adding money to wallet:", error);
        return res.status(500).json({ status: false, message: "Server error" });
    }
}

module.exports = {
    loadWallet,
    addMoneyToWallet
}