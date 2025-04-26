const User = require("../../models/userSchema");
const Product = require('../../models/productSchema');


// ---Load Wishlist Page ---

const loadWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findById(user);
        const products = await Product.find({ _id: { $in: userData.wishlist } });
        
        res.render("wishlist", {
            user: userData,
            products,
            isAuthenticated: true
        });
    } catch (error) {
        console.log("Error loading wishlist:", error);
        res.redirect('/pageNotFound');
    }
}

// ---Add to wishlist Page ---

const addToWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.body.productId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found"
            });
        }

        if (user.wishlist.includes(productId)) {
            return res.status(409).json({ 
                success: true, 
                message: "Product already in wishlist",
                isInWishlist: true
            });
        }

        user.wishlist.push(productId);
        await user.save();
        
        return res.status(200).json({ 
            success: true, 
            message: "Product added to wishlist",
            isInWishlist: true
        });

    } catch (error) {
        console.log("Error while adding product to wishlist: ", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server Error"
        });
    }
}

// ---Remove from wishlist Page ---

const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        const index = user.wishlist.indexOf(productId);
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "Product not found in wishlist" 
            });
        }

        user.wishlist.splice(index, 1);
        await user.save();
        
        return res.status(200).json({ 
            success: true, 
            message: "Product removed from wishlist" 
        });

    } catch (error) {
        console.log("Error removing product from wishlist: ", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
}

module.exports = {
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
}