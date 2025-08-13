const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryController");
const brandController = require("../controllers/admin/brandController");
const productController = require("../controllers/admin/productController");
const orderController = require("../controllers/admin/orderController");
const { userAuth, adminAuth } = require("../middlewares/auth");
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({ storage: storage });
const couponController = require('../controllers/admin/couponController');
const salesReportController = require('../controllers/admin/salesReportController');

// Middleware to prevent caching on admin routes
const noCache = (req, res, next) => {
    res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

// --Login Management--

router.get("/adminlogin", noCache, adminController.loadLogin);
router.post("/admin-login", adminController.login);
router.get('/', noCache, adminAuth, adminController.loadDashboard);
router.get('/logout', adminController.logout)
router.get("/errorpage", noCache, adminController.pageError)

router.get('/test', (req, res) => {
    res.send("Admin Test Route Working!");
});


// --Customer Management--

router.get("/users", noCache, adminAuth, customerController.customerInfo)
router.get("/blockCustomer", noCache, adminAuth, customerController.customerBlocked);
router.get("/unblockCustomer", noCache, adminAuth, customerController.customerUnblocked)

// --Category Management--

router.get("/category", noCache, adminAuth, categoryController.categoryInfo);
router.post("/addCategory", adminAuth, categoryController.addCategory);
router.post("/addCategoryOffer", adminAuth, categoryController.addCategoryOffer);
router.post("/removeCategoryOffer", adminAuth, categoryController.removeCategoryOffer);
router.get("/listCategory", noCache, adminAuth, categoryController.getlistCategory);
router.get("/unlistCategory", noCache, adminAuth, categoryController.getUnlistCategory);
router.get("/editCategory", noCache, adminAuth, categoryController.getEditCategory);
router.post("/editCategory/:id", adminAuth, categoryController.editCategory);

// --Brand Management--

router.get("/brands", noCache, adminAuth, brandController.getBrandPage);
router.post("/addBrand", adminAuth, uploads.single("image"), brandController.addBrand);
router.get("/blockBrand", noCache, adminAuth, brandController.blockBrand);
router.get("/unblockBrand", noCache, adminAuth, brandController.unblockBrand);
router.get("/deleteBrand", noCache, adminAuth, brandController.deleteBrand);

// --Product Management--

router.get("/addProducts", noCache, adminAuth, productController.getProductAddPage);
router.post("/addProducts", adminAuth, uploads.array("images", 4), productController.addProducts);
router.get('/products', noCache, adminAuth, productController.getAllProducts);
router.get('/blockProduct', noCache, adminAuth, productController.blockProduct);
router.get('/unblockProduct', noCache, adminAuth, productController.unblockProduct);
router.get('/editProduct/:id', noCache, adminAuth, productController.getEditProduct);
router.post('/editProduct/:id', adminAuth, uploads.array("images", 4), productController.editProduct);
router.post('/deleteImage', adminAuth, productController.deleteSingleImage);
router.post('/addProductOffer', adminAuth, productController.addProductOffer);
router.post('/removeProductOffer', adminAuth, productController.removeProductOffer);

// --Order Management--

router.get("/orderList", noCache, adminAuth, orderController.listOrders);
router.get("/orderView/:orderId", noCache, adminAuth, orderController.viewOrderDetailPage);
router.post("/orderView/:orderId", adminAuth, orderController.updateOrderStatus);
// --- New: Process Cancel/Return/Refund Requests ---
router.post("/order/:orderId/process-cancel", adminAuth, orderController.processCancelRequest);
router.post("/order/:orderId/process-return", adminAuth, orderController.processReturnRequest);
router.post("/order/:orderId/process-refund", adminAuth, orderController.processRefundRequest);

// Coupon Management Routes
router.get('/coupon', noCache, adminAuth, couponController.listCoupons);
router.post('/coupon/create', adminAuth, couponController.createCoupon);
router.post('/coupon/:couponId/toggle', adminAuth, couponController.toggleCouponStatus);
router.delete('/coupon/:couponId/delete', adminAuth, couponController.deleteCoupon);

// Sales report route
router.get('/sales-report', noCache, adminAuth, salesReportController.getSalesReport);
router.get('/sales-report/download', adminAuth, salesReportController.downloadSalesReport);

// Analytics Dashboard
router.get('/analytics', noCache, adminAuth, salesReportController.getAnalyticsDashboard);

module.exports = router;