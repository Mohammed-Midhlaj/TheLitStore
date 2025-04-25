const { Session } = require("express-session");
const User = require("../../models/userSchema");
const Category = require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand = require("../../models/brandSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { session } = require("passport");
const env = require("dotenv").config();

// ---Home page---

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.userData;

        const categories = await Category.find({ isListed: true });
        let productData = await Product.find(
            {
                isBlocked: false,
                category: { $in: categories.map(category => category._id) }, quantity: { $gt: 0 }
            }
        )
        console.log(user)

        productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        productData = productData.slice(0, 5);

        if (user) {
            const userData = await User.findOne({ _id: user._id });
            res.render("home", { user: userData, products: productData });
        } else {
            return res.render('home', { products: productData });
        }
    } catch (error) {
        console.log("Home Page Not Found", error)
        res.status(500).redirect("/pageNotFound")
    }
}

// ---Signup page---

const loadSignup = async (req, res) => {
    try {
        res.render("signup");
    } catch (error) {
        console.log("Sign Up page Loading Error", error)
        res.status(500).redirect("/pageNotFound")
    }
}

// ---Register page---

const loadRegisterpage = async (req, res) => {
    try {
        res.render("register")
    } catch (error) {
        console.log("Register Page Loading Error", error);
        res.status(500).redirect('/pageNotFound');

    }
}

// ---Register otp generation---

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        })

        return info.accepted.length > 0;

    } catch (error) {
        console.error("Error sending email,", error);
        return false;
    }
}

// ---user registration---

const register = async (req, res) => {
    try {
        const { name, email, phone, password, cPassword } = req.body;
        console.log("Registration attempt with password:", password);

      
        const normalizedEmail = email.toLowerCase();

        if (password != cPassword) {
            return res.render("register", { message: "Password do not match" });
        }

        
        const findUser = await User.findOne({ email: normalizedEmail });
        if (findUser) {
          
            if (findUser.authType === "google") {
                return res.render("register", { message: "This email is already registered with Google. Please use Google login." });
            } else {
                return res.render("register", { message: "Email already exists" });
            }
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(normalizedEmail, otp);
        if (!emailSent) {
            return res.render("register", { message: "Failed to send verification email" });
        }

        req.session.otp = otp;
        req.session.otpExpiresAt = Date.now() + 60000;
        req.session.userData = { 
            name, 
            email: normalizedEmail, 
            phone, 
            password 
        };

        res.render("verify-otp");
        console.log("OTP Sent :", otp);
    } catch (error) {
        console.log("Register Error", error);
        res.redirect("/pageNotFound");
    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const storedOTP = req.session.otp;
        const userData = req.session.userData;
        const otpExpiresAt = req.session.otpExpiresAt;

        console.log("Received OTP from user:", otp);
        console.log("Stored OTP in session:", req.session.otp);
        console.log("Stored User Data:", req.session.userData);

        if (Date.now() > otpExpiresAt) {
            return res.status(400).json({
                status: 'error',
                message: 'OTP has expired. Please request a new one.'
            });
        }

        if (otp !== storedOTP) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid OTP. Please try again.'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);

        const saveUserData = new User({
            name: userData.name,
            phone: userData.phone,
            email: userData.email,
            password: hashedPassword,
            isVerified: true
        });

        await saveUserData.save();

        req.session.otp = null;
        req.session.userData = null;
        req.session.otpExpiresAt = null;

        return res.status(200).json({
            status: 'success',
            message: 'Account verified successfully!',
            redirectUrl: '/login'
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to verify OTP.'
        });
    }
};

const resendOtp = async (req, res) => {
    try {
        const userData = req.session.userData;

        if (!userData || !userData.email) {
            return res.status(400).json({
                success: false,
                message: "Email not found in session. Please start registration again."
            });
        }

        const otp = generateOtp();

        req.session.otp = otp;
        req.session.otpExpiresAt = Date.now() + 60000;

        const emailSent = await sendVerificationEmail(userData.email, otp);

        if (emailSent) {
            console.log("Resend OTP : ", otp);
            return res.status(200).json({
                success: true,
                message: "OTP Resent Successfully"
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "Failed to resend OTP. Please try again"
            });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error. Please try again"
        });
    }
};

