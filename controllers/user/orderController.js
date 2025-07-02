const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require('../../models/productSchema');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

        // If payment was made through Razorpay, initiate refund
        if (order.paymentMethod === 'razorpay' && order.paymentStatus === 'Completed') {
            try {
                // Create refund in Razorpay
                const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
                    amount: order.finalAmount * 100, // Convert to paise
                    speed: 'normal'
                });

                // Update order status
                order.status = "Cancelled";
                order.paymentStatus = "Refunded";
                order.refundStatus = "Processed";
                order.refundProcessedAt = new Date();
                await order.save();

                // Restore product quantities
                await Promise.all(order.orderedItem.map(async (item) => {
                    await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
                }));

                res.status(200).json({ 
                    status: true, 
                    message: "Order cancelled and refund initiated successfully",
                    refundId: refund.id
                });
            } catch (refundError) {
                console.error("Error processing refund:", refundError);
                return res.status(500).json({ 
                    status: false, 
                    message: "Error processing refund. Please contact support." 
                });
            }
        } else if (order.paymentMethod === 'wallet' && order.paymentStatus === 'Completed') {
            // Refund to wallet
            const user = await User.findById(order.user);
            if (user) {
                user.walletBalance += order.finalAmount;
                user.walletHistory.push({
                    amount: order.finalAmount,
                    type: 'credit',
                    description: `Refund for cancelled order #${order._id}`,
                    date: new Date()
                });
                await user.save();
            }
            order.status = "Cancelled";
            order.paymentStatus = "Refunded";
            order.refundStatus = "Processed";
            order.refundProcessedAt = new Date();
            await order.save();
            // Restore product quantities
            await Promise.all(order.orderedItem.map(async (item) => {
                await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
            }));
            return res.status(200).json({ status: true, message: "Order cancelled and amount refunded to wallet." });
        } else {
            // For COD orders or other payment methods
            order.status = "Cancelled";
            await order.save();

            // Restore product quantities
            await Promise.all(order.orderedItem.map(async (item) => {
                await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
            }));

            res.status(200).json({ status: true, message: "Order cancelled successfully" });
        }
    } catch (error) {
        console.log("Error occurred during cancel order: ", error);
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

        // Update order status
        order.status = "Return Request";
        order.returnReason = returnReason;
        order.returnRequested = true;
        order.returnStatus = "Requested";
        order.returnRequestedAt = new Date();
        await order.save();

        // If payment was made through Razorpay, prepare for refund
        if (order.paymentMethod === 'razorpay' && order.paymentStatus === 'Completed') {
            order.refundRequested = true;
            order.refundStatus = "Requested";
            order.refundRequestedAt = new Date();
            await order.save();
        }
        // If payment was made through Wallet, process refund immediately
        if (order.paymentMethod === 'wallet' && order.paymentStatus === 'Completed') {
            const user = await User.findById(order.user);
            if (user) {
                user.walletBalance += order.finalAmount;
                user.walletHistory.push({
                    amount: order.finalAmount,
                    type: 'credit',
                    description: `Refund for returned order #${order._id}`,
                    date: new Date()
                });
                await user.save();
            }
            order.refundStatus = "Processed";
            order.refundProcessedAt = new Date();
            order.paymentStatus = "Refunded";
            await order.save();
        }

        res.status(200).json({ status: true, message: "Return request submitted successfully." });
    } catch (error) {
        console.log("Error occurred during return request: ", error);
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

        // Set up PDF with proper margins
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4'
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        // Header with proper spacing
        doc.fontSize(22).text('TheLitStore', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('INVOICE', { align: 'center' });
        doc.moveDown(1);

        // Order/User Info with consistent spacing
        doc.fontSize(12);
        doc.text(`Order ID: ${order.orderId}`, { continued: true, align: 'left' });
        doc.text(`Date: ${moment(order.createdOn).format('YYYY-MM-DD HH:mm')}`, { align: 'right' });
        doc.moveDown(0.5);
        doc.text(`Customer: ${order.user.name}`);
        doc.text(`Email: ${order.user.email}`);
        doc.moveDown(1);

        // Address with proper formatting
        const addr = order.billingAddress;
        doc.fontSize(13).text('Shipping Address:', { underline: true });
        doc.fontSize(12);
        doc.text(`Type: ${addr.addressType || addr.type || 'N/A'}`);
        doc.text(`${addr.name}`);
        doc.text(`${addr.landMark}`);
        doc.text(`${addr.city}, ${addr.state}, ${addr.pincode}`);
        doc.text(`Phone: ${addr.phone}`);
        doc.moveDown(1);

        // Product Table with improved alignment
        doc.fontSize(13).text('Products:', { underline: true });
        doc.moveDown(0.2);

        // Table header with fixed column widths
        const tableTop = doc.y;
        const nameWidth = 200;
        const qtyWidth = 50;
        const priceWidth = 80;
        const totalWidth = 80;

        // Draw table header
        doc.fontSize(12);
        doc.text('Name', 50, tableTop, { width: nameWidth });
        doc.text('Qty', 50 + nameWidth, tableTop, { width: qtyWidth, align: 'center' });
        doc.text('Price', 50 + nameWidth + qtyWidth, tableTop, { width: priceWidth, align: 'right' });
        doc.text('Total', 50 + nameWidth + qtyWidth + priceWidth, tableTop, { width: totalWidth, align: 'right' });
        
        // Draw header line
        doc.moveTo(50, tableTop + 15).lineTo(50 + nameWidth + qtyWidth + priceWidth + totalWidth, tableTop + 15).stroke();
        doc.moveDown(0.5);

        // Product rows with consistent alignment
        let y = doc.y;
        order.orderedItem.forEach(item => {
            doc.text(item.product.productName, 50, y, { width: nameWidth });
            doc.text(item.quantity.toString(), 50 + nameWidth, y, { width: qtyWidth, align: 'center' });
            doc.text(`₹${item.price.toFixed(2)}`, 50 + nameWidth + qtyWidth, y, { width: priceWidth, align: 'right' });
            doc.text(`₹${(item.price * item.quantity).toFixed(2)}`, 50 + nameWidth + qtyWidth + priceWidth, y, { width: totalWidth, align: 'right' });
            y = doc.y + 5;
        });
        doc.moveDown(1);

        // Payment Breakdown with right alignment
        doc.fontSize(13).text('Payment Breakdown:', { underline: true });
        doc.moveDown(0.5);
        
        // Calculate positions for payment breakdown
        const breakdownStartX = 50;
        const breakdownEndX = 50 + nameWidth + qtyWidth + priceWidth + totalWidth;
        const breakdownWidth = breakdownEndX - breakdownStartX;
        const labelWidth = 100;
        const amountWidth = 100;
        const breakdownY = doc.y;
        
        // Draw divider line
        doc.moveTo(breakdownStartX, breakdownY).lineTo(breakdownEndX, breakdownY).stroke();
        doc.moveDown(0.5);
        
        // Payment breakdown items with consistent spacing
        const lineHeight = 25;
        let currentY = doc.y;
        
        // Subtotal
        doc.fontSize(12);
        doc.text('Subtotal:', breakdownStartX, currentY, { width: labelWidth, align: 'right' });
        doc.text(`₹${order.totalPrice.toFixed(2)}`, breakdownEndX - amountWidth, currentY, { width: amountWidth, align: 'right' });
        
        // Shipping
        currentY += lineHeight;
        doc.text('Shipping:', breakdownStartX, currentY, { width: labelWidth, align: 'right' });
        doc.text(`₹${order.shippingCharge ? order.shippingCharge.toFixed(2) : '149.00'}`, breakdownEndX - amountWidth, currentY, { width: amountWidth, align: 'right' });
        
        // Discount
        currentY += lineHeight;
        doc.text('Discount:', breakdownStartX, currentY, { width: labelWidth, align: 'right' });
        doc.text(`₹${order.discount ? order.discount.toFixed(2) : '0.00'}`, breakdownEndX - amountWidth, currentY, { width: amountWidth, align: 'right' });
        
        // Draw divider line before total
        currentY += lineHeight;
        doc.moveTo(breakdownStartX, currentY).lineTo(breakdownEndX, currentY).stroke();
        doc.moveDown(0.5);
        
        // Total Paid with bold font
        currentY = doc.y;
        doc.font('Helvetica-Bold');
        doc.text('Total Paid:', breakdownStartX, currentY, { width: labelWidth, align: 'right' });
        doc.text(`₹${order.finalAmount.toFixed(2)}`, breakdownEndX - amountWidth, currentY, { width: amountWidth, align: 'right' });
        doc.font('Helvetica');
        
        doc.moveDown(2);

        // Footer with proper spacing
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

// --- item level cancel and return ---
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

// Add new function to handle refund processing
const processRefund = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ _id: orderId, user: req.session.user });

        if (!order) {
            return res.status(404).json({ status: false, message: "Order not found" });
        }

        if (order.paymentMethod !== 'razorpay' || order.paymentStatus !== 'Completed') {
            return res.status(400).json({ status: false, message: "Refund not applicable for this order" });
        }

        if (order.refundStatus === 'Processed') {
            return res.status(400).json({ status: false, message: "Refund already processed" });
        }

        try {
            // Create refund in Razorpay
            const refund = await razorpay.payments.refund(order.razorpay_payment_id, {
                amount: order.finalAmount * 100, // Convert to paise
                speed: 'normal'
            });

            // Update order status
            order.refundStatus = "Processed";
            order.refundProcessedAt = new Date();
            order.paymentStatus = "Refunded";
            await order.save();

            res.status(200).json({ 
                status: true, 
                message: "Refund processed successfully",
                refundId: refund.id
            });
        } catch (refundError) {
            console.error("Error processing refund:", refundError);
            return res.status(500).json({ 
                status: false, 
                message: "Error processing refund. Please contact support." 
            });
        }
    } catch (error) {
        console.log("Error processing refund:", error);
        res.status(500).json({ status: false, message: "Internal server error" });
    }
}

module.exports = {
    thankingPage,
    orderList,
    loadOrderDetails,
    cancelOrder,
    returnOrder,
    downloadInvoice,
    processRefund,
    requestCancel,
    requestReturn,
    requestRefund,
    getOrderRequestStatus,
    // Item-level actions
    requestCancelItem,
    requestReturnItem,
    requestRefundItem,
}