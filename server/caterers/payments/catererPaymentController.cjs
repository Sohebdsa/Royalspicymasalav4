const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types');
const db = require('../../config/database.cjs');

const RECEIPTS_DIR = path.join(__dirname, '..', 'assets', 'receipts');
const RECEIPTS_URL_BASE = '/caterers/assets/receipts';

const methodMap = {
  cash: 'cash',
  upi: 'upi',
  card: 'card',
  bank: 'bank_transfer',
  bank_transfer: 'bank_transfer',
  cheque: 'cheque',
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
  if (!receipt?.data) {
    console.error('❌ Invalid receipt data for base64 save:', {
      receipt: !!receipt,
      hasData: !!(receipt && receipt.data),
      dataLength: receipt?.data?.length
    });
    return null;
  }

  try {
    console.log('🔧 Creating receipts directory if needed...');
    await fs.mkdir(RECEIPTS_DIR, { recursive: true });
    console.log('✅ Receipts directory ready:', RECEIPTS_DIR);

    const originalName = path.basename(String(receipt.filename || 'receipt').trim());
    const nameParts = path.parse(originalName);
    console.log('📝 Processing receipt filename:', { originalName, nameParts });

    const parsed = parseDataUrl(receipt.data);
    console.log('🔍 Parsed data URL:', {
      hasParsed: !!parsed,
      mime: parsed?.mime,
      dataLength: receipt.data.length
    });

    let finalExt;
    if (parsed) {
      const derived = mimeToExt(parsed.mime);
      finalExt = derived ? '.' + derived.toLowerCase() : (nameParts.ext || '.png');
      console.log('📎 Derived file extension:', { derived, finalExt });
    } else {
      finalExt = nameParts.ext || '.png';
      console.log('📎 Using default file extension:', finalExt);
    }

    const base = nameParts.name || 'receipt';
    const unique = `${Date.now()}_${base}${finalExt}`;
    const filePath = path.join(RECEIPTS_DIR, unique);
    
    const b64 = parsed ? parsed.base64 : (receipt.data.split(',').pop() || receipt.data);
    console.log('📝 Writing receipt file:', {
      filePath,
      base64Length: b64.length,
      uniqueFilename: unique
    });

    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
    console.log('✅ Receipt saved successfully from base64:', unique);

    const receiptUrl = `${RECEIPTS_URL_BASE}/${unique}`;
    console.log('🔗 Generated receipt URL:', receiptUrl);
    return receiptUrl;
  } catch (error) {
    console.error('❌ Error saving receipt image from base64:', {
      error: error.message,
      stack: error.stack,
      filename: receipt.filename,
      dataLength: receipt.data?.length,
      filePath: path.join(RECEIPTS_DIR, receipt.filename || 'unknown')
    });
    return null;
  }
}


