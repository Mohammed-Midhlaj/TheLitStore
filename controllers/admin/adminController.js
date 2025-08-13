const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const passport = require("passport");


// ---Admin page---

const loadLogin = (req, res) => {
    if (!req.session.admin) {
        return res.render('admin-login', { message: null })
    }
    return res.redirect('/admin');
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
        // Clear admin session
        req.session.admin = null;
        
        // Destroy the entire session
        req.session.destroy(err => { 
            if (err) {
                console.log("Error destroying session", err);
                return res.redirect("/admin/errorpage");
            }
            
            // Clear any cookies and set cache control headers
            res.clearCookie('connect.sid');
            res.set({
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            
            return res.redirect("/admin/adminlogin");
        });
    } catch (error) {
        console.log("Unexpected error during logout", error);
        res.redirect("/admin/errorpage");
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
