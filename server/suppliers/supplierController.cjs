const { pool } = require('../config/database.cjs');
const fs = require('fs').promises;
const path = require('path');

// Get all suppliers with pagination and filtering
const getSuppliers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10000, 
      search = '', 
      products = '' 
    } = req.query;

    const limitNum = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Search functionality
    if (search) {
      whereClause += ` AND (
        supplier_name LIKE ? OR 
        contact_person LIKE ? OR 
        phone_number LIKE ? OR 
        email LIKE ? OR
        JSON_SEARCH(products_supplied, 'one', ?) IS NOT NULL
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Product filtering
    if (products) {
      const productList = products.split(',').map(p => p.trim());
      const productConditions = productList.map(() => 'JSON_SEARCH(products_supplied, "one", ?) IS NOT NULL').join(' OR ');
      whereClause += ` AND (${productConditions})`;
      params.push(...productList);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM suppliers ${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    const totalRecords = countResult[0].total;

    // Main query
    const mainQuery = `
      SELECT 
        id,
        supplier_name,
        contact_person,
        phone_number,
        email,
        address,
        notes,
        supplier_image,
        products_supplied,
        created_at,
        updated_at
      FROM suppliers
      ${whereClause}
      ORDER BY supplier_name ASC, created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [suppliers] = await pool.execute(mainQuery, params);

    // Parse JSON fields with error handling
    const processedSuppliers = suppliers.map(supplier => {
      let products_supplied = [];

      if (supplier.products_supplied) {
        try {
          // Try to parse as JSON first
          products_supplied = JSON.parse(supplier.products_supplied);
        } catch (error) {
          // If JSON parsing fails, try to handle as comma-separated string
          if (typeof supplier.products_supplied === 'string') {
            products_supplied = supplier.products_supplied
              .split(',')
              .map(item => item.trim())
              .filter(item => item.length > 0);
          }
        }
      }

      return {
        ...supplier,
        products_supplied
      };
    });

    res.json({
      success: true,
      suppliers: processedSuppliers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers',
      error: error.message
    });
  }
};

// Create new supplier
const createSupplier = async (req, res) => {
  try {
    const {
      supplier_name,
      contact_person,
      phone_number,
      email,
      address,
      notes,
      products_supplied
    } = req.body;

    // Validate required fields
    if (!supplier_name || !contact_person || !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'Supplier name, contact person, and phone number are required'
      });
    }

    // Handle image upload
    let supplier_image = null;
    if (req.files && req.files.supplier_image) {
      supplier_image = req.files.supplier_image[0].filename;
    }

    // Parse products_supplied if it's a string
    let parsedProducts = [];
    if (products_supplied) {
      try {
        parsedProducts = typeof products_supplied === 'string' 
          ? JSON.parse(products_supplied) 
          : products_supplied;
      } catch (e) {
        parsedProducts = [];
      }
    }

    const query = `
      INSERT INTO suppliers (
        supplier_name, 
        contact_person, 
        phone_number, 
        email, 
        address, 
        notes, 
        supplier_image, 
        products_supplied
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      supplier_name,
      contact_person,
      phone_number,
      email || null,
      address || null,
      notes || null,
      supplier_image,
      JSON.stringify(parsedProducts)
    ];

    const [result] = await pool.execute(query, values);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      supplier: {
        id: result.insertId,
        supplier_name,
        contact_person,
        phone_number,
        email,
        address,
        notes,
        supplier_image,
        products_supplied: parsedProducts
      }
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create supplier',
      error: error.message
    });
  }
};

// Update supplier
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier_name,
      contact_person,
      phone_number,
      email,
      address,
      notes,
      products_supplied
    } = req.body;

    // Check if supplier exists
    const [existingSupplier] = await pool.execute(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Handle image upload
    let supplier_image = existingSupplier[0].supplier_image;
    if (req.files && req.files.supplier_image) {
      // Delete old image if it exists
      if (supplier_image) {
        try {
          await fs.unlink(path.join(__dirname, 'images', supplier_image));
        } catch (error) {
          console.log('Old image not found or already deleted');
        }
      }
      supplier_image = req.files.supplier_image[0].filename;
    }

    // Parse products_supplied if it's a string
    let parsedProducts = [];
    if (products_supplied) {
      try {
        parsedProducts = typeof products_supplied === 'string' 
          ? JSON.parse(products_supplied) 
          : products_supplied;
      } catch (e) {
        parsedProducts = [];
      }
    }

    const query = `
      UPDATE suppliers SET 
        supplier_name = ?, 
        contact_person = ?, 
        phone_number = ?, 
        email = ?, 
        address = ?, 
        notes = ?, 
        supplier_image = ?, 
        products_supplied = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      supplier_name,
      contact_person,
      phone_number,
      email || null,
      address || null,
      notes || null,
      supplier_image,
      JSON.stringify(parsedProducts),
      id
    ];

    await pool.execute(query, values);

    res.json({
      success: true,
      message: 'Supplier updated successfully'
    });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update supplier',
      error: error.message
    });
  }
};

// Delete supplier
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const [existingSupplier] = await pool.execute(
      'SELECT supplier_image FROM suppliers WHERE id = ?',
      [id]
    );

    if (existingSupplier.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    // Delete supplier image if it exists
    if (existingSupplier[0].supplier_image) {
      try {
        await fs.unlink(path.join(__dirname, 'images', existingSupplier[0].supplier_image));
      } catch (error) {
        console.log('Image file not found or already deleted');
      }
    }

    // Delete supplier from database
    await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Supplier deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete supplier',
      error: error.message
    });
  }
};

module.exports = {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
