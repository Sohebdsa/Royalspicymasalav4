const express = require('express');
const router = express.Router();
const db = require('../../config/database.cjs');
const path = require('path');
const fs = require('fs/promises');

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

async function saveReceiptImage(receipt) {
  if (!receipt?.data) return null;
  const safeName = Date.now() + '_' + (receipt.filename || 'receipt');
  const ext = path.extname(receipt.filename || '') || '.png';
  const outDir = path.join(__dirname, '..', 'assets', 'receipts');
  await fs.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, safeName + ext);
  const base64 = receipt.data.split(',').pop();
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return '/caterers/assets/receipts/' + safeName + ext;
}

function derivePaymentAmount(option, grandTotal, customAmount) {
  const gt = Number(grandTotal) || 0;
  const opt = String(option || 'full').toLowerCase();
  if (opt === 'full') return gt;
  if (opt === 'half') return Math.round((gt / 2) * 100) / 100;
  if (opt === 'custom') return Number(customAmount || 0);
  return 0; // later
}

// Normalize bill number to #0001 style if you use that elsewhere
const normBill = b => {
  if (!b) return b;
  const num = String(b).replace('#', '').replace(/\D/g, '');
  return '#' + String(num).padStart(4, '0');
};

// Middleware to log requests
const logRequest = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
};

// Middleware to validate sales data
const validateSalesData = (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body is required',
        error: 'EMPTY_REQUEST_BODY'
      });
    }

    if (typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Request body must be an object',
        error: 'INVALID_REQUEST_FORMAT'
      });
    }

    const required = ['caterer_id', 'sell_date', 'grand_total'];
    const missing = required.filter(field => !req.body[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
        error: 'INVALID_ITEMS'
      });
    }

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

