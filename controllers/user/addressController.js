const loadAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addresses = await Address.find({ userId });
        
        res.render("address", {
            user: userData,
            addresses,
            isAuthenticated: true
        });
    } catch (error) {
        console.log("Error loading address page:", error);
        res.redirect('/pageNotFound');
    }
} 