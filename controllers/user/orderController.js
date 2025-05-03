const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require('../../models/productSchema');
const PDFDocument = require('pdfkit');
const moment = require('moment');


const thankingPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);

        res.render("order", { user })
    } catch (error) {
        console.log("error rendering orderpage", error)
        res.redirect("/pageNotFound")
    }
}

const orderList = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const totalOrders = await Order.countDocuments({ user: userId });
        const orders = await Order.find({ user: userId })
            .populate('orderedItem.product')
            .populate('billingAddress')
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit);
        const totalPages = Math.ceil(totalOrders / limit);
        res.render("orderListing", {
            user: userData,
            orders,
            isAuthenticated: true,
            currentPage: page,
            totalPages
        })
    } catch (error) {
        console.log("error loding orderlist page");
        res.redirect('/pageNotFound')
    }
}

const loadOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId) 
            .populate('orderedItem.product')
            .populate('billingAddress')
            .populate('user');

        res.render("orders", { 
            order,
            isAuthenticated: true 
        });
    } catch (error) {
        console.log("Error loading orderDetails page: ", error)
        res.redirect("/pageNotFound");
    }
}

const cancelOrder = async (req, res) => {
    try {

        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) {
            return res.status(404).json({ status: false, message: "Order not found" });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ status: false, message: "Order already cancelled" });
        }

        order.status = "Cancelled";
        await order.save();

        await Promise.all(order.orderedItem.map(async (item) => {
            await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
        }))

        res.status(200).json({ status: true, message: "Order cancelled successfully" });

    } catch (error) {
        console.log("Error occured during cancel order: ", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
}

const returnOrder = async (req, res) => {
    try {

        const { orderId, returnReason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });

        if (!order) {
            return res.status(404).json({ status: false, message: "Order Not found" });
        }

        if (order.status !== "Delivered") {
            return res.status(400).json({ status: false, message: "Order cannot be returned" });
        }

        order.status = "Return Request";
        order.returnReason = returnReason;
        await order.save();

        res.status(200).json({ status: true, message: "Return request submitted successfully." });

    } catch (error) {
        console.log("Error occured during return request: ", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
}

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItem.product')
            .populate('billingAddress')
            .populate('user');
        if (!order) return res.status(404).send('Order not found');

        // Set up PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(22).text('TheLitStore', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('INVOICE', { align: 'center' });
        doc.moveDown(1);

        // Order/User Info
        doc.fontSize(12).text(`Order ID: ${order.orderId}`);
        doc.text(`Order Date: ${moment(order.createdOn).format('YYYY-MM-DD HH:mm')}`);
        doc.text(`Customer: ${order.user.name}`);
        doc.text(`Email: ${order.user.email}`);
        doc.moveDown(0.5);

        // Address
        const addr = order.billingAddress;
        doc.fontSize(13).text('Shipping Address:', { underline: true });
        doc.fontSize(12).text(`Type: ${addr.addressType || addr.type || 'N/A'}`);
        doc.text(`${addr.name}`);
        doc.text(`${addr.landMark}, ${addr.city}, ${addr.state}, ${addr.pincode}`);
        doc.text(`Phone: ${addr.phone}`);
        doc.moveDown(1);

        // Product Table Header
        doc.fontSize(13).text('Products:', { underline: true });
        doc.moveDown(0.2);
        doc.fontSize(12).text('Name', 50, doc.y, { continued: true });
        doc.text('Qty', 250, doc.y, { continued: true });
        doc.text('Price', 300, doc.y, { continued: true });
        doc.text('Total', 370, doc.y);
        doc.moveDown(0.2);
        doc.moveTo(50, doc.y).lineTo(500, doc.y).stroke();

        // Product Table Rows
        order.orderedItem.forEach(item => {
            doc.text(item.product.productName, 50, doc.y, { continued: true });
            doc.text(item.quantity.toString(), 250, doc.y, { continued: true });
            doc.text(`₹${item.price.toFixed(2)}`, 300, doc.y, { continued: true });
            doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 370, doc.y);
        });
        doc.moveDown(1);

        // Payment Breakdown
        doc.fontSize(13).text('Payment Breakdown:', { underline: true });
        doc.fontSize(12).text(`Subtotal: ₹${order.totalPrice.toFixed(2)}`);
        doc.text(`Shipping: ₹${order.shippingCharge ? order.shippingCharge.toFixed(2) : '149.00'}`);
        doc.text(`Discount: ₹${order.discount ? order.discount.toFixed(2) : '0.00'}`);
        doc.font('Helvetica-Bold').text(`Total Paid: ₹${order.finalAmount.toFixed(2)}`);
        doc.font('Helvetica');
        doc.moveDown(1);

        // Footer
        doc.fontSize(10).text('Thank you for shopping with TheLitStore!', { align: 'center' });
        doc.end();
    } catch (error) {
        console.log('Error generating invoice:', error);
        res.status(500).send('Error generating invoice');
    }
}

