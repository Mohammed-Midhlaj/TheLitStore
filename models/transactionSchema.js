const mongoose = require("mongoose");
const { Schema } = mongoose;

const TransactionSchema = new mongoose.Schema({
    type: { 
      type: String, 
      enum: ['credit', 'debit'], 
      required: true 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    description: { 
      type: String 
    },
    date: { 
      type: Date, 
      default: Date.now 
    }
  });


  const Transaction = mongoose.model("Transaction", TransactionSchema);
  module.exports = Transaction;