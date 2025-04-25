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
  
      const orders = await Order.find(query)
        .sort({ createdOn: -1 })
        .populate('billingAddress')
        .populate('user')
        .skip((page - 1) * limit)
        .limit(limit);
  
      const totalOrders = await Order.countDocuments(query);
  
      res.render("adminOrders", {
        orders,
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
        const { status, paymentStatus } = req.body;

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


module.exports = {
    listOrders,
    viewOrderDetailPage,
    updateOrderStatus,
}