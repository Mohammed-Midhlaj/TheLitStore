const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new mongoose.Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    publisher: {
        type: String,
        required: true
    },
    isbn: {
        type: String,
        required: true,
        unique: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        default: 0
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        required: true,
        default: "Available"
    },
    language: {
        type: String,
        required: true
    },
    format: {
        type: String,
        enum: ["Hardcover", "Paperback", "E-book"],
        required: true
    },
    pageCount: {
        type: Number,
        required: true
    },
    publicationDate: {
        type: Date,
        required: true
    }
}, { timestamps: true });

const Product = mongoose.model("Product", productSchema);
module.exports = Product;