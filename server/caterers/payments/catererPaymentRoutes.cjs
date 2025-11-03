const express = require('express');
const router = express.Router();
const db = require('../../config/database.cjs');
const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types'); // npm i mime-types

const RECEIPTS_DIR = path.join(__dirname, '..', 'assets', 'receipts');
const RECEIPTS_URL_BASE = '/caterers/assets/receipts';

// Middleware to handle JSON and URL-encoded data
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Middleware for file uploads (FormData)
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, RECEIPTS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, SVG, and PDF files are allowed.'), false);
    }
  }
});


const methodMap = {
  cash:'cash',
  upi:'upi',
  card:'card',
  bank:'bank_transfer',
  bank_transfer:'bank_transfer',
  cheque:'cheque',
  check:'cheque',
  credit:'credit'
};

// Data URL parser to derive MIME and base64 payload
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function derivePaymentAmount(option, grandTotal, customAmount) {
  const gt = Number(grandTotal) || 0;
  const opt = String(option || 'full').toLowerCase();
  if (opt === 'full') return gt;
  if (opt === 'half') return Math.round((gt / 2) * 100) / 100;
  if (opt === 'custom') return Number(customAmount || 0);
  return 0; // later
}

// Normalize bill number
const normBill = b => {
  if (!b) return b;
  const num = String(b).replace('#','').replace(/\D/g,'');
  return '#'+String(num).padStart(4,'0');
};

// Middleware
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// POST /api/caterer-payments/create - Create a new caterer payment
router.post('/create', logRequest, upload.single('receipt_image'), async (req, res) => {
  try {
    const paymentController = require('./catererPaymentController.cjs');
    await paymentController.createCatererPayment(req, res);
  } catch (error) {
    console.error('Error in payment creation route:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// GET /api/caterer-payments/receipts/:filename - Serve payment receipt images
router.get('/receipts/:filename', logRequest, async (req, res) => {
  try {
    const paymentController = require('./catererPaymentController.cjs');
    await paymentController.serveCatererPaymentReceipt(req, res);
  } catch (error) {
    console.error('Error serving payment receipt:', error);
    res.status(500).json({ error: 'Failed to serve receipt' });
  }
});

module.exports = router;
