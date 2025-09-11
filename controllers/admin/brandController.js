const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

// ---Brand page---

const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
        const brandData = await Brand.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
        const reverseBrand = brandData.reverse();
        res.render('brands', {
            data: reverseBrand,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        })

    } catch (error) {
        res.redirect("/errorpage");
    }
}

// ---Add Brand---

const addBrand = async (req, res) => {
    try {

        const brand = (req.body.name || '').trim();
        // Length validation
        if (!brand) {
            return res.status(400).json({ status: false, message: 'Brand name is required' });
        }
        if (brand.length > 30) {
            return res.status(400).json({ status: false, message: 'Brand name must be 30 characters or fewer' });
        }
        const findBrand = await Brand.findOne({ brandName: brand });
        if (findBrand) {
            return res.status(400).json({ status: false, message: 'Brand already exists' });
        }
        if (!req.file || !req.file.filename) {
            return res.status(400).json({ status: false, message: 'Brand image is required' });
        }
        const image = req.file.filename;
        const newBrand = new Brand({
            brandName: brand,
            brandImage: image,
        })
        await newBrand.save();
        return res.json({ status: true, message: 'Brand added successfully', brand: newBrand });

    } catch (error) {
        console.log('Error adding brand:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
}

// ---Block Brand page---

const blockBrand = async (req, res) => {
    try {

        const id = req.query.id;
        const updated = await Brand.findByIdAndUpdate(id, { $set: { isBlocked: true } }, { new: true });
        if (!updated) {
            return res.status(404).json({ status: false, message: 'Brand not found' });
        }
        return res.json({ status: true, message: 'Blocked successfully', isBlocked: true, brandId: id });

    } catch (error) {
        console.log('Error blocking brand:', error);
        res.status(500).json({ status: false, message: 'Internal server error' })
    }
}

// ---UnBlock Brand---

const unblockBrand = async (req, res) => {
    try {

        const id = req.query.id;
        const updated = await Brand.findByIdAndUpdate(id, { $set: { isBlocked: false } }, { new: true });
        if (!updated) {
            return res.status(404).json({ status: false, message: 'Brand not found' });
        }
        return res.json({ status: true, message: 'Unblocked successfully', isBlocked: false, brandId: id });

    } catch (error) {
        console.log('Error unblocking brand:', error);
        res.status(500).json({ status: false, message: 'Internal server error' })
    }
}

// ---Delete Brand---

const deleteBrand = async (req, res) => {
    try {

        const {id} = req.query;
        if(!id){
            return res.status(400).json({ status: false, message: 'Brand id is required' });
        }
        const result = await Brand.deleteOne({_id:id});
        if (result.deletedCount === 0) {
            return res.status(404).json({ status: false, message: 'Brand not found' });
        }
        return res.json({ status: true, message: 'Brand deleted successfully', brandId: id });

    } catch (error) {
        console.log("Error During Deleting: ",error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
}

module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand,
}