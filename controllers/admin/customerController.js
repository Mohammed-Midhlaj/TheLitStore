const User = require("../../models/userSchema");

// ---customer List---

const customerInfo = async (req, res) => {
    try {

        let search = "";
        if (req.query.search) {
            search = req.query.search;
        }
        let page = 1;
        if (req.query.page) {
            page = req.query.page;
        }
        const limit = 4;
        const userData = await User.find({
            isAdmin: false,
            $or: [

                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } },
            ],
        })
            .sort({ createdOn: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const count = await User.find({
            isAdmin: false,
            $or: [

                { name: { $regex: ".*" + search + ".*" } },
                { email: { $regex: ".*" + search + ".*" } },
            ],
        }).countDocuments();

        res.render("customers", {
            data: userData,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });

    } catch (error) {
        res.redirect("/errorpage")
    }
}

// ---Block coustomer---

const customerBlocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } })
        res.redirect('/admin/users')
    } catch (error) {
        res.render("/errorpage")
    }
}

// ---unblock customer---

const customerUnblocked = async (req, res) => {
    try {
        let id = req.query.id;
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } })
        res.redirect('/admin/users')
    } catch (error) {
        res.render("/errorpage");
    }
}


module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked
}