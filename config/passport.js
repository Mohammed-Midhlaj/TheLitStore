const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value.toLowerCase(); 
            let user = await User.findOne({ email });

            if (user) {
                if (user.authType === "email") {
                    return done(null, false, { message: "Use email/password to log in." });
                }
                return done(null, user);
            } else {
                user = new User({
                    name: profile.displayName,
                    email: email, 
                    googleId: profile.id,
                    authType: "google",
                });
                await user.save();
                return done(null, user);
            }
        } catch (error) {
            return done(error, null);
        }
    }
));


passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;