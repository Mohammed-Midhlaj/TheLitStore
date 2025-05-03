const { Session } = require("express-session");
const User = require("../../models/userSchema");
const Address = require("../../models/addressSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { render } = require("ejs");
const env = require("dotenv").config(); 


function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]; 
    }
    return otp;
}

const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        })

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Your OTP for password reset",
            text: `Your OTP is ${otp}`,
            html: `<b><h4>Your OTP: ${otp}</h4></b>`
        }

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sentt: ", info.messageId);
        return true;

    } catch (error) {
        console.log("Error sending Email: ", error);
        return false;
    }

}

const securePassword = async (password) => {
    try {

        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;

    } catch (error) {
        console.error("Error hashing password:", error);
        throw error;
    }
}

// ---Forgot Password page---

const getForgotPasswordPage = async (req, res) => {
    try {
        res.render("forgot-password")
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

// ---Forgot Password Email Validate---

const forgotEmailValid = async (req, res) => {
    try {

        const { email } = req.body;
        const findUser = await User.findOne({ email: email })
        if (findUser) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgot-pass-otp");
                console.log("ForgotPassword OTP: ", otp);
            } else {
                res.json({ success: false, message: "Failed to sent OTP. Please try again" });
            }
        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist"
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

// ---OTP verification forgot password---

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const storedOtp = req.session.userOtp;

        if (!storedOtp) {
            return res.json({ success: false, message: "OTP expired or not found. Please resend OTP." });
        }

        if (enteredOtp === storedOtp) {

            res.json({ success: true, redirectUrl: "/reset-password" });
        } else {
            res.json({ success: false, message: "OTP not matching" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "An error occurred. Please try again." });
    }
};

// ---Reset Password page---

const getResetPassPage = async (req, res) => {
    try {
        res.render("reset-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

// ---Resend OTP---

const resendOtp = async (req, res) => {
    try {

        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email: ", email);
        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resend OTP: ", otp);
            res.status(200).json({ success: true, message: "Resend OTP succesfully" });
        }

    } catch (error) {
        console.log("Error sending resend OTP: ", error);
        res.status(500).json({ success: false, message: "Intermal Server Error" });
    }
}

// ---New Password---

const postNewPassword = async (req, res) => {
    try {

        const { newPass1, newPass } = req.body;
        const email = req.session.email;
        if (newPass1 == newPass) {
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                { email: email },
                { $set: { password: passwordHash } }
            )
            res.redirect("/login");
        } else {
            res.render("reset-password", { message: 'Password do not match' });
        }

    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

// ---userProfile page---

const userProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        
        res.render("profile", {
            user: userData,
            isAuthenticated: true
        });
    } catch (error) {
        console.log("Error loading profile page:", error);
        res.redirect('/pageNotFound');
    }
}

// ---Edit userProfile page---

const editUserProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        res.render("edit-profile", {
            user: user,
            isAuthenticated: true
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

// ---Edit userProfile page---

const postEditProfile = async (req, res) => {
    try {

        const data = req.body;
        const userId = req.query.id;
        const findUser = await User.findOne({ _id: userId });
        if (!findUser) {
            return res.redirect("/pageNotFound");
        }
        await User.updateOne(
            { _id: userId },
            {
                $set: {
                    name: data.name,
                    phone: data.phone,
                }
            }
        );
        res.json({ success: true, redirect: '/userProfile' });

    } catch (error) {
        console.log("Error occured while editing profile: ", error);
        res.redirect("/pageNotFound");
    }
}

// ---User Email Change---

const changeEmail = async (req, res) => {
    try {
        res.render("change-email")
    } catch (error) {
        res.redirect("pageNotFound")
    }
}

// ---User Email Change validation---

const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user;

        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userId = userId;
                req.session.currentEmail = email;
                res.render("change-email-otp");
                console.log("Email Sent: ", email);
                console.log("OTP in session: ", req.session.userOtp);
                console.log("Email Change OTP: ", otp);
            } else {
                res.render("change-email", {
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.render("change-email", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.log("Error in email change validation: ", error);
        res.redirect("/pageNotFound");
    }
}

// ---User Email Change OTP verification---

const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const userId = req.session.userId;
        const currentEmail = req.session.currentEmail;

        if (!userId || !currentEmail) {
            return res.render("change-email", {
                message: "Session expired. Please try again."
            });
        }

        if (!enteredOtp) {
            return res.render("change-email-otp", {
                message: "Please enter the OTP"
            });
        }

        if (enteredOtp === req.session.userOtp) {
            res.render("new-email", {
                currentEmail: currentEmail
            });
        } else {
            res.render("change-email-otp", {
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.log("Error in OTP verification: ", error);
        res.render("change-email-otp", {
            message: "An error occurred. Please try again."
        });
    }
}

// ---User new Email---

const updateEmail = async (req, res) => {
    try {
        const newEmail = req.body.newEmail;
        const userId = req.session.userId;

        if (!userId) {
            return res.render("change-email", {
                message: "Session expired. Please try again."
            });
        }

        // Check if new email already exists
        const emailExists = await User.findOne({ email: newEmail });
        if (emailExists) {
            return res.render("new-email", {
                message: "This email is already registered. Please use a different email.",
                currentEmail: req.session.currentEmail
            });
        }

        await User.findByIdAndUpdate(userId, { email: newEmail });
        req.session.userId = null;
        req.session.currentEmail = null;
        req.session.userOtp = null;
        
        res.redirect("/userProfile");
    } catch (error) {
        console.log("Error updating email: ", error);
        res.redirect("/pageNotFound");
    }
}

// ---Password Change---

const changePassword = async (req, res) => {
    try {
        res.render("change-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

// ---Password Change Validate---

const changePasswordValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.render("change-password", {
                message: "Session expired. Please try again."
            });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email, otp);

            if (emailSent) {
                req.session.userOtp = otp;
                req.session.userId = userId;
                req.session.currentEmail = email;
                res.render("change-password-otp");
                console.log("Password Change OTP: ", otp);
            } else {
                res.render("change-password", {
                    message: "Failed to send OTP. Please try again."
                });
            }
        } else {
            res.render("change-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.log("Error in password change validation: ", error);
        res.render("change-password", {
            message: "An error occurred. Please try again."
        });
    }
}

// ---Password Change Verify---

const verifyChangePasswordOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        const userId = req.session.userId;
        const currentEmail = req.session.currentEmail;

        if (!userId || !currentEmail) {
            return res.render("change-password", {
                message: "Session expired. Please try again."
            });
        }

        if (!enteredOtp) {
            return res.render("change-password-otp", {
                message: "Please enter the OTP"
            });
        }

        if (enteredOtp === req.session.userOtp) {
            res.render("reset-password", {
                currentEmail: currentEmail
            });
        } else {
            res.render("change-password-otp", {
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.log("Error in OTP verification: ", error);
        res.render("change-password-otp", {
            message: "An error occurred. Please try again."
        });
    }
}

// ---Address Page---

const loadAddressPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const userAddress = await Address.findOne({ userId: userId });
        res.render("address", { 
            user,
            userAddress,
            isAuthenticated: true 
        });
    } catch (error) {
        console.log("Error loading address page: ", error);
        res.redirect('/pageNotFound');
    }
}

// ---Add Address Page---

const addAddress = async (req, res) => {
    try {

        const user = req.session.user;
        res.render("add-address", { user: user });

    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

// ---Add Address---

const postAddAddress = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            })
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }

        res.json({ success: true, redirect: '/address' });

    } catch (error) {
        console.log("Error adding address: ", error);
        res.redirect("/pageNotFound")
    }
}

// ---Edit Address---

const editAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            userId: user,
            "address._id": addressId,
        });

        if (!currAddress) {
            return res.redirect('/pageNotFound');
        }
        const addressData = currAddress.address.find((item) => {
            return item._id.toString() === addressId.toString();
        })

        if (!addressData) {
            return res.redirect("/pageNotFound")
        }

        res.render("edit-address", { address: addressData, user: user });

    } catch (error) {
        console.log("Error in edit addresss: ", error);
        res.redirect('/pageNotFound')
    }
}

