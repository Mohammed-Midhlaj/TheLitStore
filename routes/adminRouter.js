const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const { userAUth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });
const couponController = require('../controllers/admin/couponController');
const salesReportController = require('../controllers/admin/salesReportController');

// --Login Management--

router.get("/adminlogin", adminController.loadLogin);
router.post("/admin-login", adminController.login);
router.get('/', adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout)
router.get("/errorpage", adminController.pageError)

router.get('/test', (req, res) => {
    res.send("Admin Test Route Working!");
});


// --Customer Management--

router.get("/users", adminAuth, customerController.customerInfo)
router.get("/blockCustomer", adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", adminAuth, customerController.customerUnblocked)

// --Category Management--

router.get("/category", adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
router.get("/listCategory", adminAuth, categoryController.getlistCategory);
router.get("/unlistCategory", adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

// --Category Management--

router.get("/brands", adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.get("/blockBrand", adminAuth, brandController.blockBrand);
router.get("/unblockBrand", adminAuth, brandController.unblockBrand);
router.get("/deleteBrand", adminAuth, brandController.deleteBrand);

// --Product Management--

router.get("/addProducts", adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get('/products', adminAuth, productController.getAllProducts);
router.get('/blockProduct', adminAuth, productController.blockProduct);
router.get('/unblockProduct', adminAuth, productController.unblockProduct);
router.get('/editProduct/:id', adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, uploads.array("images", 4), productController.editProduct);
router.post('/deleteImage', adminAuth, productController.deleteSingleImage);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);

// --Order Management--

router.get("/orderList", adminAuth, orderController.listOrders);
router.get("/orderView/:orderId", adminAuth, orderController.viewOrderDetailPage);
router.post("/orderView/:orderId", adminAuth, orderController.updateOrderStatus);
// --- New: Process Cancel/Return/Refund Requests ---
router.post("/order/:orderId/process-cancel", adminAuth, orderController.processCancelRequest);
router.post("/order/:orderId/process-return", adminAuth, orderController.processReturnRequest);
router.post("/order/:orderId/process-refund", adminAuth, orderController.processRefundRequest);

// Coupon Management Routes
router.get('/coupon', adminAuth, couponController.listCoupons);
router.post('/coupon/create', adminAuth, couponController.createCoupon);
router.post('/coupon/:couponId/toggle', adminAuth, couponController.toggleCouponStatus);
router.delete('/coupon/:couponId/delete', adminAuth, couponController.deleteCoupon);

// Sales report route
router.get('/sales-report', adminAuth, salesReportController.getSalesReport);
router.get('/sales-report/download', adminAuth, salesReportController.downloadSalesReport);

module.exports = router;