// --- New: Request Cancel, Return, Refund ---
const requestCancel = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        if (order.status === 'Cancelled' || order.cancellationStatus === 'Approved') {
            return res.status(400).json({ status: false, message: "Order already cancelled" });
        }
        if (order.status !== 'Pending' && order.status !== 'Processing') {
            return res.status(400).json({ status: false, message: "Order cannot be cancelled at this stage" });
        }
        order.cancellationRequested = true;
        order.cancellationStatus = 'Requested';
        order.cancellationRequestedAt = new Date();
        await order.save();
        res.status(200).json({ status: true, message: "Cancellation request submitted." });
    } catch (error) {
        console.log("Error requesting cancel:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const requestReturn = async (req, res) => {
    try {
        const { orderId, returnReason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        if (order.status !== 'Delivered') {
            return res.status(400).json({ status: false, message: "Order cannot be returned at this stage" });
        }
        if (order.returnRequested || order.returnStatus === 'Approved') {
            return res.status(400).json({ status: false, message: "Return already requested/approved" });
        }
        order.returnRequested = true;
        order.returnStatus = 'Requested';
        order.returnRequestedAt = new Date();
        order.returnReason = returnReason || '';
        await order.save();
        res.status(200).json({ status: true, message: "Return request submitted." });
    } catch (error) {
        console.log("Error requesting return:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const requestRefund = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        if (order.refundRequested || order.refundStatus === 'Processed') {
            return res.status(400).json({ status: false, message: "Refund already requested/processed" });
        }
        if (order.returnStatus !== 'Approved' && order.status !== 'Cancelled') {
            return res.status(400).json({ status: false, message: "Refund can only be requested after return approval or cancellation" });
        }
        order.refundRequested = true;
        order.refundStatus = 'Requested';
        order.refundRequestedAt = new Date();
        await order.save();
        res.status(200).json({ status: true, message: "Refund request submitted." });
    } catch (error) {
        console.log("Error requesting refund:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

// Helper for frontend to get request status
const getOrderRequestStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        res.status(200).json({
            cancellationRequested: order.cancellationRequested,
            cancellationStatus: order.cancellationStatus,
            returnRequested: order.returnRequested,
            returnStatus: order.returnStatus,
            refundRequested: order.refundRequested,
            refundStatus: order.refundStatus
        });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

// --- Item-level Cancel/Return/Refund ---
const requestCancelItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        const item = order.orderedItem.id(itemId);
        if (!item) return res.status(404).json({ status: false, message: "Item not found" });
        if (item.cancellationRequested || item.cancellationStatus === 'Approved') {
            return res.status(400).json({ status: false, message: "Item already cancelled" });
        }
        item.cancellationRequested = true;
        item.cancellationStatus = 'Requested';
        item.cancellationRequestedAt = new Date();
        await order.save();
        res.status(200).json({ status: true, message: "Cancellation request submitted for item." });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const requestReturnItem = async (req, res) => {
    try {
        const { orderId, itemId, returnReason } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        const item = order.orderedItem.id(itemId);
        if (!item) return res.status(404).json({ status: false, message: "Item not found" });
        if (item.returnRequested || item.returnStatus === 'Approved') {
            return res.status(400).json({ status: false, message: "Return already requested/approved for this item" });
        }
        item.returnRequested = true;
        item.returnStatus = 'Requested';
        item.returnRequestedAt = new Date();
        item.returnReason = returnReason || '';
        await order.save();
        res.status(200).json({ status: true, message: "Return request submitted for item." });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const requestRefundItem = async (req, res) => {
    try {
        const { orderId, itemId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });
        if (!order) return res.status(404).json({ status: false, message: "Order not found" });
        const item = order.orderedItem.id(itemId);
        if (!item) return res.status(404).json({ status: false, message: "Item not found" });
        if (item.refundRequested || item.refundStatus === 'Processed') {
            return res.status(400).json({ status: false, message: "Refund already requested/processed for this item" });
        }
        if (item.returnStatus !== 'Approved' && item.cancellationStatus !== 'Approved') {
            return res.status(400).json({ status: false, message: "Refund can only be requested after return/cancellation approval for this item" });
        }
        item.refundRequested = true;
        item.refundStatus = 'Requested';
        item.refundRequestedAt = new Date();
        await order.save();
        res.status(200).json({ status: true, message: "Refund request submitted for item." });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

module.exports = {
    thankingPage,
    orderList,
    loadOrderDetails,
    cancelOrder,
    returnOrder,
    downloadInvoice,
    requestCancel,
    requestReturn,
    requestRefund,
    getOrderRequestStatus,
    // Item-level actions
    requestCancelItem,
    requestReturnItem,
    requestRefundItem,
}