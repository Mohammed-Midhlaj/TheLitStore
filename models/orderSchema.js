const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid")

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true,
    },
    orderedItem: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        cancellationRequested: { type: Boolean, default: false },
        cancellationStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied'], default: 'None' },
        cancellationRequestedAt: { type: Date },
        cancellationProcessedAt: { type: Date },
        returnRequested: { type: Boolean, default: false },
        returnStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied'], default: 'None' },
        returnRequestedAt: { type: Date },
        returnProcessedAt: { type: Date },
        returnReason: { type: String, default: '' },
        refundRequested: { type: Boolean, default: false },
        refundStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied', 'Processed'], default: 'None' },
        refundRequestedAt: { type: Date },
        refundProcessedAt: { type: Date }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    billingAddress: {
        addressType: { type: String, required: true },
        name: { type: String, required: true },
        city: { type: String, required: true },
        landMark: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: Number, required: true },
        phone: { type: String, required: true },
        altPhone: { type: String, required: true }
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned"]
    },
    createdOn: {
        type: Date,
        default: Date.now, 
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["cod", "razorpay", "upi"]
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Completed", "Failed","Refunded"],
        default: "Pending"
    },
    returnReason: {
        type: String,
        default: ""
    },
    cancellationRequested: { type: Boolean, default: false },
    cancellationStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied'], default: 'None' },
    cancellationRequestedAt: { type: Date },
    cancellationProcessedAt: { type: Date },
    returnRequested: { type: Boolean, default: false },
    returnStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied'], default: 'None' },
    returnRequestedAt: { type: Date },
    returnProcessedAt: { type: Date },
    refundRequested: { type: Boolean, default: false },
    refundStatus: { type: String, enum: ['None', 'Requested', 'Approved', 'Denied', 'Processed'], default: 'None' },
    refundRequestedAt: { type: Date },
    refundProcessedAt: { type: Date },
})

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;