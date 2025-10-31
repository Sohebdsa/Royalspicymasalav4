const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types'); // npm i mime-types
const db = require('../../config/database.cjs');

// Storage locations
const RECEIPTS_DIR = path.join(__dirname, 'reciept'); // filesystem path
const RECEIPTS_URL_BASE = '/caterers/reciept'; // URL path (forward slashes)

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

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

async function saveReceiptImage(receipt) {
  if (!receipt?.data) return null;

  await fs.mkdir(RECEIPTS_DIR, { recursive: true });

  // Sanitize and split once
  const originalName = path.basename(String(receipt.filename || 'receipt').trim());
  const nameParts = path.parse(originalName);

  const parsed = parseDataUrl(receipt.data);

  // Decide a single extension
  let finalExt;
  if (parsed) {
    const derived = mimeToExt(parsed.mime);
    finalExt = derived ? '.' + derived.toLowerCase() : (nameParts.ext || '.png');
  } else {
    finalExt = nameParts.ext || '.png';
  }

  // Base name without extension
  const base = nameParts.name || 'receipt';

  // Unique filename with exactly one extension
  const unique = `${Date.now()}_${base}${finalExt}`;

  // Write the file
  const filePath = path.join(RECEIPTS_DIR, unique);
  const b64 = parsed ? parsed.base64 : (receipt.data.split(',').pop() || receipt.data);
  await fs.writeFile(filePath, Buffer.from(b64, 'base64'));

  // Return URL path (forward slashes) for DB/client
  return `${RECEIPTS_URL_BASE}/${unique}`;
}

const createCatererPayment = async (req, res) => {
  try {
    const {
      caterer_id,
      bill_id,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
      receipt // optional: { filename, data, type }
    } = req.body;

    if (!caterer_id || !bill_id || !amount || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields: caterer_id, bill_id, amount, paymentMethod'
      });
    }

    const normalizedMethod = methodMap[String(paymentMethod).toLowerCase()] || 'cash';

    // Fetch grand_total and current pending
    const [billRows] = await db.query(
      'SELECT grand_total, pending_amount FROM caterer_bills WHERE id = ?',
      [bill_id]
    );
    if (!billRows || billRows.length === 0) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const grandTotal = parseFloat(billRows[0].grand_total || 0);
    const currentPending = parseFloat(billRows[0].pending_amount || 0);
    const paymentAmount = parseFloat(amount);

    if (!(paymentAmount > 0)) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }
    if (paymentAmount > currentPending) {
      return res.status(400).json({
        error: `Payment amount exceeds outstanding balance of ${currentPending.toFixed(2)}`
      });
    }

    const receiptPath = await saveReceiptImage(receipt);

    // Insert payment
    const [paymentResult] = await db.query(
      `INSERT INTO caterer_payments
       (caterer_id, bill_id, amount, payment_method, reference_number, notes, receipt_image, payment_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        caterer_id,
        bill_id,
        paymentAmount,
        normalizedMethod,
        referenceNumber || null,
        notes || null,
        receiptPath || null
      ]
    );

    // Recompute totals
    const [sumRows] = await db.query(
      'SELECT COALESCE(SUM(amount),0) AS total_paid FROM caterer_payments WHERE bill_id = ?',
      [bill_id]
    );
    const totalPaid = parseFloat(sumRows[0].total_paid || 0);
    const remaining = Math.max(0, +(grandTotal - totalPaid).toFixed(2));

    let newStatus = 'pending';
    if (remaining === 0) newStatus = 'paid';
    else if (totalPaid > 0) newStatus = 'partial';

    await db.query(
      'UPDATE caterer_bills SET pending_amount = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [remaining, newStatus, bill_id]
    );

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment_id: paymentResult.insertId,
      total_paid: +totalPaid.toFixed(2),
      remaining_due: remaining,
      status: newStatus,
      receipt_image: receiptPath || null
    });
  } catch (error) {
    console.error('Error creating caterer payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

// Serve receipt images for caterer payments (fixed root, forward-slash URL)
const serveCatererPaymentReceipt = async (req, res) => {
  try {
    const filename = path.basename(req.params.filename || '');
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }

    res.sendFile(filename, { root: RECEIPTS_DIR }, (err) => {
      if (err) {
        console.error('❌ Error serving caterer payment receipt image:', err);
        return res.status(404).json({
          success: false,
          message: 'Receipt image not found',
          error: err.message
        });
      }
    });
  } catch (error) {
    console.error('Error in serveCatererPaymentReceipt:', error);
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
