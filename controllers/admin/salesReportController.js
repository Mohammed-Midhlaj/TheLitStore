const Order = require('../../models/orderSchema');
const moment = require('moment');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');

// Get sales report data (filtered)
const getSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate, page = 1, limit = 10 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        
        // Fetch all orders
        const orders = await Order.find({});
        function getOrderDate(o) {
            return o.createdOn ? moment(o.createdOn) : (o.invoiceDate ? moment(o.invoiceDate) : null);
        }
        let filteredOrders = orders;
        if (filterType === 'daily') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'day');
            });
        } else if (filterType === 'weekly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'week');
            });
        } else if (filterType === 'monthly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'month');
            });
        } else if (filterType === 'yearly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'year');
            });
        } else if (filterType === 'custom' && startDate && endDate) {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isBetween(moment(startDate).startOf('day'), moment(endDate).endOf('day'), null, '[]');
            });
        }
        
        const overallSalesCount = filteredOrders.length;
        const overallOrderAmount = filteredOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
        const overallDiscount = filteredOrders.reduce((sum, o) => sum + (o.discount || 0) + (o.couponDiscount || 0), 0);
        
        // Apply pagination
        const paginatedOrders = filteredOrders.slice(skip, skip + limitNum);
        const orderList = paginatedOrders.map(o => ({
            id: o._id,
            date: o.createdOn ? moment(o.createdOn).format('YYYY-MM-DD') : (o.invoiceDate ? moment(o.invoiceDate).format('YYYY-MM-DD') : 'N/A'),
            amount: o.finalAmount,
            discount: o.discount || 0,
            couponDiscount: typeof o.couponDiscount === 'number' ? o.couponDiscount : 0,
            totalDiscount: (o.discount || 0) + (typeof o.couponDiscount === 'number' ? o.couponDiscount : 0)
        }));
        
        // Pagination metadata
        const totalPages = Math.ceil(overallSalesCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;
        
        res.json({
            overallSalesCount,
            overallOrderAmount,
            overallDiscount,
            orderList,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: overallSalesCount,
                itemsPerPage: limitNum,
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (err) {
        console.error('Sales report error:', err);
        res.status(500).json({ error: 'Failed to fetch sales report' });
    }
};

// Download sales report as PDF or Excel
const downloadSalesReport = async (req, res) => {
    try {
        const { type, filterType, startDate, endDate } = req.query;
        // Fetch all orders
        const orders = await Order.find({});
        // Helper to get the order date
        function getOrderDate(o) {
            return o.createdOn ? moment(o.createdOn) : (o.invoiceDate ? moment(o.invoiceDate) : null);
        }
        let filteredOrders = orders;
        if (filterType === 'daily') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'day');
            });
        } else if (filterType === 'weekly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'week');
            });
        } else if (filterType === 'monthly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'month');
            });
        } else if (filterType === 'yearly') {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isSame(moment(), 'year');
            });
        } else if (filterType === 'custom' && startDate && endDate) {
            filteredOrders = orders.filter(o => {
                const d = getOrderDate(o);
                return d && d.isBetween(moment(startDate).startOf('day'), moment(endDate).endOf('day'), null, '[]');
            });
        }

        // Excel
        if (type === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Sales Report');
            
            // Add title
            worksheet.mergeCells('A1:C1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = 'Sales Report';
            titleCell.font = { size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };
            
            // Add filter info
            worksheet.mergeCells('A2:C2');
            const filterCell = worksheet.getCell('A2');
            filterCell.value = `Filter: ${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`;
            filterCell.font = { size: 12 };
            filterCell.alignment = { horizontal: 'center' };
            
            // Add summary
            worksheet.mergeCells('A3:C3');
            const summaryCell = worksheet.getCell('A3');
            const totalAmount = filteredOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
            summaryCell.value = `Total Orders: ${filteredOrders.length} | Total Amount: ₹${totalAmount}`;
            summaryCell.font = { size: 12, bold: true };
            summaryCell.alignment = { horizontal: 'center' };
            
            // Add headers
            worksheet.addRow([]); // Empty row for spacing
            worksheet.columns = [
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Order ID', key: 'id', width: 30 },
                { header: 'Amount (₹)', key: 'amount', width: 15 }
            ];
            
            // Style headers
            worksheet.getRow(5).font = { bold: true };
            worksheet.getRow(5).alignment = { horizontal: 'center' };
            
            // Add data
            filteredOrders.forEach(o => {
                const orderDate = o.createdOn ? moment(o.createdOn) : (o.invoiceDate ? moment(o.invoiceDate) : null);
                worksheet.addRow({
                    date: orderDate ? orderDate.format('YYYY-MM-DD') : 'N/A',
                    id: o._id.toString(),
                    amount: o.finalAmount || 0
                });
            });
            
            // Style amounts
            worksheet.getColumn('amount').numFmt = '₹#,##0.00';
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="sales_report.xlsx"');
            await workbook.xlsx.write(res);
            res.end();
        } else if (type === 'pdf') {
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');
            doc.pipe(res);
            
            // Title
            doc.fontSize(20).text('Sales Report', { align: 'center' });
            doc.moveDown();
            
            // Filter info
            doc.fontSize(12).text(`Filter: ${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`, { align: 'center' });
            doc.moveDown();
            
            // Summary
            const totalAmount = filteredOrders.reduce((sum, o) => sum + (o.finalAmount || 0), 0);
            doc.fontSize(12).text(`Total Orders: ${filteredOrders.length} | Total Amount: ₹${totalAmount}` , { align: 'center' });
            doc.moveDown(2);
            
            // Table layout settings
            const startX = 40;
            const startY = doc.y;
            const colWidths = [100, 300, 100];
            const headers = ['Date', 'Order ID', 'Amount'];
            const colXs = [startX];
            for (let i = 0; i < colWidths.length - 1; i++) {
                colXs.push(colXs[i] + colWidths[i]);
            }
            // Header row
            doc.font('Courier-Bold').fontSize(11);
            for (let i = 0; i < headers.length; i++) {
                doc.text(headers[i], colXs[i], startY, { width: colWidths[i], align: 'left' });
            }
            // Draw header line
            doc.moveTo(startX, startY + 15).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), startY + 15).stroke();
            let y = startY + 20;
            doc.font('Courier').fontSize(10);
            filteredOrders.forEach(o => {
                const orderDate = o.createdOn ? moment(o.createdOn) : (o.invoiceDate ? moment(o.invoiceDate) : null);
                const row = [
                    orderDate ? orderDate.format('YYYY-MM-DD') : 'N/A',
                    o._id.toString(),
                    `₹${(o.finalAmount || 0).toFixed(2)}`
                ];
                for (let i = 0; i < row.length; i++) {
                    doc.text(row[i], colXs[i], y, { width: colWidths[i], align: 'left' });
                }
                // Draw line after each row
                doc.moveTo(startX, y + 13).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y + 13).strokeColor('#eee').stroke();
                y += 18;
                // Add new page if needed
                if (y > doc.page.height - 50) {
                    doc.addPage();
                    y = 40;
                }
            });
            doc.end();
        } else {
            res.status(400).json({ error: 'Invalid download type' });
        }
    } catch (err) {
        console.error('Download sales report error:', err);
        res.status(500).json({ error: 'Failed to download sales report' });
    }
};

