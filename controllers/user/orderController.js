const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require('../../models/productSchema');


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
        const orders = await Order.find({ user: req.session.user }).populate('orderedItem.product').populate('billingAddress');

        res.render("orderListing", {orders})

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

        res.render("orders", { order });
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

module.exports = {
    thankingPage,
    orderList,
    loadOrderDetails,
    cancelOrder,
    returnOrder,
}