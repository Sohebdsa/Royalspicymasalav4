const express = require('express');
const router = express.Router();

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// Middleware to validate JSON data
const validateSalesData = (req, res, next) => {
  try {
    // Check if request has JSON data
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
        error: 'EMPTY_REQUEST_BODY'
      });
    }

    // Basic validation - check if it's an object
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must be an object',
        error: 'INVALID_REQUEST_FORMAT'
      });
    }

    // Optional: Add more specific validation based on expected data structure
    // For now, we'll accept any valid JSON object
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid JSON data',
      error: 'JSON_PARSE_ERROR'
    });
  }
};

// POST /api/caterer-sales endpoint
router.post('/',
  logRequest,
  validateSalesData,
  (req, res) => {
    try {
      const receivedData = req.body;
      const timestamp = new Date().toISOString();
      
      // Handle receipt image if present (base64 data)
      let processedData = { ...receivedData };
      if (receivedData.receipt_image && receivedData.receipt_image.data) {
        console.log('📷 Processing receipt image:', receivedData.receipt_image.filename);
        
        // For now, we'll just acknowledge the image was received
        // In a real implementation, you'd save the base64 data to a file
        processedData.receipt_image = {
          filename: receivedData.receipt_image.filename,
          size: receivedData.receipt_image.size,
          type: receivedData.receipt_image.type,
          received: true,
          note: 'Base64 image data received (implementation needed for file saving)'
        };
      }
      
      // Enhanced logging - show request headers, body, and response details
      console.log('📊 Caterer Sales Data Received:', {
        timestamp: timestamp,
        headers: {
          'content-type': req.get('content-type'),
          'user-agent': req.get('user-agent'),
          'host': req.get('host'),
          'origin': req.get('origin')
        },
        body: processedData,
        dataType: typeof processedData,
        keys: Object.keys(processedData),
        requestUrl: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      // Return success response with received data
      const responseData = {
        success: true,
        message: 'Data received successfully',
        data: processedData,
        receivedAt: timestamp,
        processedAt: new Date().toISOString()
      };

      console.log('📤 Caterer Sales Response Sent:', {
        timestamp: new Date().toISOString(),
        response: responseData,
        statusCode: 200
      });

      res.status(200).json(responseData);

    } catch (error) {
      const errorTimestamp = new Date().toISOString();
      console.error('❌ Error processing caterer sales data:', {
        timestamp: errorTimestamp,
        error: error.message,
        stack: error.stack,
        receivedData: req.body,
        headers: {
          'content-type': req.get('content-type'),
          'user-agent': req.get('user-agent')
        }
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to process caterer sales data',
        error: error.message,
        receivedData: req.body, // Include original data for debugging
        errorAt: errorTimestamp
      });
    }
  }
);

// Test endpoint - shows expected data format and provides testing instructions
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint - shows expected data format',
    testData: {
      catererId: "example-caterer-id",
      items: [
        {"name": "Item 1", "quantity": 2, "price": 100},
        {"name": "Item 2", "quantity": 1, "price": 50}
      ],
      total: 250,
      date: "2025-10-25T07:39:00.000Z"
    },
    testInstructions: "Use curl: curl -X POST http://localhost:3000/api/caterer-sales -H 'Content-Type: application/json' -d '{\"catererId\":\"test\",\"items\":[],\"total\":0}'",
    timestamp: new Date().toISOString()
  });
});

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are healthy',
    timestamp: new Date().toISOString(),
    endpoint: '/api/caterer-sales'
  });
});

// GET endpoint to test the route (for debugging)
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales endpoint is available',
    timestamp: new Date().toISOString(),
    availableMethods: ['POST /', 'GET /health'],
    usage: 'POST /api/caterer-sales with JSON data'
  });
});

// Error handler for invalid routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableRoutes: [
      'POST /',
      'GET /',
      'GET /health',
      'GET /test'
    ]
  });
});

module.exports = router;