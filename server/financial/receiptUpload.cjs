const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

// Create receipts directory if it doesn't exist (sync on startup is acceptable)
const receiptsDir = path.join(__dirname, 'receipts');
if (!fsSync.existsSync(receiptsDir)) {
  fsSync.mkdirSync(receiptsDir, { recursive: true });
  console.log('📁 Created receipts directory:', receiptsDir);
}

// Configure multer for receipt image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, receiptsDir);
  },
  filename: function (req, file, cb) {
    try {
      // Generate unique filename with timestamp and random component
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      // Sanitize original filename
      const baseName = path.basename(file.originalname, fileExtension)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 50); // Limit length
      
      const fileName = `receipt-${uniqueSuffix}-${baseName}${fileExtension}`;
      cb(null, fileName);
    } catch (error) {
      cb(error);
    }
  }
});

// Enhanced file filter with better validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  // Validate both MIME type and extension
  if (allowedTypes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed. Received: ${file.mimetype}`), false);
  }
};

// Configure multer with enhanced options
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
    fieldNameSize: 100, // Limit field name size
    fieldSize: 1024 * 1024 // 1MB field value size
  }
});

// Middleware for single receipt image upload
const uploadReceiptImage = upload.single('receipt_image');

// Enhanced error handling middleware
const handleUploadError = (error, req, res, next) => {
  // Clean up uploaded file if it exists
  if (req.file && req.file.path) {
    fs.unlink(req.file.path).catch(err => 
      console.error('Failed to cleanup file:', err)
    );
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one receipt image is allowed.',
        code: 'TOO_MANY_FILES'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name. Use "receipt_image" as the field name.',
        code: 'INVALID_FIELD_NAME'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      code: error.code
    });
  }
  
  if (error && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }
  
  console.error('Upload error:', error);
  return res.status(500).json({
    success: false,
    message: 'File upload error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
};

module.exports = {
  uploadReceiptImage,
  handleUploadError,
  receiptsDir
};
