const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types');
const db = require('../../config/database.cjs');

// Storage locations
const RECEIPTS_DIR = path.join(__dirname, 'reciept');
const RECEIPTS_URL_BASE = '/caterers/assets/caterer_img/receipts';

const methodMap = {
  cash: 'cash',
  upi: 'upi',
  card: 'card',
  bank: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  cheque: 'cheque',
  check: 'cheque',
  credit: 'credit'
};

// Parse data URL for base64 images
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

// Save receipt from base64 data URL (legacy support)
async function saveReceiptImage(receipt) {
  if (!receipt?.data) return null;

  try {
    await fs.mkdir(RECEIPTS_DIR, { recursive: true });

    const originalName = path.basename(String(receipt.filename || 'receipt').trim());
    const nameParts = path.parse(originalName);

    const parsed = parseDataUrl(receipt.data);

    let finalExt;
    if (parsed) {
      const derived = mimeToExt(parsed.mime);
      finalExt = derived ? '.' + derived.toLowerCase() : (nameParts.ext || '.png');
    } else {
      finalExt = nameParts.ext || '.png';
    }

    const base = nameParts.name || 'receipt';
    const unique = `${Date.now()}_${base}${finalExt}`;

    const filePath = path.join(RECEIPTS_DIR, unique);
    const b64 = parsed ? parsed.base64 : (receipt.data.split(',').pop() || receipt.data);
    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));

    console.log('✅ Receipt saved successfully:', unique);
    return `${RECEIPTS_URL_BASE}/${unique}`;
  } catch (error) {
    console.error('⚠️ Error saving receipt image:', error);
    return null;
  }
}

// Save receipt from Multer buffer (for FormData uploads)
async function saveReceiptImageFromBuffer(file) {
  if (!file || !file.buffer) return null;

  try {
    await fs.mkdir(RECEIPTS_DIR, { recursive: true });

    const ext = path.extname(file.originalname) || '.png';
    const baseName = path.basename(file.originalname, ext) || 'receipt';
    const unique = `${Date.now()}_${baseName}${ext}`;

    const filePath = path.join(RECEIPTS_DIR, unique);
    await fs.writeFile(filePath, file.buffer);

    console.log('✅ Receipt saved from buffer:', unique);
    return `${RECEIPTS_URL_BASE}/${unique}`;
  } catch (error) {
    console.error('⚠️ Error saving receipt from buffer:', error);
    return null;
  }
}

/**
 * Create a new payment for a caterer sale/bill
 * Handles transactions properly with rollback support
 */