// Analytics Dashboard: Top 10 best selling products, categories, brands
const getAnalyticsDashboard = async (req, res) => {
    try {
        // Top 10 Products
        const topProductsAgg = await Order.aggregate([
            { $unwind: "$orderedItem" },
            { $group: {
                _id: "$orderedItem.product",
                totalSold: { $sum: "$orderedItem.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "product"
            }},
            { $unwind: "$product" },
            { $lookup: {
                from: "categories",
                localField: "product.category",
                foreignField: "_id",
                as: "category"
            }},
            { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
            { $project: {
                _id: 1,
                totalSold: 1,
                productName: "$product.productName",
                brand: "$product.brand",
                categoryName: "$category.name"
            }}
        ]);

        // Top 10 Categories
        const topCategoriesAgg = await Order.aggregate([
            { $unwind: "$orderedItem" },
            { $lookup: {
                from: "products",
                localField: "orderedItem.product",
                foreignField: "_id",
                as: "product"
            }},
            { $unwind: "$product" },
            { $group: {
                _id: "$product.category",
                totalSold: { $sum: "$orderedItem.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "category"
            }},
            { $unwind: "$category" },
            { $project: {
                _id: 1,
                totalSold: 1,
                categoryName: "$category.name"
            }}
        ]);

        // Top 10 Brands (brand is a string in product)
        const topBrandsAgg = await Order.aggregate([
            { $unwind: "$orderedItem" },
            { $lookup: {
                from: "products",
                localField: "orderedItem.product",
                foreignField: "_id",
                as: "product"
            }},
            { $unwind: "$product" },
            { $group: {
                _id: "$product.brand",
                totalSold: { $sum: "$orderedItem.quantity" }
            }},
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);

        res.render('admin/dashboard-analytics', {
            topProducts: topProductsAgg,
            topCategories: topCategoriesAgg,
            topBrands: topBrandsAgg
        });
    } catch (err) {
        console.error('Analytics dashboard error:', err);
        res.status(500).send('Failed to load analytics dashboard');
    }
};

module.exports = {
    getSalesReport,
    downloadSalesReport,
    getAnalyticsDashboard
}; 