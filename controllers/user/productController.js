const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");



// productController.js


const productDetails = async (req, res) => { 
  try {
    const userId = req.session.user || null;
    const userData = await User.findById(userId);
    const productId = req.query.id || req.query.productId;

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const product = await Product.findById(productId).populate('category');
    const findCategory = product.category;


    const totalRelatedCount = await Product.countDocuments({
      category: product.category,
      _id: { $ne: product._id }
    });

   
    const totalPages = Math.ceil(totalRelatedCount / limit);

   
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      isBlocked:false,
    }).skip(skip).limit(limit);

    const categoryOffer = findCategory?.categoryOffer || 0;
    const productOffer = product.productOffer || 0;
    const totalOffer = categoryOffer + productOffer;

    res.render("product-details", {
      user: userData,
      product: product,
      quantity: product.quantity,
      totalOffer: totalOffer,
      category: findCategory,
      relatedProducts,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.log("Error fetching Product Details", error);
    res.redirect("/PageNotFound");
  }
}



module.exports = {
  productDetails,
}