const createCatererPayment = async (req, res) => {
  let connection;
  
  try {
    // Extract payment data from request
    const {
      caterer_id,
      bill_id,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
      receipt
    } = req.body;

    console.log('📝 Payment request received:', {
      caterer_id,
      bill_id,
      amount,
      paymentMethod,
      hasReferenceNumber: !!referenceNumber,
      hasNotes: !!notes,
      hasReceipt: !!receipt || !!req.file,
      rawBody: req.body // ✅ Added for debugging
    });

    // ✅ FIX: Validate required fields with better error messages
    const missingFields = [];
    if (!caterer_id || caterer_id === 'undefined') missingFields.push('caterer_id');
    if (!bill_id || bill_id === 'undefined') missingFields.push('bill_id');
    if (!amount) missingFields.push('amount');
    if (!paymentMethod) missingFields.push('paymentMethod');

    if (missingFields.length > 0) {
      console.error('❌ Missing or invalid required fields:', missingFields);
      return res.status(400).json({
        success: false,
        error: `Missing or invalid required fields: ${missingFields.join(', ')}`,
        received: {
          caterer_id: caterer_id || 'missing',
          bill_id: bill_id || 'missing',
          amount: amount || 'missing',
          paymentMethod: paymentMethod || 'missing'
        }
      });
    }

    // Parse and validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      console.error('❌ Invalid payment amount:', {
        original: amount,
        parsed: paymentAmount,
        type: typeof amount
      });
      return res.status(400).json({
        success: false,
        error: 'Payment amount must be a positive number',
        details: `Received: ${amount} (${typeof amount}), Parsed: ${paymentAmount}`
      });
    }

    // Normalize payment method
    const normalizedMethod = methodMap[String(paymentMethod).toLowerCase()] || 'cash';
    console.log('💳 Payment method normalized:', paymentMethod, '→', normalizedMethod);

    // Check database pool availability
    if (!db || !db.pool) {
      console.error('❌ Database pool not configured');
      return res.status(500).json({
        success: false,
        error: 'Database connection not configured'
      });
    }

    // Get connection and start transaction
    connection = await db.pool.getConnection();
    await connection.beginTransaction();
    console.log('✅ Transaction started for bill_id:', bill_id);

    // ✅ FIX: Fetch bill with more details and proper row lock
    const [billRows] = await connection.execute(
      `SELECT 
        id, 
        bill_number, 
        grand_total, 
        payment_status,
        caterer_id,
        sell_date
       FROM caterer_sales 
       WHERE id = ? 
       FOR UPDATE`,
      [bill_id]
    );

    if (!billRows || billRows.length === 0) {
      await connection.rollback();
      console.error('❌ Bill not found:', bill_id);
      return res.status(404).json({
        success: false,
        error: `Sale/Bill with ID ${bill_id} not found`
      });
    }

    const bill = billRows[0];
    const grandTotal = parseFloat(bill.grand_total || 0);
    
    console.log('📊 Bill details:', {
      id: bill.id,
      bill_number: bill.bill_number,
      grand_total: grandTotal,
      current_status: bill.payment_status,
      caterer_id: bill.caterer_id
    });

    // ✅ FIX: Calculate current total paid with better logging
    const [paymentRows] = await connection.execute(
      `SELECT 
        COALESCE(SUM(payment_amount), 0) AS total_paid,
        COUNT(*) AS payment_count
       FROM caterer_sale_payments 
       WHERE sale_id = ?`,
      [bill_id]
    );

    const currentTotalPaid = parseFloat(paymentRows[0].total_paid || 0);
    const paymentCount = parseInt(paymentRows[0].payment_count || 0);
    const currentPending = Math.max(0, +(grandTotal - currentTotalPaid).toFixed(2));

    console.log('💰 Current payment status:', {
      grand_total: grandTotal,
      total_paid: currentTotalPaid,
      payment_count: paymentCount,
      pending: currentPending,
      new_payment: paymentAmount,
      will_exceed: paymentAmount > currentPending
    });

    // ✅ FIX: Better validation with detailed error
    if (currentPending <= 0) {
      await connection.rollback();
      console.error('❌ Bill already fully paid:', {
        bill_id: bill_id,
        bill_number: bill.bill_number,
        grand_total: grandTotal,
        total_paid: currentTotalPaid,
        pending: currentPending
      });
      return res.status(400).json({
        success: false,
        error: 'This bill is already fully paid',
        details: {
          bill_number: bill.bill_number,
          grand_total: grandTotal,
          total_paid: currentTotalPaid,
          pending: currentPending,
          payment_count: paymentCount
        }
      });
    }

    if (paymentAmount > currentPending) {
      await connection.rollback();
      console.error('❌ Payment exceeds pending amount:', {
        payment_amount: paymentAmount,
        pending_amount: currentPending,
        difference: (paymentAmount - currentPending).toFixed(2)
      });
      return res.status(400).json({
        success: false,
        error: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding balance of ₹${currentPending.toFixed(2)}`,
        details: {
          bill_number: bill.bill_number,
          grand_total: grandTotal,
          already_paid: currentTotalPaid,
          pending: currentPending,
          attempted_payment: paymentAmount,
          excess_amount: (paymentAmount - currentPending).toFixed(2)
        }
      });
    }

    // Save receipt image (outside transaction to avoid locking during file I/O)
    let receiptPath = null;
    if (req.file) {
      console.log('📁 Processing Multer file upload:', req.file.originalname);
      receiptPath = await saveReceiptImageFromBuffer(req.file);
    } else if (receipt && receipt.data) {
      console.log('📁 Processing base64 receipt data');
      receiptPath = await saveReceiptImage(receipt);
    }

    // Insert payment record
    const [paymentResult] = await connection.execute(
      `INSERT INTO caterer_sale_payments
       (sale_id, payment_date, payment_method, payment_option, payment_amount, reference_number, notes, receipt_image, created_at)
       VALUES (?, NOW(), ?, 'custom', ?, ?, ?, ?, NOW())`,
      [
        bill_id,
        normalizedMethod,
        paymentAmount,
        referenceNumber || null,
        notes || null,
        receiptPath || null
      ]
    );

    const paymentId = paymentResult.insertId;
    console.log('✅ Payment record inserted with ID:', paymentId);

    // Recalculate total paid after this payment
    const [newSumRows] = await connection.execute(
      'SELECT COALESCE(SUM(payment_amount), 0) AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
      [bill_id]
    );

    const newTotalPaid = parseFloat(newSumRows[0].total_paid || 0);
    const remaining = Math.max(0, +(grandTotal - newTotalPaid).toFixed(2));

    console.log('💰 New payment totals:', {
      previous_total_paid: currentTotalPaid,
      new_total_paid: newTotalPaid,
      payment_just_added: paymentAmount,
      remaining: remaining,
      calculation_check: (currentTotalPaid + paymentAmount) === newTotalPaid
    });

    // Determine new payment status
    let newStatus = 'pending';
    if (remaining <= 0.01) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partial';
    }

    console.log('📌 Updating bill status from', bill.payment_status, 'to', newStatus);

    // Update bill status
    await connection.execute(
      'UPDATE caterer_sales SET payment_status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, bill_id]
    );

    // Commit transaction
    await connection.commit();
    console.log('✅ Transaction committed successfully');

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        payment_id: paymentId,
        bill_id: bill_id,
        bill_number: bill.bill_number,
        payment_amount: paymentAmount,
        payment_method: normalizedMethod,
        reference_number: referenceNumber || null,
        total_paid: +newTotalPaid.toFixed(2),
        remaining_due: remaining,
        payment_status: newStatus,
        receipt_image: receiptPath || null
      }
    });

  } catch (error) {
    // Rollback transaction on error
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔄 Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', rollbackError);
      }
    }

    console.error('❌ Error creating caterer payment:', error);
    console.error('Stack trace:', error.stack);

    return res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });

  } finally {
    // Always release connection back to pool
    if (connection) {
      connection.release();
      console.log('🔓 Connection released back to pool');
    }
  }
};

/**
 * Serve receipt images for caterer payments
 * GET /api/caterer-payments/receipts/:filename
 */
const serveCatererPaymentReceipt = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    // Security check: prevent directory traversal
    const safePath = path.join(RECEIPTS_DIR, filename);
    if (!safePath.startsWith(RECEIPTS_DIR)) {
      console.error('⚠️ Security: Directory traversal attempt blocked:', filename);
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.sendFile(filename, { root: RECEIPTS_DIR }, (err) => {
      if (err) {
        console.error('❌ Error serving receipt image:', err);
        return res.status(404).json({
          success: false,
          message: 'Receipt image not found',
          error: err.message
        });
      }
    });
  } catch (error) {
    console.error('❌ Error in serveCatererPaymentReceipt:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to serve receipt image',
      error: error.message
    });
  }
};

module.exports = {
  createCatererPayment,
  serveCatererPaymentReceipt
};
