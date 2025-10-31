const { pool } = require('../../config/database.cjs');
const fs = require('fs').promises;
const path = require('path');

// Helper function to validate required fields
const validateCatererData = (data, isUpdate = false) => {
  const errors = [];
  
  if (!isUpdate || data.caterer_name !== undefined) {
    if (!data.caterer_name || data.caterer_name.trim() === '') {
      errors.push('Caterer name is required');
    }
  }
  
  if (!isUpdate || data.contact_person !== undefined) {
    if (!data.contact_person || data.contact_person.trim() === '') {
      errors.push('Contact person is required');
    }
  }
  
  if (!isUpdate || data.phone_number !== undefined) {
    if (!data.phone_number || data.phone_number.trim() === '') {
      errors.push('Phone number is required');
    }
  }
  
  // Validate email format if provided
  if (data.email && data.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    }
  }
  
  // Validate phone number format if provided
  if (data.phone_number && data.phone_number.trim() !== '') {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(data.phone_number)) {
      errors.push('Invalid phone number format');
    }
  }
  
  return errors;
};

// Helper function to safely delete image files
const safeDeleteImage = async (filename) => {
  if (!filename) return;
  
  try {
    const imagesDir = path.join(__dirname, '../assets/caterer_img');
    const imagePath = path.join(imagesDir, filename);
    
    // Check if file exists before attempting deletion
    await fs.access(imagePath);
    await fs.unlink(imagePath);
    console.log(`✅ Image deleted successfully: ${filename}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️ Image file not found: ${filename}`);
    } else {
      console.log(`⚠️ Error deleting image ${filename}:`, error.message);
    }
  }
};

// Helper function to build image URL
const buildImageUrl = (req, filename) => {
  return filename ? `${req.protocol}://${req.get('host')}/images/${filename}` : null;
};

