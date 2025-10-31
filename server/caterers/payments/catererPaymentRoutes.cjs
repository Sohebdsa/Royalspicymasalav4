const express = require('express');
const router = express.Router();
const db = require('../../config/database.cjs');
const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types'); // npm i mime-types

// New storage constants
const RECEIPTS_DIR = path.join(__dirname, 'reciept'); // filesystem
const RECEIPTS_URL_BASE = '/caterers/assets/reciept'; // URL base (forward slashes)

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

// Single-extension, new-folder image saver
async function saveReceiptImage(receipt) {
  if (!receipt?.data) return null;

  await fs.mkdir(RECEIPTS_DIR, { recursive: true });

  // Clean and parse filename
  const originalName = path.basename(String(receipt.filename || 'receipt').trim());
  const nameParts = path.parse(originalName);

  const parsed = parseDataUrl(receipt.data);

  // Decide one extension
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

  // Store forward-slash URL path in DB
  return `${RECEIPTS_URL_BASE}/${unique}`;
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

const validateSalesData = (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: 'Request body is required', error: 'EMPTY_REQUEST_BODY' });
    }
    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: 'Request body must be an object', error: 'INVALID_REQUEST_FORMAT' });
    }
    const required = ['caterer_id', 'bill_number', 'sell_date', 'grand_total'];
    const missing = required.filter(field => !req.body[field]);
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}`, error: 'MISSING_REQUIRED_FIELDS' });
    }
    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required', error: 'INVALID_ITEMS' });
    }
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(400).json({ success: false, message: 'Invalid JSON data', error: 'JSON_PARSE_ERROR' });
  }
};

// POST /api/caterer-sales/create
router.post('/create', logRequest, validateSalesData, async (req, res) => {
  let connection;
  try {
    if (!db || !db.pool) {
      console.error('❌ Database pool is not configured');
      return res.status(500).json({ success: false, message: 'Database connection not configured', error: 'DB_POOL_NOT_FOUND' });
    }

    connection = await db.pool.getConnection();
    await connection.beginTransaction();

    const saleData = req.body;
    const timestamp = new Date().toISOString();

    // Normalize input
    saleData.bill_number = normBill(saleData.bill_number);
    const normalizedMethod = methodMap[String(saleData.payment_method || '').toLowerCase()] || 'cash';
    const derivedPayAmount = derivePaymentAmount(saleData.payment_option, saleData.grand_total, saleData.payment_amount);

    const remainingAfterDerived = Math.max(0, +(Number(saleData.grand_total) - Number(derivedPayAmount)).toFixed(2));
    let initialStatus = 'pending';
    if (remainingAfterDerived === 0 && Number(derivedPayAmount) > 0) initialStatus = 'paid';
    else if (Number(derivedPayAmount) > 0) initialStatus = 'partial';

    // 1) Insert sale
    const [saleResult] = await connection.execute(
      `INSERT INTO caterer_sales
       (caterer_id, bill_number, sell_date, subtotal, total_gst,
        items_total, other_charges_total, grand_total, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleData.caterer_id,
        saleData.bill_number,
        saleData.sell_date,
        saleData.subtotal || 0,
        saleData.total_gst || 0,
        saleData.items_total || 0,
        saleData.other_charges_total || 0,
        saleData.grand_total,
        initialStatus
      ]
    );
    const saleId = saleResult.insertId;

    // 2) Insert items (mix-aware)
    if (saleData.items && saleData.items.length > 0) {
      let currentMixId = 1;
      for (const item of saleData.items) {
        const amount = (item.quantity || 0) * (item.rate || 0);
        const gstAmount = item.gst_amount || 0;
        const totalAmount = item.isMix || item.total ? parseFloat(item.total || amount) : (amount + gstAmount);

        const isMixProduct = item.isMix || (item.product_id && item.product_id.toString().startsWith('mix-'));

        let batchNumber = null;
        let expiryDate = null;
        if (item.batch) {
          batchNumber = item.batch;
          expiryDate = item.expiry_date || null;
        } else if (item.batches && Array.isArray(item.batches) && item.batches.length > 0) {
          const firstBatch = item.batches[0];
          batchNumber = firstBatch.batch;
          expiryDate = firstBatch.expiry_date || null;
        }

        if (isMixProduct && item.mixItems && Array.isArray(item.mixItems) && item.mixItems.length > 0) {
          // header
          const [mixHeaderResult] = await connection.execute(
            `INSERT INTO caterer_sale_items
             (sale_id, product_id, product_name, quantity, unit, rate,
              amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
              is_mix, mix_id, parent_sale_item_id, mix_item_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              item.product_id || null,
              item.product_name || '',
              item.quantity || 0,
              item.unit || 'mix',
              item.rate || 0,
              amount || 0,
              item.gst_percentage || item.gst || 0,
              gstAmount || 0,
              totalAmount || 0,
              batchNumber || null,
              expiryDate || null,
              true,
              currentMixId,
              null,
              JSON.stringify(item.mixItems)
            ]
          );
          const mixHeaderId = mixHeaderResult.insertId;

          // components
          for (const mixItem of item.mixItems) {
            let mixItemBatch = null;
            let mixItemExpiry = null;
            if (mixItem.batch) {
              mixItemBatch = mixItem.batch;
              mixItemExpiry = mixItem.expiry_date || null;
            } else if (mixItem.batches && Array.isArray(mixItem.batches) && mixItem.batches.length > 0) {
              const firstBatch = mixItem.batches[0];
              mixItemBatch = firstBatch.batch;
              mixItemExpiry = firstBatch.expiry_date || null;
            }

            await connection.execute(
              `INSERT INTO caterer_sale_items
               (sale_id, product_id, product_name, quantity, unit, rate,
                amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
                is_mix, mix_id, parent_sale_item_id, mix_item_data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                saleId,
                mixItem.product_id || mixItem.id || null,
                mixItem.product_name || mixItem.name || '',
                mixItem.calculatedQuantity || mixItem.quantity || 0,
                mixItem.unit || 'kg',
                mixItem.rate || 0,
                mixItem.allocatedBudget || 0,
                0,
                0,
                mixItem.allocatedBudget || 0,
                mixItemBatch || null,
                mixItemExpiry || null,
                false,
                currentMixId,
                mixHeaderId,
                null
              ]
            );
          }
          currentMixId++;
        } else {
          // regular item
          await connection.execute(
            `INSERT INTO caterer_sale_items
             (sale_id, product_id, product_name, quantity, unit, rate,
              amount, gst_percentage, gst_amount, total_amount, batch_number, expiry_date,
              is_mix, mix_id, parent_sale_item_id, mix_item_data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              saleId,
              item.product_id || null,
              item.product_name || '',
              item.quantity || 0,
              item.unit || 'kg',
              item.rate || 0,
              amount || 0,
              item.gst_percentage || item.gst || 0,
              gstAmount || 0,
              totalAmount || 0,
              batchNumber || null,
              expiryDate || null,
              false,
              null,
              null,
              null
            ]
          );
        }
      }
    }

    // 3) Other charges
    if (saleData.other_charges && Array.isArray(saleData.other_charges) && saleData.other_charges.length > 0) {
      for (const charge of saleData.other_charges) {
        let chargeType = charge.type || 'fixed';
        if (chargeType === 'discount') {
          chargeType = charge.value_type === 'percentage' ? 'percentage' : 'fixed';
        }
        await connection.execute(
          `INSERT INTO caterer_sale_other_charges
           (sale_id, charge_name, charge_amount, charge_type)
           VALUES (?, ?, ?, ?)`,
          [saleId, charge.name || '', charge.value || 0, chargeType]
        );
      }
    }

    // 4) Payment record (+ receipt path)
    let receiptPath = null;
    if (saleData.receipt_image?.data) {
      receiptPath = await saveReceiptImage(saleData.receipt_image);
    }

    await connection.execute(
      `INSERT INTO caterer_sale_payments
       (sale_id, payment_date, payment_method, payment_option, payment_amount, receipt_image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        saleData.payment_date || new Date().toISOString().split('T')[0],
        normalizedMethod,
        saleData.payment_option || 'full',
        derivePaymentAmount(saleData.payment_option, saleData.grand_total, saleData.payment_amount),
        receiptPath || null
      ]
    );

    // Recompute status from authoritative SUM
    const [[{ total_paid }]] = await connection.query(
      'SELECT COALESCE(SUM(payment_amount),0) AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
      [saleId]
    );
    const gt = Number(saleData.grand_total);
    const remaining = Math.max(0, +(gt - Number(total_paid)).toFixed(2));
    let finalStatus = 'pending';
    if (remaining === 0 && Number(total_paid) > 0) finalStatus = 'paid';
    else if (Number(total_paid) > 0) finalStatus = 'partial';

    await connection.execute(
      'UPDATE caterer_sales SET payment_status = ? WHERE id = ?',
      [finalStatus, saleId]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      sale_id: saleId,
      bill_number: saleData.bill_number,
      grand_total: saleData.grand_total,
      payment_status: finalStatus,
      total_paid: Number(total_paid)
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('❌ Error creating sale:', error);
    res.status(500).json({ success: false, message: 'Failed to create sale', error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/caterer-sales/caterer/:caterer_id
router.get('/caterer/:caterer_id', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute(
      `SELECT cs.*,
              (SELECT COUNT(*) FROM caterer_sale_items WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) AS items_count,
              (SELECT COALESCE(SUM(payment_amount),0) FROM caterer_sale_payments WHERE sale_id = cs.id) AS total_paid
       FROM caterer_sales cs
       WHERE cs.caterer_id = ?
       ORDER BY cs.sell_date DESC, cs.created_at DESC`,
      [req.params.caterer_id]
    );

    res.json({ success: true, sales, count: sales.length });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sales', error: error.message });
  }
});

// GET /api/caterer-sales/:sale_id/details
router.get('/:sale_id/details', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute('SELECT * FROM caterer_sales WHERE id = ?', [req.params.sale_id]);
    if (sales.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });

    const [allItems] = await db.pool.execute(
      'SELECT * FROM caterer_sale_items WHERE sale_id = ? ORDER BY id',
      [req.params.sale_id]
    );

    const parentItems = allItems.filter(item => item.parent_sale_item_id === null);
    const processedItems = parentItems.map(item => {
      if (item.is_mix === 1) {
        const mixComponents = allItems.filter(child => child.parent_sale_item_id === item.id && child.mix_id === item.mix_id);
        return {
          ...item,
          is_mix: true,
          mix_items: mixComponents.map(comp => ({
            product_id: comp.product_id,
            product_name: comp.product_name,
            quantity: parseFloat(comp.quantity),
            unit: comp.unit,
            rate: parseFloat(comp.rate),
            allocatedBudget: parseFloat(comp.total_amount),
            batch_number: comp.batch_number,
            expiry_date: comp.expiry_date
          }))
        };
      }
      return { ...item, is_mix: false };
    });

    const [payments] = await db.pool.execute(
      'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
      [req.params.sale_id]
    );

    const [charges] = await db.pool.execute(
      'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ? ORDER BY id',
      [req.params.sale_id]
    );

    // Include computed total_paid for the detail payload
    const [[paidRow]] = await db.pool.execute(
      'SELECT COALESCE(SUM(payment_amount),0) AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
      [req.params.sale_id]
    );

    res.json({
      success: true,
      sale: {
        ...sales[0],
        total_paid: Number(paidRow?.total_paid || 0),
        items: processedItems,
        payments: payments || [],
        other_charges: charges || []
      }
    });
  } catch (error) {
    console.error('Error fetching sale details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sale details', error: error.message });
  }
});

