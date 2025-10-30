const express = require('express');
const router = express.Router();
const db = require('../config/database.cjs');
const path = require('path');
const fs = require('fs/promises');
const { extension: mimeToExt } = require('mime-types'); // npm i mime-types

// Storage constants
const RECEIPTS_DIR = path.join(process.cwd(), 'server', 'caterers', 'reciept'); // filesystem [web:22]
const RECEIPTS_URL_BASE = '/caterers/reciept'; // URL base (forward slashes) [web:22]

// Floor helpers (2 decimals)
const floor2 = (n) => Math.floor((Number(n) || 0) * 100) / 100; // 420.0002 -> 420.00 [web:175][web:169]

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

// Parse data URL for MIME/base64
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

// Save receipt image once with original extension
async function saveReceiptImage(receipt) {
  if (!receipt?.data) return null;

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

  return `${RECEIPTS_URL_BASE}/${unique}`;
}

// Payment amount derivation with 2-dec floor
function derivePaymentAmount(option, grandTotal, customAmount) {
  const gt = Number(grandTotal) || 0;
  const opt = String(option || 'full').toLowerCase();
  if (opt === 'full') return floor2(gt);
  if (opt === 'half') return floor2(gt / 2);
  if (opt === 'custom') return floor2(customAmount || 0);
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

    // Normalize input and floor sale totals
    saleData.bill_number = normBill(saleData.bill_number);
    const normalizedMethod = methodMap[String(saleData.payment_method || '').toLowerCase()] || 'cash';
    const subtotalFloored = floor2(saleData.subtotal || 0);
    const gstFloored      = floor2(saleData.total_gst || 0);
    const itemsFloored    = floor2(saleData.items_total || 0);
    const otherFloored    = floor2(saleData.other_charges_total || 0);
    const grandFloored    = floor2(saleData.grand_total);

    // 1) Insert sale with 'pending'
    const [saleResult] = await connection.execute(
      `INSERT INTO caterer_sales
       (caterer_id, bill_number, sell_date, subtotal, total_gst,
        items_total, other_charges_total, grand_total, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        saleData.caterer_id,
        saleData.bill_number,
        saleData.sell_date,
        subtotalFloored,
        gstFloored,
        itemsFloored,
        otherFloored,
        grandFloored,
        'pending'
      ]
    );
    const saleId = saleResult.insertId;

    // 2) Insert items (mix-aware) with floored amounts
    if (saleData.items && saleData.items.length > 0) {
      let currentMixId = 1;
      for (const item of saleData.items) {
        const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
        const gstAmount = Number(item.gst_amount || 0);
        const totalRaw = item.isMix || item.total ? parseFloat(item.total || amount) : (amount + gstAmount);
        const amountFloored = floor2(amount);
        const gstAmountFloored = floor2(gstAmount);
        const totalAmountFloored = floor2(totalRaw);

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
              amountFloored,
              item.gst_percentage || item.gst || 0,
              gstAmountFloored,
              totalAmountFloored,
              batchNumber || null,
              expiryDate || null,
              true,
              currentMixId,
              null,
              JSON.stringify(item.mixItems)
            ]
          );
          const mixHeaderId = mixHeaderResult.insertId;

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

            const allocFloored = floor2(mixItem.allocatedBudget || 0);

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
                allocFloored,
                0,
                0,
                allocFloored,
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
              amountFloored,
              item.gst_percentage || item.gst || 0,
              gstAmountFloored,
              totalAmountFloored,
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

    // 3) Other charges (floor to 2 decimals)
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
          [
            saleId,
            charge.name || '',
            floor2(charge.value || 0),
            chargeType
          ]
        );
      }
    }

    // 4) Payment record (+ receipt path) with floored amount
    let receiptPath = null;
    if (saleData.receipt_image?.data) {
      receiptPath = await saveReceiptImage(saleData.receipt_image);
    }

    const payAmountFloored = derivePaymentAmount(
      saleData.payment_option,
      grandFloored,
      saleData.payment_amount
    );

    await connection.execute(
      `INSERT INTO caterer_sale_payments
       (sale_id, payment_date, payment_method, payment_option, payment_amount, receipt_image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        saleId,
        saleData.payment_date || new Date().toISOString().split('T')[0],
        normalizedMethod,
        saleData.payment_option || 'full',
        payAmountFloored,
        receiptPath || null
      ]
    );

    // Recompute status using floored SUM in SQL and floored comparison
    const [[sumRow]] = await connection.query(
      'SELECT FLOOR(COALESCE(SUM(payment_amount),0) * 100) / 100 AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
      [saleId]
    );

    const tp = Number(sumRow?.total_paid || 0);
    const remaining = Math.max(0, floor2(grandFloored - tp));

    let finalStatus = 'pending';
    if (remaining <= 0 && tp > 0) finalStatus = 'paid';
    else if (tp > 0 && remaining > 0) finalStatus = 'partial';

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
      grand_total: grandFloored,
      payment_status: finalStatus,
      total_paid: tp
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

// GET /api/caterer-sales/caterer/:caterer_id (floored totals)
router.get('/caterer/:caterer_id', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute(
      `SELECT cs.*,
              (SELECT COUNT(*) FROM caterer_sale_items WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) AS items_count,
              (SELECT FLOOR(COALESCE(SUM(payment_amount),0) * 100) / 100 FROM caterer_sale_payments WHERE sale_id = cs.id) AS total_paid
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

// GET /api/caterer-sales/:sale_id/details (floored totals)
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

    const [[paidRow]] = await db.pool.execute(
      'SELECT FLOOR(COALESCE(SUM(payment_amount),0) * 100) / 100 AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
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

// GET /api/caterer-sales (floored totals + filters)
router.get('/', logRequest, async (req, res) => {
  try {
    const {
      caterer_id,
      payment_status,
      start_date,
      end_date,
      min_amount,
      max_amount,
      search
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (caterer_id) {
      whereConditions.push('cs.caterer_id = ?');
      queryParams.push(caterer_id);
    }
    if (payment_status && ['paid', 'pending', 'partial', 'overdue', 'cancelled'].includes(payment_status)) {
      whereConditions.push('cs.payment_status = ?');
      queryParams.push(payment_status);
    }
    if (start_date) {
      whereConditions.push('cs.sell_date >= ?');
      queryParams.push(start_date);
    }
    if (end_date) {
      whereConditions.push('cs.sell_date <= ?');
      queryParams.push(end_date);
    }
    if (min_amount) {
      whereConditions.push('cs.grand_total >= ?');
      queryParams.push(parseFloat(min_amount));
    }
    if (max_amount) {
      whereConditions.push('cs.grand_total <= ?');
      queryParams.push(parseFloat(max_amount));
    }
    if (search) {
      whereConditions.push('(cs.bill_number LIKE ? OR c.caterer_name LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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
             (SELECT FLOOR(COALESCE(SUM(payment_amount),0) * 100) / 100 FROM caterer_sale_payments WHERE sale_id = cs.id) AS total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      ${whereClause}
      ORDER BY cs.sell_date DESC, cs.created_at DESC
    `, queryParams);

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