// Get all caterers with enhanced logging and filtering
const getCaterers = async (req, res) => {
  try {
    console.log('🔍 Fetching all caterers...');
    
    // Optional query parameters for filtering
    const { search, city, state } = req.query;
    let query = 'SELECT * FROM caterers';
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push('(caterer_name LIKE ? OR contact_person LIKE ? OR description LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (city) {
      conditions.push('city LIKE ?');
      params.push(`%${city}%`);
    }
    
    if (state) {
      conditions.push('state LIKE ?');
      params.push(`%${state}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY caterer_name ASC, created_at DESC';
    
    const [caterers] = await pool.execute(query, params);
    
    console.log(`✅ Found ${caterers.length} caterers`);
    
    // Add image URLs to the response
    const processedCaterers = caterers.map(caterer => ({
      ...caterer,
      card_image_url: buildImageUrl(req, caterer.card_image),
      // Convert balance_due to number if it exists
      balance_due: caterer.balance_due ? parseFloat(caterer.balance_due) : 0
    }));
    
    res.json({ 
      success: true, 
      count: caterers.length,
      caterers: processedCaterers,
      filters: { search, city, state }
    });
    
  } catch (error) {
    console.error('❌ Error fetching caterers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch caterers', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get single caterer with enhanced error handling
const getCaterer = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching caterer ID: ${id}`);
    
    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid caterer ID is required' 
      });
    }
    
    const [caterers] = await pool.execute('SELECT * FROM caterers WHERE id = ?', [parseInt(id)]);
    
    if (caterers.length === 0) {
      console.log(`❌ Caterer not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Caterer not found' 
      });
    }
    
    const caterer = {
      ...caterers[0],
      card_image_url: buildImageUrl(req, caterers[0].card_image),
      balance_due: caterers[0].balance_due ? parseFloat(caterers[0].balance_due) : 0
    };
    
    console.log(`✅ Caterer found: ${caterer.caterer_name}`);
    res.json({ success: true, caterer });
    
  } catch (error) {
    console.error('❌ Error fetching caterer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch caterer', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Create new caterer with improved validation and error handling
const createCaterer = async (req, res) => {
  try {
    console.log('➕ Creating new caterer...');
    console.log('📝 Request body:', req.body);
    console.log('📁 Files:', req.files);
    
    const {
      caterer_name,
      contact_person,
      phone_number,
      email,
      address,
      city,
      state,
      pincode,
      gst_number,
      description
    } = req.body;

    // Validate input data
    const validationErrors = validateCatererData(req.body);
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Handle image upload with enhanced validation
    let card_image = null;
    if (req.files && req.files.card_image && req.files.card_image.length > 0) {
      const uploadedFile = req.files.card_image[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(uploadedFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
        });
      }
      
      // Validate file size (5MB limit)
      if (uploadedFile.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 5MB allowed.'
        });
      }
      
      card_image = uploadedFile.filename;
      console.log('📷 Image uploaded:', card_image);
    } else {
      console.log('ℹ️ No image uploaded');
    }

    // Check for duplicate caterer name or phone number
    const [duplicates] = await pool.execute(
      'SELECT id FROM caterers WHERE caterer_name = ? OR phone_number = ?',
      [caterer_name.trim(), phone_number.trim()]
    );
    
    if (duplicates.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A caterer with this name or phone number already exists'
      });
    }

    const query = `
      INSERT INTO caterers (
        caterer_name, contact_person, phone_number, email, address, 
        city, state, pincode, gst_number, card_image, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      caterer_name.trim(), 
      contact_person.trim(), 
      phone_number.trim(), 
      email ? email.trim() : null, 
      address ? address.trim() : null, 
      city ? city.trim() : null, 
      state ? state.trim() : null, 
      pincode ? pincode.trim() : null, 
      gst_number ? gst_number.trim() : null, 
      card_image, 
      description ? description.trim() : null
    ];
    
    const [result] = await pool.execute(query, values);
    
    const newCaterer = {
      id: result.insertId,
      caterer_name: caterer_name.trim(),
      contact_person: contact_person.trim(),
      phone_number: phone_number.trim(),
      email: email ? email.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      pincode: pincode ? pincode.trim() : null,
      gst_number: gst_number ? gst_number.trim() : null,
      card_image,
      card_image_url: buildImageUrl(req, card_image),
      description: description ? description.trim() : null,
      balance_due: 0,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    console.log(`✅ Caterer created successfully with ID: ${result.insertId}`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Caterer created successfully', 
      caterer: newCaterer
    });
    
  } catch (error) {
    console.error('❌ Error creating caterer:', error);
    
    // Clean up uploaded image if database insertion failed
    if (req.files && req.files.card_image && req.files.card_image.length > 0) {
      await safeDeleteImage(req.files.card_image[0].filename);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create caterer', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update caterer with improved file handling and validation
const updateCaterer = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`✏️ Updating caterer ID: ${id}`);
    console.log('📝 Request body:', req.body);
    console.log('📁 Files:', req.files);
    
    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid caterer ID is required' 
      });
    }
    
    const {
      caterer_name,
      contact_person,
      phone_number,
      email,
      address,
      city,
      state,
      pincode,
      gst_number,
      description
    } = req.body;

    // Validate input data for updates
    const validationErrors = validateCatererData(req.body, true);
    if (validationErrors.length > 0) {
      console.log('❌ Validation failed:', validationErrors);
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Check if caterer exists
    const [existing] = await pool.execute('SELECT * FROM caterers WHERE id = ?', [parseInt(id)]);
    if (existing.length === 0) {
      console.log(`❌ Caterer not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Caterer not found' 
      });
    }

    const currentCaterer = existing[0];

    // Check for duplicate name or phone (excluding current caterer)
    if (caterer_name || phone_number) {
      const checkName = caterer_name ? caterer_name.trim() : currentCaterer.caterer_name;
      const checkPhone = phone_number ? phone_number.trim() : currentCaterer.phone_number;
      
      const [duplicates] = await pool.execute(
        'SELECT id FROM caterers WHERE (caterer_name = ? OR phone_number = ?) AND id != ?',
        [checkName, checkPhone, parseInt(id)]
      );
      
      if (duplicates.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'A caterer with this name or phone number already exists'
        });
      }
    }

    // Handle image upload with enhanced validation
    let card_image = currentCaterer.card_image;
    let oldImageToDelete = null;
    
    if (req.files && req.files.card_image && req.files.card_image.length > 0) {
      const uploadedFile = req.files.card_image[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(uploadedFile.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
        });
      }
      
      // Validate file size (5MB limit)
      if (uploadedFile.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum 5MB allowed.'
        });
      }
      
      oldImageToDelete = currentCaterer.card_image;
      card_image = uploadedFile.filename;
      console.log('📷 New image uploaded:', card_image);
    }

    const query = `
      UPDATE caterers SET 
        caterer_name = ?, contact_person = ?, phone_number = ?, email = ?, 
        address = ?, city = ?, state = ?, pincode = ?, gst_number = ?, 
        card_image = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const values = [
      caterer_name ? caterer_name.trim() : currentCaterer.caterer_name,
      contact_person ? contact_person.trim() : currentCaterer.contact_person,
      phone_number ? phone_number.trim() : currentCaterer.phone_number,
      email !== undefined ? (email ? email.trim() : null) : currentCaterer.email,
      address !== undefined ? (address ? address.trim() : null) : currentCaterer.address,
      city !== undefined ? (city ? city.trim() : null) : currentCaterer.city,
      state !== undefined ? (state ? state.trim() : null) : currentCaterer.state,
      pincode !== undefined ? (pincode ? pincode.trim() : null) : currentCaterer.pincode,
      gst_number !== undefined ? (gst_number ? gst_number.trim() : null) : currentCaterer.gst_number,
      card_image,
      description !== undefined ? (description ? description.trim() : null) : currentCaterer.description,
      parseInt(id)
    ];
    
    await pool.execute(query, values);
    
    // Delete old image after successful database update
    if (oldImageToDelete && oldImageToDelete !== card_image) {
      await safeDeleteImage(oldImageToDelete);
    }
    
    // Fetch updated caterer data
    const [updated] = await pool.execute('SELECT * FROM caterers WHERE id = ?', [parseInt(id)]);
    const updatedCaterer = {
      ...updated[0],
      card_image_url: buildImageUrl(req, updated[0].card_image),
      balance_due: updated[0].balance_due ? parseFloat(updated[0].balance_due) : 0
    };
    
    console.log(`✅ Caterer updated successfully: ${id}`);
    res.json({ 
      success: true, 
      message: 'Caterer updated successfully',
      caterer: updatedCaterer
    });
    
  } catch (error) {
    console.error('❌ Error updating caterer:', error);
    
    // Clean up new uploaded image if update failed
    if (req.files && req.files.card_image && req.files.card_image.length > 0) {
      await safeDeleteImage(req.files.card_image[0].filename);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update caterer', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete caterer with improved error handling and cleanup
// Delete caterer with improved error handling (no problematic transactions)
const deleteCaterer = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting caterer ID: ${id}`);
    
    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid caterer ID is required' 
      });
    }
    
    // Check if caterer exists and get image info
    const [existing] = await pool.execute('SELECT * FROM caterers WHERE id = ?', [parseInt(id)]);
    if (existing.length === 0) {
      console.log(`❌ Caterer not found with ID: ${id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Caterer not found' 
      });
    }
    
    const catererToDelete = existing[0];
    
    // Delete caterer record from database (single operation, no transaction needed)
    const [result] = await pool.execute('DELETE FROM caterers WHERE id = ?', [parseInt(id)]);
    
    if (result.affectedRows === 0) {
      throw new Error('Failed to delete caterer from database');
    }
    
    console.log(`✅ Caterer deleted from database: ${id}`);
    
    // Delete associated image file after successful database deletion
    if (catererToDelete.card_image) {
      try {
        await safeDeleteImage(catererToDelete.card_image);
        console.log(`✅ Associated image deleted: ${catererToDelete.card_image}`);
      } catch (imageError) {
        console.log(`⚠️ Failed to delete image file: ${imageError.message}`);
        // Don't fail the entire operation if image deletion fails
      }
    }
    
    console.log(`✅ Caterer deleted successfully: ${id}`);
    res.json({ 
      success: true, 
      message: 'Caterer deleted successfully',
      deleted_caterer: {
        id: catererToDelete.id,
        caterer_name: catererToDelete.caterer_name
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting caterer:', error);
    
    // Handle foreign key constraint violation specifically
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      res.status(409).json({
        success: false,
        message: 'Cannot delete caterer because it has associated sales records. Please delete all sales records for this caterer first.',
        error_type: 'foreign_key_constraint'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete caterer',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

// Find caterer by phone number
const findCatererByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    console.log(`🔍 Finding caterer by phone: ${phone}`);
    
    if (!phone || phone.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const [caterers] = await pool.execute(
      'SELECT * FROM caterers WHERE phone_number = ?',
      [phone.trim()]
    );
    
    if (caterers.length === 0) {
      console.log(`❌ No caterer found with phone: ${phone}`);
      return res.status(404).json({
        success: false,
        message: 'Caterer not found with this phone number'
      });
    }
    
    const caterer = {
      ...caterers[0],
      card_image_url: buildImageUrl(req, caterers[0].card_image),
      balance_due: caterers[0].balance_due ? parseFloat(caterers[0].balance_due) : 0
    };
    
    console.log(`✅ Caterer found: ${caterer.caterer_name}`);
    res.json({ success: true, data: caterer });
    
  } catch (error) {
    console.error('❌ Error finding caterer by phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find caterer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


module.exports = {
  getCaterers,
  getCaterer,
  createCaterer,
  updateCaterer,
  deleteCaterer,
  findCatererByPhone
};
