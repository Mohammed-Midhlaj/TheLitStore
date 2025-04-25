const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const passport = require("passport");


// ---Admin page---

const loadLogin = (req, res) => {
    if (!req.session.admin) {
        return res.render('admin-login', { message: null })
    }
    return res.render('/admin');
}

// ---Admin login---

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin) {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (passwordMatch) {
                req.session.admin = true;
                return res.redirect('/admin');
            } else {
                return res.render('admin-login', { message: "incorrect password" });
            }
        } else {
            return res.render("admin-login", { message: "Email not found or not an admin" });
        }
    } catch (error) {
        console.log("Admin login error", error);
        return res.render("admin-login", { message: "An error occured. please try again" });
    }
}

// ---Admin dashboard page---



const loadDashboard = async (req, res) => {
    try {
        console.log("Rendering admin dashboard...");
        res.render("admin/dashboard"); // Ensure "admin/dashboard" matches the folder structure
    } catch (error) {
        console.error("Error rendering admin dashboard:", error);
        res.status(500).send("Dashboard Render Error");
    }
};

// ---Admin logout page---

const logout = async (req, res) => {
    try {
        req.session.destroy(err => { 
            if (err) {
                console.log("Error destroying session", err);
                return res.redirect("/errorPage");
            }
            return res.redirect("/admin/adminlogin");
        })
    } catch (error) {
        console.log("unexpected error during logout", error);
        res.redirect("/errorpage")
    }
}


// ---Admin Error page---

const pageError = async (req, res) => {
    res.render("admin-error");
}



module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
}
