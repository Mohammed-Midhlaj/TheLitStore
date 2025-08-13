const User = require("../models/userSchema");

// --userAuth middleare --

const userAuth = (req, res, next) => {
    if (req.session.userData) {
        User.findById(req.session.userData._id)
            .then(data => {
                if (data && !data.isBlocked) {
                    req.session.userData = {
                        _id: data._id,
                        name: data.name,
                        email: data.email,
                        phone:data.phone,
                    };
                    next();
                } else {
                    res.redirect("/login");
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware", error);
                res.status(500).send("Internal Server Error");
            })
    } else {
        res.redirect("/login")
    }
}

// --userAuth middleare --


const adminAuth = (req, res, next) => {
    // Check if admin session exists
    if (!req.session.admin) {
        return res.redirect("/admin/adminlogin");
    }
    
    // Verify admin session is valid
    if (req.session.admin === true) {
        next();
    } else {
        // Clear invalid session and redirect to login
        req.session.destroy((err) => {
            if (err) {
                console.log("Error destroying invalid admin session:", err);
            }
            res.redirect("/admin/adminlogin");
        });
    }
}


module.exports = {
    userAuth,
    adminAuth,
}