// ---login page---

const loadloginpage = async (req, res) => {
    try {
        if (req.session.userData) {
            return res.redirect('/');
        } else {
            return res.render("login");
        }
    } catch (error) {
        console.log("Login Page Loading Error", error);
        res.status(500).redirect("/pageNotFound")
    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const findUser = await User.findOne({ isAdmin: 0, email: email });

        
        console.log("Login attempt for email:", email);
        console.log("User found:", findUser);

        if (!findUser) {
            return res.render('login', { message: "User not found" });
        }

        if (findUser.authType === "google") {
            return res.render('login', { message: "Please log in using Google" });
        }

        if (findUser.isBlocked) {
            return res.render('login', { message: "User is blocked by admin" });
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);
        console.log("Password match:", passwordMatch);

        if (!passwordMatch) {
            return res.render('login', { message: "Password incorrect" });
        }

        req.session.user = findUser._id;
        req.session.userData = {
            _id: findUser._id,
            email: findUser.email,
            name: findUser.name
        };

        return res.redirect("/");

    } catch (error) {
        console.log("Error Login", error);
        return res.render('login', { message: "Login failed. Please try again later" });
    }
}

// ---logout ---

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Session destroty error", err.message);
                return res.redirect('/pageNotFound');
            }
            return res.redirect('/login');
        })
    } catch (error) {
        console.log("Logout error", error);
        res.redirect('/pageNotFound');
    }
}


// ---Shopping Page ---

const loadShoppingPage = async (req, res) => {
    try {

        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 16;
        const skip = (page - 1) * limit;
        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 }
        }).sort({ createdAt: -1 }).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 }
        })
        const totalPages = Math.ceil(totalProducts / limit);

        const brands = await Brand.find({ isBlocked: false });
        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }));

        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithIds,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages
        });

    } catch (error) {
        console.log("error loading shopping page: ", error)
        res.redirect("/pageNotFound");
    }
}

// --Filter Page--

const filterProducts = async (req, res) => {
    try {

        const user = req.session.user || null;
        const category = req.query.category;
        const findCategory = category ? await Category.findOne({ _id: category }) : null;
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 },
        }

        if (findCategory) {
            query.category = findCategory._id;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const categories = await Category.find({ isListed: true })

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);
        let userData = null;
        if (user) {
            userData = await User.findOne({ _id: user });
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    searchedOn: new Date(),
                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProduct = currentProduct;

        res.render("shop", {

            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
        })

    } catch (error) {
        console.log("error loading filterPage", error);
        res.redirect('/pageNotFound');
    }
}

// --Filter By Price--

const filterByPrice = async (req, res) => {
    try {

        const user = req.session.user || null;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });

        let minPrice = Number(req.query.gt);
        let maxPrice = Number(req.query.lt);

        let findProducts = await Product.find({
            salePrice: { $gt: minPrice, $lt: maxPrice },
            isBlocked: false,
            quantity: { $gt: 0 },
        }).lean();

        findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);
        req.session.filteredProduct = findProducts;

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage
        })

    } catch (error) {
        console.log("error loading filterbyPrice: ", error);
        res.redirect("/pageNotFound");
    }
}

// ---search products---

const searchProducts = async (req, res) => {
    try {

        const user = req.session.user || null;
        const userData = await User.findOne({ _id: user });
        let search = req.body.query;

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());
        let searchResult = [];
        if (req.session.filteredProduct && req.session.filteredProduct.length > 0) {
            searchResult = req.session.filteredProduct.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
            )
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            }).lean()
        }

        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render("shop", {
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            count: searchResult.length,
        })

    } catch (error) {
        console.log("Error in search: ", error);
        res.redirect("/pageNotFound");
    }
}

// ---404 page---

const pageNotFound = async (req, res) => {
    try {
        res.render('page-404')
    } catch (error) {
        console.log("Page-404 Loading Error", error)
        res.status(500).redirect("/pageNotFound")
    }
}


module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadRegisterpage,
    register,
    verifyOtp,
    resendOtp,
    loadloginpage,
    login,
    logout,
    loadShoppingPage,
    filterProducts,
    filterByPrice,
    searchProducts
} 