// POST /api/caterer-sales/create - Create new caterer sale with mix product support
router.post('/create',
  logRequest,
  validateSalesData,
  async (req, res) => {
    let connection;

    try {
      if (!db || !db.pool) {
        console.error('❌ Database pool is not configured');
        return res.status(500).json({
          success: false,
          message: 'Database connection not configured',
          error: 'DB_POOL_NOT_FOUND'
        });
      }

      connection = await db.pool.getConnection();
      console.log('✅ Database connection acquired');

      await connection.beginTransaction();
      console.log('🔄 Starting transaction for new sale');

      const saleData = req.body;
      console.log(saleData);
      const timestamp = new Date().toISOString();

      // Generate unique bill number if not provided or if it already exists
      let billNumber = normBill(saleData.bill_number);
      if (!billNumber) {
        // Get next available bill number
        const [result] = await connection.execute(
          `SELECT bill_number FROM caterer_sales ORDER BY id DESC LIMIT 1`
        );
        let nextBillNumber = '#0001';
        if (result.length > 0) {
          const lastBillNumber = result[0].bill_number;
          const numberPart = parseInt(lastBillNumber.replace('#', ''));
          const nextNumber = numberPart + 1;
          nextBillNumber = `#${String(nextNumber).padStart(4, '0')}`;
        }
        billNumber = nextBillNumber;
      } else {
        // Check if the provided bill number already exists
        const [existingBill] = await connection.execute(
          'SELECT id FROM caterer_sales WHERE bill_number = ?',
          [billNumber]
        );
        if (existingBill.length > 0) {
          // Bill number exists, generate a new one
          const [result] = await connection.execute(
            `SELECT bill_number FROM caterer_sales ORDER BY id DESC LIMIT 1`
          );
          let nextBillNumber = '#0001';
          if (result.length > 0) {
            const lastBillNumber = result[0].bill_number;
            const numberPart = parseInt(lastBillNumber.replace('#', ''));
            const nextNumber = numberPart + 1;
            nextBillNumber = `#${String(nextNumber).padStart(4, '0')}`;
          }
          billNumber = nextBillNumber;
        }
      }

      saleData.bill_number = billNumber;
      const normalizedMethod = methodMap[String(saleData.payment_method || '').toLowerCase()] || 'cash';
      const derivedPayAmount = derivePaymentAmount(saleData.payment_option, saleData.grand_total, saleData.payment_amount);

      const remainingAfterDerived = Math.max(0, +(Number(saleData.grand_total) - Number(derivedPayAmount)).toFixed(2));
      let initialStatus = 'pending';
      if (remainingAfterDerived === 0) initialStatus = 'paid';
      else if (Number(derivedPayAmount) > 0) initialStatus = 'partial';

      // console.log('📊 Processing sale data:', {
      //   caterer_id: saleData.caterer_id,
      //   bill_number: saleData.bill_number,
      //   items_count: saleData.items?.length || 0,
      //   grand_total: saleData.grand_total,
      //   payment_method: normalizedMethod,
      //   payment_amount: derivedPayAmount,
      //   payment_status: initialStatus
      // });

      // 1. Insert into caterer_sales table
      console.log('📝 Inserting into caterer_sales table...');
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
      // console.log(`✅ Sale created with ID: ${saleId}`);

      // 2. Insert sale items (including mix products)
      if (saleData.items && saleData.items.length > 0) {
        // console.log(`📝 Inserting ${saleData.items.length} sale items...`);

        let currentMixId = 1; // Mix ID counter for this sale

        for (const item of saleData.items) {
          const amount = (item.quantity || 0) * (item.rate || 0);
          const gstAmount = item.gst_amount || 0;
          const totalAmount = item.isMix || item.total ? parseFloat(item.total || amount) : (amount + gstAmount);

          // Check if this is a mix product
          const isMixProduct = item.isMix || (item.product_id && item.product_id.toString().startsWith('mix-'));

          // Handle batch information
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
            // Insert mix header item
            // console.log(`📦 Inserting mix product: ${item.product_name} (Mix ID: ${currentMixId})`);

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
                true, // is_mix
                currentMixId, // mix_id
                null, // parent_sale_item_id (null for header)
                JSON.stringify(item.mixItems) // Store full mix data as JSON backup
              ]
            );

            const mixHeaderId = mixHeaderResult.insertId;

            // Insert individual mix items
            // console.log(`   └─ Inserting ${item.mixItems.length} items in mix...`);
            for (const mixItem of item.mixItems) {
              // Get batch info for mix item
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
                  0, // gst_percentage for mix items
                  0, // gst_amount for mix items
                  mixItem.allocatedBudget || 0,
                  mixItemBatch || null,
                  mixItemExpiry || null,
                  false, // is_mix (these are components, not mix headers)
                  currentMixId, // Same mix_id as parent
                  mixHeaderId, // Reference to parent mix header
                  null // No mix_item_data for components
                ]
              );
            }

            currentMixId++; // Increment mix ID for next mix product
          } else {
            // Regular product (non-mix)
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
                false, // is_mix
                null, // mix_id
                null, // parent_sale_item_id
                null // mix_item_data
              ]
            );
          }
        }
        console.log(`✅ Inserted all sale items`);
      }

      // 3. Insert other charges
      if (saleData.other_charges && Array.isArray(saleData.other_charges) && saleData.other_charges.length > 0) {
        console.log(`📝 Inserting ${saleData.other_charges.length} other charges...`);
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
              charge.value || 0,
              chargeType
            ]
          );
        }
        console.log(`✅ Inserted ${saleData.other_charges.length} other charges`);
      }

      // 4. Insert payment record
      console.log('📝 Inserting payment record...');

      // Calculate final payment status based on all payments
      const [[{ total_paid }]] = await connection.query(
        'SELECT COALESCE(SUM(payment_amount),0) AS total_paid FROM caterer_sale_payments WHERE sale_id = ?',
        [saleId]
      );
      const gt = Number(saleData.grand_total);
      const remaining = Math.max(0, +(gt - Number(total_paid)).toFixed(2));
      let finalStatus = 'pending';
      if (remaining === 0 && Number(total_paid) > 0) finalStatus = 'paid';
      else if (Number(total_paid) > 0) finalStatus = 'partial';

      console.log('📊 Final payment status calculation:', {
        grand_total: gt,
        total_paid: total_paid,
        remaining: remaining,
        finalStatus: finalStatus,
        logic: remaining === 0 && Number(total_paid) > 0 ? 'paid' : (Number(total_paid) > 0 ? 'partial' : 'pending')
      });

      // Update payment status
      await connection.execute(
        'UPDATE caterer_sales SET payment_status = ? WHERE id = ?',
        [finalStatus, saleId]
      );
      console.log(`📊 Payment status updated to: ${finalStatus}`);

      // Handle receipt image if present
      let receiptPath = null;
      if (saleData.receipt_image?.data) {
        receiptPath = await saveReceiptImage(saleData.receipt_image);
        console.log('📸 Receipt image saved:', receiptPath);
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
          derivedPayAmount,
          receiptPath || null
        ]
      );
      console.log('✅ Payment record inserted');

      // 5. Perform inventory deduction within the same transaction
      console.log('🔄 Starting inventory deduction for sale...');
      try {
        const { deductProductsFromInventory, checkInventorySufficiency } = require('../catererBillInventoryDeduction.cjs');

        // Prepare inventory deduction data
        // Need to restructure mix items: group mix components under their parent mix header
        const processedItems = [];
        const mixItemsMap = new Map(); // Track mix items by mixName

        // First pass: collect all mix items grouped by mixName
        for (const item of saleData.items) {
          if (item.isMixItem && item.mixName) {
            if (!mixItemsMap.has(item.mixName)) {
              mixItemsMap.set(item.mixName, []);
            }
            mixItemsMap.get(item.mixName).push({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              unit: item.unit,
              rate: item.rate,
              batch_number: item.batch_number || item.batch || (item.batches && item.batches[0] ? item.batches[0].batch : null),
              batch: item.batch_number || item.batch || (item.batches && item.batches[0] ? item.batches[0].batch : null)
            });
          }
        }

        // Second pass: build final items array with mix headers containing their components
        for (const item of saleData.items) {
          if (item.isMixHeader && item.mixName) {
            // This is a mix header - add it with its components
            const mixComponents = mixItemsMap.get(item.mixName) || [];
            processedItems.push({
              ...item,
              isMix: true,
              mixItems: mixComponents,
              batch: item.batch_number || item.batch || (item.batches && item.batches[0] ? item.batches[0].batch : null)
            });
          } else if (!item.isMixItem) {
            // Regular item (not part of a mix)
            processedItems.push({
              ...item,
              batch: item.batch_number || item.batch || (item.batches && item.batches[0] ? item.batches[0].batch : null)
            });
          }
          // Skip standalone mix items - they're already included in their parent mix header
        }

        const inventoryData = {
          id: saleId,
          bill_number: saleData.bill_number,
          items: processedItems
        };

        console.log('📦 Preparing inventory deduction data:');
        console.log(`   Sale ID: ${inventoryData.id}`);
        console.log(`   Bill Number: ${inventoryData.bill_number}`);
        console.log(`   Items: ${inventoryData.items.length}`);

        if (inventoryData.items && Array.isArray(inventoryData.items)) {
          inventoryData.items.forEach((item, index) => {
            if (item.isMix && item.mixItems) {
              console.log(`   ${index + 1}. ${item.product_name} (MIX) - Qty: ${item.quantity} - Product ID: ${item.product_id}`);
              item.mixItems.forEach((mixItem, mixIndex) => {
                console.log(`      └─ ${mixIndex + 1}. ${mixItem.product_name} - Qty: ${mixItem.quantity} ${mixItem.unit} - Batch: ${mixItem.batch || 'N/A'}`);
              });
            } else {
              console.log(`   ${index + 1}. ${item.product_name} - Qty: ${item.quantity} - Product ID: ${item.product_id} - Batch: ${item.batch || 'N/A'}`);
            }
          });
        } else {
          console.log('   ⚠️ No items found in inventory data');
          throw new Error('No items found in bill data for inventory deduction');
        }

        // Pre-check inventory sufficiency before attempting deduction
        console.log('🔍 Pre-checking inventory sufficiency...');

        // Build a map of product quantities (aggregate all items including mix components)
        const productQuantityMap = new Map();

        for (const item of inventoryData.items) {
          // If this is a mix product, process its components
          if (item.isMix && item.mixItems && Array.isArray(item.mixItems)) {
            console.log(`   📦 Processing mix: ${item.product_name} with ${item.mixItems.length} components`);

            for (const mixItem of item.mixItems) {
              if (mixItem.product_id && !String(mixItem.product_id).startsWith('mix-')) {
                const productId = parseInt(mixItem.product_id);
                const quantity = parseFloat(mixItem.quantity) || 0;

                if (productQuantityMap.has(productId)) {
                  productQuantityMap.set(productId, productQuantityMap.get(productId) + quantity);
                } else {
                  productQuantityMap.set(productId, quantity);
                }

                console.log(`      └─ Product ${productId} (${mixItem.product_name}): ${quantity} ${mixItem.unit} (Total so far: ${productQuantityMap.get(productId)})`);
              }
            }
          }
          // Regular product (not a mix)
          else if (item.product_id && !String(item.product_id).startsWith('mix-')) {
            const productId = parseInt(item.product_id);
            const quantity = parseFloat(item.quantity) || 0;

            if (productQuantityMap.has(productId)) {
              productQuantityMap.set(productId, productQuantityMap.get(productId) + quantity);
            } else {
              productQuantityMap.set(productId, quantity);
            }

            console.log(`   📊 Product ${productId} (${item.product_name}): ${quantity} ${item.unit} (Total so far: ${productQuantityMap.get(productId)})`);
          }
        }

        console.log(`   📋 Total unique products to check: ${productQuantityMap.size}`);

        // Now check inventory sufficiency for each unique product
        for (const [productId, requiredQuantity] of productQuantityMap.entries()) {
          const sufficiencyCheck = await checkInventorySufficiency(
            productId,
            requiredQuantity
          );

          // Get product name for better error messages
          const [productInfo] = await connection.execute(
            'SELECT name FROM products WHERE id = ?',
            [productId]
          );
          const productName = productInfo.length > 0 ? productInfo[0].name : `Product ${productId}`;

          console.log(`   ${productName}:`);
          console.log(`      Required: ${requiredQuantity}, Available: ${sufficiencyCheck.availableQuantity}`);

          if (!sufficiencyCheck.isSufficient) {
            console.error(`   ❌ INSUFFICIENT INVENTORY for ${productName}`);
            console.error(`      Required: ${requiredQuantity}, Available: ${sufficiencyCheck.availableQuantity}`);
            console.error(`      Deficit: ${sufficiencyCheck.deficit}`);
            throw new Error(`Insufficient inventory for product ${productName}. Required: ${requiredQuantity}, Available: ${sufficiencyCheck.availableQuantity}`);
          }

          console.log(`   ✅ Sufficient inventory confirmed`);
        }
        // Perform inventory deduction
        console.log('🔄 Performing inventory deduction...');
        await deductProductsFromInventory(inventoryData);
        console.log('✅ Inventory deduction completed successfully');
        console.log('✅ All inventory deductions verified successfully');

      } catch (deductionError) {
        console.error('❌ INVENTORY DEDUCTION FAILED');
        console.error('❌ Error message:', deductionError.message);
        console.error('❌ Error type:', deductionError.constructor.name);
        console.error('❌ Rolling back entire transaction to prevent database inconsistency...');
        console.error('❌ No bill will be created to maintain data integrity');
        throw deductionError; // This will cause the transaction to rollback
      }

      // Commit the transaction only if everything succeeds
      console.log('🎯 All validations passed - committing transaction...');
      await connection.commit();
      console.log('✅ TRANSACTION COMMITTED SUCCESSFULLY');
      console.log('✅ Bill created and inventory deducted - database is consistent');

      const responseData = {
        success: true,
        message: 'Sale created successfully',
        sale_id: saleId,
        bill_number: saleData.bill_number,
        grand_total: saleData.grand_total,
        createdAt: timestamp
      };

      console.log('📤 Sale creation response:', responseData);
      res.status(201).json(responseData);

    } catch (error) {
      if (connection) {
        await connection.rollback();
        console.error('🔄 Transaction rolled back due to error:', error.message);
      }

      console.error('❌ Error creating sale:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        sql: error.sql,
        stack: error.stack
      });

      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to create sale';
      let errorType = 'UNKNOWN_ERROR';

      if (error.message.includes('inventory') || error.message.includes('deduction')) {
        errorMessage = 'Failed to deduct products from inventory. Sale not created.';
        errorType = 'INVENTORY_DEDUCTION_FAILED';
      } else if (error.message.includes('product') && error.message.includes('not found')) {
        errorMessage = 'One or more products not found in inventory. Sale not created.';
        errorType = 'PRODUCT_NOT_FOUND';
      } else if (error.message.includes('insufficient quantity')) {
        errorMessage = 'Insufficient quantity in inventory. Sale not created.';
        errorType = 'INSUFFICIENT_INVENTORY';
      } else if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = 'Duplicate bill number. Please try again.';
        errorType = 'DUPLICATE_BILL_NUMBER';
      }

      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message,
        errorType: errorType,
        errorCode: error.code,
        sqlMessage: error.sqlMessage || 'Database error'
      });
    } finally {
      if (connection) {
        connection.release();
        console.log('🔓 Database connection released');
      }
    }
  }
);

