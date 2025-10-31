const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  getCaterers,
  createCaterer,
  updateCaterer,
  deleteCaterer
} = require('../controller/catererController.cjs');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../assets/caterer_img');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created caterer images directory:', uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = 'caterer-' + uniqueSuffix + extension;
    cb(null, filename);
  }
});

// File filter to allow only image files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed!'), false);
  }
};

// Configure multer with file size limits
const uploadCatererImages = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
    files: 1 // Maximum 1 file per field
  }
}).fields([
  { name: 'card_image', maxCount: 1 }
]);

// Error handler for multer upload errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum size allowed is 5MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Only one image is allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field name for file upload';
        break;
      default:
        message = err.message;
    }
    
    return res.status(400).json({ 
      success: false, 
      message: message,
      error: 'FILE_UPLOAD_ERROR'
    });
  }
  
  if (err) {
    return res.status(400).json({ 
      success: false, 
      message: err.message,
      error: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// Routes for caterers
router.get('/', logRequest, getCaterers);

router.post('/', 
  logRequest, 
  uploadCatererImages, 
  handleUploadError, 
  createCaterer
);

router.put('/:id', 
  logRequest, 
  uploadCatererImages, 
  handleUploadError, 
  updateCaterer
);

router.delete('/:id', 
  logRequest, 
  deleteCaterer
);

// Health check route
router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Caterer routes are healthy',
    timestamp: new Date().toISOString(),
    uploadsDirectory: uploadsDir
  });
});

// Get single caterer by ID
router.get('/:id', logRequest, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { pool } = require('../../config/database.cjs');
    const [caterer] = await pool.execute('SELECT * FROM caterers WHERE id = ?', [id]);
    
    if (caterer.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Caterer not found' 
      });
    }
    
    // Add image URL
    const processedCaterer = {
      ...caterer[0],
      card_image_url: caterer[0].card_image 
        ? `${req.protocol}://${req.get('host')}/images/${caterer[0].card_image}`
        : null
    };
    
    res.json({ 
      success: true, 
      caterer: processedCaterer 
    });
  } catch (error) {
    console.error('Error fetching caterer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch caterer',
      error: error.message 
    });
  }
});

// Find caterer by phone number
router.get('/find-by-phone/:phone', logRequest, async (req, res) => {
  try {
    const { phone } = req.params;
    
    if (!phone || phone.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const { pool } = require('../../config/database.cjs');
    const [caterers] = await pool.execute(
      'SELECT * FROM caterers WHERE phone_number = ?',
      [phone.trim()]
    );
    
    if (caterers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Caterer not found with this phone number'
      });
    }
    
    // Add image URL
    const processedCaterer = {
      ...caterers[0],
      card_image_url: caterers[0].card_image
        ? `${req.protocol}://${req.get('host')}/images/${caterers[0].card_image}`
        : null
    };
    
    res.json({
      success: true,
      data: processedCaterer
    });
  } catch (error) {
    console.error('Error finding caterer by phone:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find caterer',
      error: error.message
    });
  }
});

// Error handler for invalid routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableRoutes: [
      'GET /',
      'GET /:id',
      'POST /',
      'PUT /:id',
      'DELETE /:id',
      'GET /health'
    ]
  });
});

module.exports = router;
