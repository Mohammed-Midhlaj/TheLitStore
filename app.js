const express = require('express');
const path = require("path");
const env = require("dotenv").config();
const session = require("express-session");
const passport = require("./config/passport");
const db = require("./config/db");
const userRouter = require("./routes/userRouter");
const adminRouter = require("./routes/adminRouter");
const paymentRouter = require("./routes/user/paymentRoutes");
db();

const app = express();
 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true, 
        maxAge: 72 * 60 * 60 * 1000
    }
}))

app.use((req, res, next) => {
    res.locals.userData = req.session.userData || null;
    next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.set('cache-control', 'no-store')
    next() 
})

app.set("view engine", "ejs");
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin"), path.join(__dirname, "views")]);
app.use(express.static(path.join(__dirname, "public")));

app.use('/', userRouter);
app.use('/admin',adminRouter);
app.use('/', paymentRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {  
    console.log(`Server running on port ${PORT}`);
});

 
module.exports = app;     