// Save receipt from Multer buffer (for FormData uploads)
async function saveReceiptImageFromBuffer(file) {
  // Validate input
  if (!file || !file.buffer) {
    console.error('❌ Invalid file object for buffer save:', { 
      file: !!file, 
      hasBuffer: !!(file && file.buffer) 
    });
    return null;
  }

  try {
    // Ensure receipts directory exists
    console.log('🔧 Creating receipts directory if needed...');
    await fs.mkdir(RECEIPTS_DIR, { recursive: true });
    console.log('✅ Receipts directory ready:', RECEIPTS_DIR);

    // Generate secure filename
    const ext = path.extname(file.originalname) || '.png';
    const baseName = path.basename(file.originalname, ext) || 'receipt';
    
    // Sanitize baseName to prevent path traversal attacks
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${sanitizedBaseName}${ext}`;

    // Construct and validate file path
    const filePath = path.join(RECEIPTS_DIR, unique);
    const resolvedPath = path.resolve(filePath);
    
    // Security check: Prevent directory traversal
    if (!resolvedPath.startsWith(path.resolve(RECEIPTS_DIR))) {
      console.error('❌ Security: Path traversal attempt detected:', resolvedPath);
      return null;
    }

    console.log('📝 Writing receipt file:', { 
      filePath: resolvedPath, 
      fileSize: file.buffer.length 
    });

    // Write buffer to disk
    await fs.writeFile(resolvedPath, file.buffer);
    console.log('✅ Receipt saved successfully from buffer:', unique);

    // Generate and return URL
    const receiptUrl = `${RECEIPTS_URL_BASE}/${unique}`;
    console.log('🔗 Generated receipt URL:', receiptUrl);
    return receiptUrl;

  } catch (error) {
    console.error('❌ Error saving receipt from buffer:', {
      error: error.message,
      stack: error.stack,
      filename: file.originalname,
      fileSize: file.buffer?.length
    });
    return null;
  }
}


/**
 * Create a new payment for a caterer sale/bill
 * Handles transactions properly with rollback support
 */
const createCatererPayment = async (req, res) => {
  const startTime = Date.now();
  let connection;
  
  try {
    console.log('🚀 Starting caterer payment creation process at:', new Date().toISOString());
    
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
      hasFileUpload: !!req.file,
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
    const receiptStartTime = Date.now();
    console.log('📁 Starting receipt processing at:', new Date().toISOString());
    
    try {
      if (req.file) {
        console.log('📁 Processing Multer file upload:', {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          fieldname: req.file.fieldname,
          filename: req.file.filename,
          path: req.file.path
        });
        
        // Multer already saved the file, just create the URL path
        receiptPath = `${RECEIPTS_URL_BASE}/${req.file.filename}`;
        
        // Verify the file actually exists
        try {
          await fs.access(req.file.path);
          console.log('✅ Receipt file verified to exist:', req.file.path);
        } catch (fileError) {
          console.error('❌ Receipt file does not exist:', req.file.path, fileError.message);
          receiptPath = null; // Don't save invalid path to database
        }
      } else if (receipt && receipt.data) {
        console.log('📁 Processing base64 receipt data:', {
          hasFilename: !!receipt.filename,
          filename: receipt.filename,
          dataLength: receipt.data ? receipt.data.length : 0
        });
        receiptPath = await saveReceiptImage(receipt);
        
        // Verify the file actually exists
        if (receiptPath) {
          const filePath = path.join(RECEIPTS_DIR, path.basename(receiptPath));
          try {
            await fs.access(filePath);
            console.log('✅ Receipt file verified to exist:', filePath);
          } catch (fileError) {
            console.error('❌ Receipt file does not exist:', filePath, fileError.message);
            receiptPath = null; // Don't save invalid path to database
          }
        }
      }
      
      const receiptEndTime = Date.now();
      console.log('📁 Receipt processing completed:', {
        receiptPath,
        processingTime: `${receiptEndTime - receiptStartTime}ms`,
        success: !!receiptPath
      });
      
      // Validate receiptPath before database insertion
      if (!receiptPath) {
        console.warn('⚠️ No receipt path generated - proceeding without receipt image');
      }
    } catch (receiptError) {
      const receiptEndTime = Date.now();
      console.error('❌ Receipt processing failed:', {
        error: receiptError.message,
        stack: receiptError.stack,
        processingTime: `${receiptEndTime - receiptStartTime}ms`,
        reqFile: !!req.file,
        hasReceiptData: !!(receipt && receipt.data)
      });
      receiptPath = null;
    }

    // Insert payment record with enhanced validation and logging
    console.log('💾 Preparing database insertion:', {
      bill_id,
      normalizedMethod,
      paymentAmount,
      referenceNumber,
      hasNotes: !!notes,
      receiptPath,
      receiptPathValid: !!receiptPath
    });

    // Validate receiptPath before insertion
    if (receiptPath) {
      try {
        const filePath = path.join(RECEIPTS_DIR, path.basename(receiptPath));
        await fs.access(filePath);
        console.log('✅ Receipt file verified for database insertion:', filePath);
      } catch (fileError) {
        console.error('❌ Receipt file verification failed, proceeding without receipt path:', {
          receiptPath,
          error: fileError.message,
          filePath: path.join(RECEIPTS_DIR, path.basename(receiptPath))
        });
        receiptPath = null;
      }
    }

    const insertStartTime = Date.now();
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

    const insertEndTime = Date.now();
    const paymentId = paymentResult.insertId;
    console.log('✅ Payment record inserted successfully:', {
      paymentId,
      insertTime: `${insertEndTime - insertStartTime}ms`,
      receiptPathUsed: receiptPath,
      finalReceiptPath: receiptPath || null
    });

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
    const commitStartTime = Date.now();
    await connection.commit();
    const commitEndTime = Date.now();
    console.log('✅ Transaction committed successfully:', {
      commitTime: `${commitEndTime - commitStartTime}ms`,
      totalProcessTime: `${commitEndTime - startTime}ms`
    });

    const endTime = Date.now();
    console.log('🎉 Caterer payment creation completed successfully:', {
      paymentId,
      totalProcessTime: `${endTime - startTime}ms`,
      receiptPath,
      finalStatus: newStatus
    });

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
    const errorTime = Date.now();
    console.error('❌ Error creating caterer payment:', {
      error: error.message,
      stack: error.stack,
      totalProcessTime: `${errorTime - startTime}ms`,
      errorType: error.constructor.name,
      hasConnection: !!connection
    });

    // Rollback transaction on error
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔄 Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', {
          rollbackError: rollbackError.message,
          stack: rollbackError.stack
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to record payment',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        processingTime: `${errorTime - startTime}ms`
      })
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
