const Order = require('../../models/orderSchema');

const listOrders = async (req, res) => {
    try {
      // Destructure orderFilter from req.query with a default value of "All"
      let { page = 1, limit = 10, search = "", orderFilter = "All" } = req.query;
      page = parseInt(page);
      limit = parseInt(limit);
  
      let query = {};
  
      // Apply search filter if search is provided
      if (search) {
        query.$or = [
          { orderId: { $regex: search, $options: "i" } },
          { status: { $regex: search, $options: "i" } },
          { paymentStatus: { $regex: search, $options: "i" } }
        ];
      }
      
      // Apply the status filter if orderFilter is provided and not "All"
      if (orderFilter && orderFilter !== "All") {
        query.status = { $regex: '^' + orderFilter + '$', $options: 'i' };
      }

      console.log("Received orderFilter:", orderFilter);
  
      const allOrders = await Order.find(query)
        .sort({ createdOn: -1 })
        .populate('billingAddress')
        .populate('user');
      // Separate orders with pending requests
      const requestOrders = allOrders.filter(order =>
        (order.cancellationRequested && order.cancellationStatus === 'Requested') ||
        (order.returnRequested && order.returnStatus === 'Requested') ||
        (order.refundRequested && order.refundStatus === 'Requested')
      );
      const normalOrders = allOrders.filter(order => !requestOrders.includes(order));
      // Pagination on combined list
      const combinedOrders = [...requestOrders, ...normalOrders];
      const totalOrders = combinedOrders.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedOrders = combinedOrders.slice(start, end);
      res.render("adminOrders", {
        orders: paginatedOrders,
        requestOrders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        search,
        orderFilter : orderFilter || "All"
      });
    } catch (error) {
      console.error("Error listing orders:", error);  
      res.redirect("/errorpage");
    }
  };

  

const viewOrderDetailPage = async (req, res) => {
    try {

        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderedItem.product')
            .populate('billingAddress');

        if (!order) {
            return res.redirect("/orderList");
        }

        res.render("orderViewPage", { order })

    } catch (error) {
        console.error("Error viewing order details:", error);
        res.redirect("/orderList");
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;

        // Get the current order to check its status
        const currentOrder = await Order.findById(orderId);
        if (!currentOrder) {
            return res.redirect("/admin/orderList");
        }

        // Prevent reverting from Delivered status
        if (currentOrder.status === "Delivered" && 
            ["Pending", "Processing", "Shipped"].includes(status)) {
            return res.redirect("/admin/orderView/" + orderId + "?error=invalid_status");
        }

        // If status is being updated to Delivered, automatically set payment status to Completed
        const paymentStatus = status === "Delivered" ? "Completed" : currentOrder.paymentStatus;

        await Order.findByIdAndUpdate(orderId, {
            status,
            paymentStatus,
        });

        res.redirect("/admin/orderView/" + orderId + "?updated=true");

    } catch (error) {
        console.error("Error updating order status:", error);
        res.redirect("/admin/orderView/" + req.params.orderId);
    }
}

// --- New: Admin Approve/Deny Cancel/Return/Refund ---
const processCancelRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body; // 'approve' or 'deny'
        const order = await Order.findById(orderId);
        if (!order || !order.cancellationRequested) {
            return res.status(404).json({ status: false, message: "No cancellation request found." });
        }
        if (action === 'approve') {
            order.cancellationStatus = 'Approved';
            order.status = 'Cancelled';
            order.cancellationProcessedAt = new Date();
            // Restock products
            await Promise.all(order.orderedItem.map(async (item) => {
                await require('../../models/productSchema').findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
            }));
        } else {
            order.cancellationStatus = 'Denied';
            order.cancellationProcessedAt = new Date();
        }
        await order.save();
        res.json({ status: true, message: `Cancellation ${action}d.` });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const processReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body; // 'approve' or 'deny'
        const order = await Order.findById(orderId);
        if (!order || !order.returnRequested) {
            return res.status(404).json({ status: false, message: "No return request found." });
        }
        if (action === 'approve') {
            order.returnStatus = 'Approved';
            order.status = 'Returned';
            order.returnProcessedAt = new Date();
            // Restock products
            await Promise.all(order.orderedItem.map(async (item) => {
                await require('../../models/productSchema').findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
            }));
        } else {
            order.returnStatus = 'Denied';
            order.returnProcessedAt = new Date();
        }
        await order.save();
        res.json({ status: true, message: `Return ${action}d.` });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

const processRefundRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body; // 'approve', 'deny', or 'process'
        const order = await Order.findById(orderId);
        if (!order || !order.refundRequested) {
            return res.status(404).json({ status: false, message: "No refund request found." });
        }
        if (action === 'approve') {
            order.refundStatus = 'Approved';
            order.refundRequested = false;
        } else if (action === 'process') {
            order.refundStatus = 'Processed';
            order.refundProcessedAt = new Date();
            order.paymentStatus = 'Refunded';
            order.refundRequested = false;
        } else {
            order.refundStatus = 'Denied';
            order.refundRequested = false;
        }
        await order.save();
        res.json({ status: true, message: `Refund ${action}d.` });
    } catch (error) {
        res.status(500).json({ status: false, message: "Internal server error" });
    }
};

module.exports = {
    listOrders,
    viewOrderDetailPage,
    updateOrderStatus,
    processCancelRequest,
    processReturnRequest,
    processRefundRequest
};