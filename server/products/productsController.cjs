const { pool } = require('../config/database.cjs');
const { deleteUploadedFiles, renameFilesWithProductId, getImageUrl, imagesDir } = require('./imageUpload.cjs');
const path = require('path');
const fs = require('fs');

// Get all categories for dropdown
const getCategories = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [categories] = await connection.execute(`
      SELECT id, name, description, is_active
      FROM categories 
      WHERE is_active = 1
      ORDER BY name ASC
    `);

    connection.release();

    res.json({
      success: true,
      data: categories,
      message: 'Categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
      error: error.message
    });
  }
};

// Get all products with category information
const getProducts = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const [products] = await connection.execute(`
      SELECT
        p.id,
        p.name,
        p.category_id,
        c.name as category_name,
        p.sub_category,
        p.unit,
        p.market_price,
        p.retail_price,
        p.caterer_price,
        p.description,
        p.product_images,
        p.is_active,
        p.created_at,
        p.updated_at,
        COALESCE(inv.total_quantity, 0) as available_quantity,
        COALESCE(inv.total_value, 0) as inventory_value,
        COALESCE(inv.average_cost_per_kg, 0) as average_cost_per_kg
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory_summary inv ON p.id = inv.product_id
      ORDER BY p.created_at DESC
    `);

    connection.release();

    res.json({
      success: true,
      data: products,
      message: 'Products retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

// Create new product with image upload
const createProduct = async (req, res) => {
  try {
    const {
      name,
      categoryId,
      subCategory,
      unit,
      marketPrice,
      retailPrice,
      catererPrice,
      description,
      isActive
    } = req.body;

    // Get uploaded files
    const uploadedFiles = req.files || [];

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }

    if (!categoryId) {
      // Delete uploaded files if validation fails
      deleteUploadedFiles(uploadedFiles);
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product image is required'
      });
    }

    const connection = await pool.getConnection();

    // Check if category exists
    const [categoryExists] = await connection.execute(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );

    if (categoryExists.length === 0) {
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist'
      });
    }

    // Check if product with same name already exists
    const [existingProduct] = await connection.execute(
      'SELECT id FROM products WHERE name = ?',
      [name.trim()]
    );

    if (existingProduct.length > 0) {
      connection.release();
      // Delete uploaded files if product already exists
      deleteUploadedFiles(uploadedFiles);
      return res.status(409).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }

    // Insert new product first to get the product ID
    const [result] = await connection.execute(`
      INSERT INTO products (
        name,
        category_id,
        sub_category,
        unit,
        market_price,
        retail_price,
        caterer_price,
        description,
        product_images,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name.trim(),
      categoryId,
      subCategory ? subCategory.trim() : null,
      unit || 'kg',
      marketPrice || null,
      retailPrice || null,
      catererPrice || null,
      description ? description.trim() : null,
      JSON.stringify([]), // Temporary empty array, will update after renaming files
      isActive === '1' || isActive === 'true' || isActive === true ? 1 : 0
    ]);

    const productId = result.insertId;

    // Rename uploaded files with product ID
    const renamedFiles = renameFilesWithProductId(uploadedFiles, productId);
    const imageUrls = renamedFiles.map(filename => getImageUrl(filename));

    // Update product with correct image URLs
    await connection.execute(
      'UPDATE products SET product_images = ? WHERE id = ?',
      [JSON.stringify(imageUrls), productId]
    );

    // Get the created product with category information
    const [newProduct] = await connection.execute(`
      SELECT
        p.id,
        p.name,
        p.category_id,
        c.name as category_name,
        p.sub_category,
        p.unit,
        p.market_price,
        p.retail_price,
        p.caterer_price,
        p.description,
        p.product_images,
        p.is_active,
        p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [productId]);

    connection.release();

    res.status(201).json({
      success: true,
      data: newProduct[0],
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error);
    // Clean up uploaded files if there was an error
    if (req.files) {
      deleteUploadedFiles(req.files);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create product',
      error: error.message
    });
  }
};