// GET /api/caterer-sales/next-bill-number
router.get('/next-bill-number', logRequest, async (req, res) => {
  try {
    const [result] = await db.pool.execute('SELECT bill_number FROM caterer_sales ORDER BY id DESC LIMIT 1');
    let nextBillNumber = '#0001';
    if (result.length > 0) {
      const lastBillNumber = result[0].bill_number;
      const numberPart = parseInt(lastBillNumber.replace('#', ''));
      const nextNumber = numberPart + 1;
      nextBillNumber = `#${String(nextNumber).padStart(4, '0')}`;
    }
    res.json({ success: true, bill_number: nextBillNumber });
  } catch (error) {
    console.error('Error getting next bill number:', error);
    res.json({ success: true, bill_number: '#0001' });
  }
});

// GET /api/caterer-sales (all, with computed total_paid)
router.get('/', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute(`
      SELECT cs.*,
             c.caterer_name,
             c.contact_person,
             c.phone_number,
             c.email,
             c.address,
             c.city,
             c.state,
             c.pincode,
             c.gst_number,
             (SELECT COUNT(*) FROM caterer_sale_items WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) AS items_count,
             (SELECT COALESCE(SUM(payment_amount),0) FROM caterer_sale_payments WHERE sale_id = cs.id) AS total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      ORDER BY cs.sell_date DESC, cs.created_at DESC
    `);

    const salesWithDetails = await Promise.all(
      sales.map(async (sale) => {
        const [allItems] = await db.pool.execute(
          `SELECT * FROM caterer_sale_items WHERE sale_id = ? ORDER BY id`,
          [sale.id]
        );

        const parentItems = allItems.filter(item => item.parent_sale_item_id === null);
        const processedItems = parentItems.map(item => {
          if (item.is_mix === 1) {
            const mixComponents = allItems.filter(child => child.parent_sale_item_id === item.id && child.mix_id === item.mix_id);
            return {
              ...item,
              is_mix: true,
              mix_items: mixComponents.map(comp => ({
                product_id: comp.product_id,
                product_name: comp.product_name,
                quantity: parseFloat(comp.quantity),
                unit: comp.unit,
                rate: parseFloat(comp.rate),
                allocatedBudget: parseFloat(comp.total_amount),
                batch_number: comp.batch_number,
                expiry_date: comp.expiry_date
              }))
            };
          }
          return { ...item, is_mix: false };
        });

        const [payments] = await db.pool.execute(
          'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
          [sale.id]
        );

        const [charges] = await db.pool.execute(
          'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ? ORDER BY id',
          [sale.id]
        );

        return {
          ...sale,
          items: processedItems,
          payments: payments || [],
          other_charges: charges || []
        };
      })
    );

    res.json({ success: true, data: salesWithDetails, count: salesWithDetails.length });
  } catch (error) {
    console.error('❌ Error fetching caterer sales:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch caterer sales', error: error.message });
  }
});

// Health/test helpers unchanged...

// Serve receipt images from new folder safely
router.get('/receipts/:filename', (req, res) => {
  const filename = path.basename(req.params.filename || '');
  if (!filename) {
    return res.status(400).json({ success: false, message: 'Invalid filename' });
  }
  res.sendFile(filename, { root: RECEIPTS_DIR }, (err) => {
    if (err) {
      console.error('❌ Error serving receipt image:', err);
      res.status(404).json({ success: false, message: 'Receipt image not found', error: err.message });
    }
  });
});

module.exports = router;