// GET /api/caterer-sales/caterer/:caterer_id - Get all sales for a caterer
router.get('/caterer/:caterer_id', logRequest, async (req, res) => {
  try {
    const [sales] = await db.pool.execute(
      `SELECT cs.*, 
              (SELECT COUNT(*) 
               FROM caterer_sale_items 
               WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
              (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
       FROM caterer_sales cs
       WHERE cs.caterer_id = ?
       ORDER BY cs.sell_date DESC, cs.created_at DESC`,
      [req.params.caterer_id]
    );

    res.json({
      success: true,
      sales,
      count: sales.length
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales',
      error: error.message
    });
  }
});

// GET /api/caterer-sales/:sale_id/details - Get sale details with items and payments
router.get('/:sale_id/details', logRequest, async (req, res) => {
  try {
    // Get sale info
    const [sales] = await db.pool.execute(
      'SELECT * FROM caterer_sales WHERE id = ?',
      [req.params.sale_id]
    );

    if (sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Get all sale items
    const [allItems] = await db.pool.execute(
      'SELECT * FROM caterer_sale_items WHERE sale_id = ? ORDER BY id',
      [req.params.sale_id]
    );

    // ONLY RETURN PARENT ITEMS (parent_sale_item_id IS NULL)
    const parentItems = allItems.filter(item => item.parent_sale_item_id === null);

    const processedItems = parentItems.map(item => {
      // If this is a mix header (is_mix = 1), find its children
      if (item.is_mix === 1) {
        const mixComponents = allItems.filter(childItem =>
          childItem.parent_sale_item_id === item.id &&
          childItem.mix_id === item.mix_id
        );

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

      // Regular item (not a mix)
      return {
        ...item,
        is_mix: false
      };
    });

    // Get payments
    const [payments] = await db.pool.execute(
      'SELECT * FROM caterer_sale_payments WHERE sale_id = ?',
      [req.params.sale_id]
    );

    // Get other charges
    const [charges] = await db.pool.execute(
      'SELECT * FROM caterer_sale_other_charges WHERE sale_id = ?',
      [req.params.sale_id]
    );

    res.json({
      success: true,
      sale: {
        ...sales[0],
        items: processedItems,
        payments,
        other_charges: charges
      }
    });
  } catch (error) {
    console.error('Error fetching sale details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sale details',
      error: error.message
    });
  }
});

// GET /api/caterer-sales/next-bill-number - Get next available bill number
router.get('/next-bill-number', logRequest, async (req, res) => {
  try {
    const [result] = await db.pool.execute(
      `SELECT bill_number FROM caterer_sales 
       ORDER BY id DESC LIMIT 1`
    );

    let nextBillNumber = '#0001';

    if (result.length > 0) {
      const lastBillNumber = result[0].bill_number;
      const numberPart = parseInt(lastBillNumber.replace('#', ''));
      const nextNumber = numberPart + 1;
      nextBillNumber = `#${String(nextNumber).padStart(4, '0')}`;
    }

    res.json({
      success: true,
      bill_number: nextBillNumber
    });
  } catch (error) {
    console.error('Error getting next bill number:', error);
    res.json({
      success: true,
      bill_number: '#0001'
    });
  }
});

// GET /api/caterer-sales - Get all caterer sales with complete details including mix products
router.get('/', logRequest, async (req, res) => {
  try {
    console.log('📊 Fetching all caterer sales with details...');

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
             (SELECT COUNT(*) 
              FROM caterer_sale_items 
              WHERE sale_id = cs.id AND parent_sale_item_id IS NULL) as items_count,
             (SELECT SUM(payment_amount) FROM caterer_sale_payments WHERE sale_id = cs.id) as total_paid
      FROM caterer_sales cs
      LEFT JOIN caterers c ON cs.caterer_id = c.id
      ORDER BY cs.sell_date DESC, cs.created_at DESC
    `);

    console.log(`✅ Found ${sales.length} sales, fetching related data...`);

    const salesWithDetails = await Promise.all(
      sales.map(async (sale) => {
        // Get all sale items
        const [allItems] = await db.pool.execute(
          `SELECT * FROM caterer_sale_items 
           WHERE sale_id = ? 
           ORDER BY id`,
          [sale.id]
        );

        // ONLY RETURN PARENT ITEMS (parent_sale_item_id IS NULL)
        const parentItems = allItems.filter(item => item.parent_sale_item_id === null);

        const processedItems = parentItems.map(item => {
          // If this is a mix header (is_mix = 1), find its children
          if (item.is_mix === 1) {
            const mixComponents = allItems.filter(childItem =>
              childItem.parent_sale_item_id === item.id &&
              childItem.mix_id === item.mix_id
            );

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

          // Regular item (not a mix)
          return {
            ...item,
            is_mix: false
          };
        });

        // Get payments
        const [payments] = await db.pool.execute(
          'SELECT * FROM caterer_sale_payments WHERE sale_id = ? ORDER BY payment_date DESC, created_at DESC',
          [sale.id]
        );

        // Get other charges
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

    console.log(`✅ Successfully fetched complete details for ${salesWithDetails.length} sales`);

    res.json({
      success: true,
      data: salesWithDetails,
      count: salesWithDetails.length
    });
  } catch (error) {
    console.error('❌ Error fetching caterer sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch caterer sales',
      error: error.message
    });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are working',
    timestamp: new Date().toISOString()
  });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales routes are healthy',
    timestamp: new Date().toISOString(),
    endpoint: '/api/caterer-sales'
  });
});

// GET root endpoint
router.get('/root', (req, res) => {
  res.json({
    success: true,
    message: 'Caterer sales API is available',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /create - Create new sale with mix product support',
      'GET / - Get all caterer sales with complete details',
      'GET /caterer/:caterer_id - Get caterer sales',
      'GET /:sale_id/details - Get sale details',
      'GET /next-bill-number - Get next bill number',
      'GET /health - Health check',
      'GET /test - Test endpoint'
    ]
  });
});

// Error handler
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'POST /create',
      'GET /',
      'GET /caterer/:caterer_id',
      'GET /:sale_id/details',
      'GET /next-bill-number',
      'GET /health',
      'GET /test'
    ]
  });
});

// Serve receipt images
router.get('/receipts/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, '..', 'assets', 'receipts', filename);

  console.log('📸 Serving receipt image:', imagePath);

  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error('❌ Error serving receipt image:', err);
      res.status(404).json({
        success: false,
        message: 'Receipt image not found',
        error: err.message
      });
    }
  });
});

module.exports = router;
