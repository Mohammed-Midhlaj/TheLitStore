const Coupon = require('../../models/couponSchema');

// List all coupons
const listCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdOn: -1 });
        res.render('admin/coupon', { coupons });
    } catch (error) {
        console.error('Error listing coupons:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

// Create new coupon
const createCoupon = async (req, res) => {
    try {
        const { name, offerPrice, minimumPrice, expireOn } = req.body;

        // Validate input
        if (!name || !offerPrice || !minimumPrice || !expireOn) {
            return res.status(400).json({ 
                status: false, 
                message: 'All fields are required' 
            });
        }

        // Enforce max length for coupon name
        if (name.trim().length > 25) {
            return res.status(400).json({
                status: false,
                message: 'Coupon name must be 25 characters or fewer'
            });
        }

        // Check if coupon name already exists
        const existingCoupon = await Coupon.findOne({ name: name.trim() });
        if (existingCoupon) {
            return res.status(400).json({ 
                status: false, 
                message: 'Coupon with this name already exists' 
            });
        }

        // Create new coupon
        const newCoupon = new Coupon({
            name: name.trim(),
            offerPrice,
            minimumPrice,
            expireOn: new Date(expireOn)
        });

        await newCoupon.save();
        res.json({ 
            status: true, 
            message: 'Coupon created successfully',
            coupon: newCoupon
        });
    } catch (error) {
        console.error('Error creating coupon:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({ 
                status: false, 
                message: 'Coupon not found' 
            });
        }

        await Coupon.findByIdAndDelete(couponId);
        res.json({ 
            status: true, 
            message: 'Coupon deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

// Toggle coupon status
const toggleCouponStatus = async (req, res) => {
    try {
        const { couponId } = req.params;
        const coupon = await Coupon.findById(couponId);
        
        if (!coupon) {
            return res.status(404).json({ 
                status: false, 
                message: 'Coupon not found' 
            });
        }

        coupon.isListed = !coupon.isListed;
        await coupon.save();
        
        res.json({ 
            status: true, 
            message: `Coupon ${coupon.isListed ? 'activated' : 'deactivated'} successfully`,
            isListed: coupon.isListed
        });
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

module.exports = {
    listCoupons,
    createCoupon,
    deleteCoupon,
    toggleCouponStatus
}; 