// Update product
const updateProduct = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const {
      name,
      categoryId,
      subCategory,
      unit,
      marketPrice,
      retailPrice,
      catererPrice,
      description,
      isActive
    } = req.body;

    // Get uploaded files (optional for updates)
    const uploadedFiles = req.files || [];

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Product name is required'
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    connection = await pool.getConnection();

    // Check if product exists and get current images
    const [existingProduct] = await connection.execute(
      'SELECT id, product_images FROM products WHERE id = ?',
      [id]
    );

    if (existingProduct.length === 0) {
      // Delete uploaded files if product not found
      if (uploadedFiles.length > 0) {
        deleteUploadedFiles(uploadedFiles);
      }
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if category exists
    const [categoryExists] = await connection.execute(
      'SELECT id FROM categories WHERE id = ?',
      [categoryId]
    );

    if (categoryExists.length === 0) {
      // Delete uploaded files if category not found
      if (uploadedFiles.length > 0) {
        deleteUploadedFiles(uploadedFiles);
      }
      return res.status(400).json({
        success: false,
        message: 'Selected category does not exist'
      });
    }

    // Check if another product with same name exists
    const [duplicateProduct] = await connection.execute(
      'SELECT id FROM products WHERE name = ? AND id != ?',
      [name.trim(), id]
    );

    if (duplicateProduct.length > 0) {
      // Delete uploaded files if duplicate name
      if (uploadedFiles.length > 0) {
        deleteUploadedFiles(uploadedFiles);
      }
      return res.status(409).json({
        success: false,
        message: 'Product with this name already exists'
      });
    }

    // Handle image updates
    let imageUrls = [];
    if (uploadedFiles.length > 0) {
      // If new images are uploaded, replace existing ones
      try {
        // Delete old images first
        if (existingProduct[0].product_images) {
          try {
            // Handle different types of product_images value
            let oldImages = [];

            if (typeof existingProduct[0].product_images === 'string') {
              // If it's a string, try to parse it
              const imageString = existingProduct[0].product_images.trim();
              if (imageString && imageString !== '' && imageString !== 'null') {
                oldImages = JSON.parse(imageString);
              }
            } else if (Array.isArray(existingProduct[0].product_images)) {
              // If it's already an array, use it directly
              oldImages = existingProduct[0].product_images;
            } else if (typeof existingProduct[0].product_images === 'object') {
              // If it's an object (but not array), convert to string and parse
              const imageString = JSON.stringify(existingProduct[0].product_images);
              if (imageString && imageString !== '{}' && imageString !== 'null') {
                oldImages = JSON.parse(imageString);
              }
            }

            // Process the images if we have a valid array
            if (Array.isArray(oldImages) && oldImages.length > 0) {
              const oldFilenames = oldImages.map(url => {
                const parts = url.split('/');
                return parts[parts.length - 1];
              });
              deleteUploadedFiles(oldFilenames);
            }
          } catch (error) {
            console.error('Error parsing existing product images for deletion:', error);
            console.error('Product images value:', existingProduct[0].product_images);
            // Continue without deleting old images if parsing fails
          }
        }

        // Process new images
        imageUrls = uploadedFiles.map((file, index) => {
          const extension = path.extname(file.originalname);
          const newFilename = `product-${id}-${index + 1}${extension}`;
          const oldPath = file.path;
          const newPath = path.join(imagesDir, newFilename);

          // Rename file
          fs.renameSync(oldPath, newPath);

          return getImageUrl(newFilename);
        });
      } catch (error) {
        console.error('Error processing images:', error);
        deleteUploadedFiles(uploadedFiles);
        return res.status(500).json({
          success: false,
          message: 'Failed to process images'
        });
      }
    } else {
      // Keep existing images if no new ones uploaded
      try {
        if (existingProduct[0].product_images) {
          // Handle different types of product_images value
          if (typeof existingProduct[0].product_images === 'string') {
            // If it's a string, try to parse it
            const imageString = existingProduct[0].product_images.trim();
            if (imageString && imageString !== '' && imageString !== 'null') {
              imageUrls = JSON.parse(imageString);
            } else {
              imageUrls = [];
            }
          } else if (Array.isArray(existingProduct[0].product_images)) {
            // If it's already an array, use it directly
            imageUrls = existingProduct[0].product_images;
          } else if (typeof existingProduct[0].product_images === 'object') {
            // If it's an object (but not array), convert to string and parse
            const imageString = JSON.stringify(existingProduct[0].product_images);
            if (imageString && imageString !== '{}' && imageString !== 'null') {
              imageUrls = JSON.parse(imageString);
            } else {
              imageUrls = [];
            }
          } else {
            imageUrls = [];
          }

          // Ensure imageUrls is an array
          if (!Array.isArray(imageUrls)) {
            imageUrls = [];
          }
        } else {
          imageUrls = [];
        }
      } catch (error) {
        console.error('Error parsing existing product images:', error);
        console.error('Existing product_images value:', existingProduct[0].product_images);
        imageUrls = []; // Default to empty array if parsing fails
      }
    }

    // Update product
    await connection.execute(`
      UPDATE products
      SET
        name = ?,
        category_id = ?,
        sub_category = ?,
        unit = ?,
        market_price = ?,
        retail_price = ?,
        caterer_price = ?,
        description = ?,
        product_images = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name.trim(),
      categoryId,
      subCategory ? subCategory.trim() : null,
      unit || 'kg',
      marketPrice || null,
      retailPrice || null,
      catererPrice || null,
      description ? description.trim() : null,
      JSON.stringify(imageUrls),
      isActive === '1' || isActive === 'true' || isActive === true ? 1 : 0,
      id
    ]);

    // Get updated product with category information
    const [updatedProduct] = await connection.execute(`
      SELECT 
        p.id, 
        p.name, 
        p.category_id,
        c.name as category_name,
        p.sub_category,
        p.unit,
        p.market_price,
        p.retail_price,
        p.caterer_price,
        p.description,
        p.product_images,
        p.is_active,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [id]);

    res.json({
      success: true,
      data: updatedProduct[0],
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      deleteUploadedFiles(req.files);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update product',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();

    // Get product details before deletion to clean up images
    const [product] = await connection.execute(
      'SELECT product_images FROM products WHERE id = ?',
      [id]
    );

    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete the product from database
    const [result] = await connection.execute(
      'DELETE FROM products WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Clean up image files if they exist
    try {
      if (product[0].product_images) {
        const imageString = product[0].product_images.trim();
        if (imageString && imageString !== '' && imageString !== 'null') {
          const images = JSON.parse(imageString);
          if (Array.isArray(images) && images.length > 0) {
            const filenames = images.map(url => {
              const parts = url.split('/');
              return parts[parts.length - 1];
            });
            deleteUploadedFiles(filenames);
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up image files:', error);
      console.error('Product images value:', product[0].product_images);
      // Don't fail the deletion if image cleanup fails
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  getCategories,  // Added this export
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
};