// ---Editing Address---

const postEditAddress = async (req, res) => {
    try {

        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({ "address._id": addressId });

        if (!findAddress) {
            return res.redirect("/pageNotfound")
        }
        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.addressType": data.addressType,
                    "address.$.name": data.name,
                    "address.$.city": data.city,
                    "address.$.landMark": data.landMark,
                    "address.$.state": data.state,
                    "address.$.pincode": data.pincode,
                    "address.$.phone": data.phone,
                    "address.$.altPhone": data.altPhone,
                }
            }
        )
        res.json({ success: true, redirect: '/address' });

    } catch (error) {
        console.log("Error Ocuured while editiing address: ", error);
        return res.redirect("/pageNotFound")
    }
}

// ---Delete Address---

const deleteAddress = async (req, res) => {
    try {

        const addressId = req.query.id;
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
            return res.status(404).send('Address not found');
        }
        await Address.updateOne(
            { "address._id": addressId },
            {
                $pull: {
                    address: {
                        _id: addressId,
                    }
                }
            }
        )
        res.redirect("/address");

    } catch (error) {
        console.log("Error occured while deleting address: ", error);
        return res.redirect('/pageNotFound');
    }
}

const updateProfileImage = async (req, res) => {
    try {
        const { profileImage } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.json({ success: false, message: "Session expired" });
        }

        await User.findByIdAndUpdate(userId, { profileImage });
        res.json({ success: true, message: "Profile image updated successfully" });
    } catch (error) {
        console.log("Error updating profile image: ", error);
        res.json({ success: false, message: "Failed to update profile image" });
    }
}

module.exports = {
    getForgotPasswordPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendOtp,
    postNewPassword,
    userProfile,
    editUserProfile,
    postEditProfile,
    changeEmail,
    changeEmailValid,
    verifyEmailOtp,
    updateEmail,
    changePassword,
    changePasswordValid,
    verifyChangePasswordOtp,
    loadAddressPage,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
    updateProfileImage,
}