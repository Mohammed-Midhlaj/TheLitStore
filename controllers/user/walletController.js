const Transaction = require("../../models/transactionSchema");



const loadWallet = async (req,res) => {
    try {
        res.render("wallet")
    } catch (error) {
        
    }
}

module.exports = {
    loadWallet,
}