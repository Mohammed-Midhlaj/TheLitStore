const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');


// ---Load Wishlist Page ---

const loadWishlist = async (req, res) => {
    try {

        const userId = req.session.user;
        const user = await User.findById(userId);
        const products = await Product.find({ _id: { $in: user.wishlist } }).populate('category');

        res.render("wishlist", {
            user,
            wishlist: products,
        })

    } catch (error) {
        console.log("Error occured in loaadWishlist: ", error);
        res.redirect("/pageNotFound")
    }
}

// ---Add to wishlist Page ---

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        const user = await User.findById(userId);

        if (user.wishlist.includes(productId)) {
            return res.status(200).json({ status: false, message: "Product already in wishlist" });
        }
        user.wishlist.push(productId);
        await user.save();
        return res.status(200).json({ status: true, message: "Product added to wishlist" })

    } catch (error) {
        console.log("Error while adding product to wishlist: ", error);
        res.status(500).json({ status: false, messsage: "Server Error" });
    }
}

// ---Remover from wishlist Page ---

const removeFromWishlist = async (req, res) => {
    try {

        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        const index = user.wishlist.indexOf(productId);
        user.wishlist.splice(index, 1);
        await user.save();
        return res.redirect("/wishlist")

    } catch (error) {
        console.log("while product removing from wishlist error: ", error);
        return res.status(500).json({ status: false, message: "Server error" });
    }
}

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
}