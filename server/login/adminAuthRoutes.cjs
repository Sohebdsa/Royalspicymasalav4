const express = require('express');
const router = express.Router();
const {
  adminLogin,
  getAdminProfile,
  verifyAdminToken,
  getSafetyPassword,
  updateSafetySettings
} = require('./adminAuthController.cjs');

// Admin login route
router.post('/admin-login', adminLogin);

// Protected admin routes
router.get('/admin-profile', verifyAdminToken, getAdminProfile);
router.get('/safety-password', verifyAdminToken, getSafetyPassword);
router.post('/update-safety', verifyAdminToken, updateSafetySettings);

// Admin logout (client-side token removal, but we can log it)
router.post('/admin-logout', verifyAdminToken, (req, res) => {
  // Log the logout action
  console.log(`Admin ${req.admin.username} logged out at ${new Date().toISOString()}`);

  res.json({
    message: 'Logout successful',
    timestamp: new Date().toISOString()
  });
});

// Verify admin token endpoint
router.get('/verify-admin', verifyAdminToken, (req, res) => {
  res.json({
    valid: true,
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      full_name: req.admin.full_name,
      email: req.admin.email,
      role: req.admin.role
    }
  });
});

// Refresh admin token endpoint
router.post('/refresh-token', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // For now, we'll generate a new token using the same logic as login
    // In a real implementation, you'd verify the refresh token against a database
    const jwt = require('jsonwebtoken');
    
    // Try to decode the refresh token to get admin ID
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Generate new access token
    const { generateToken } = require('./adminAuthController.cjs');
    const newToken = generateToken(decoded.adminId);

    res.json({
      success: true,
      token: newToken,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
