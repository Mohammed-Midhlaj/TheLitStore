const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowerCase: true,
    },
    googleId: {
        type: String,
        unique: true,
        sparse:true,
    },
    authType:{
        type:String,
        enum:["email","google"],
        required:true,
        default:"email",
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
    },
    password: {
        type: String,
        required: false, 
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet: [{
        type: Schema.Types.ObjectId,
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
    }],
    createdOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String,
        // required:true
    },
    redeemed: {
        type: Boolean,
        // default:false
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
        // required:true
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category"
        },
        brand: {
            type: String
        },
        searchOn: {
            type: Date,
            default: Date.now,
        }
    }]
})

const User = mongoose.model("User", userSchema);
module.exports = User;