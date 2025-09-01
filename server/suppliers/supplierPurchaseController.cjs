const { pool } = require('../config/database.cjs');
const fs = require('fs').promises;
const path = require('path');

// Get all supplier purchases with pagination and filtering
const getSupplierPurchases = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      supplier_id = '', 
      status = '',
      date_from = '',
      date_to = ''
    } = req.query;

    const limitNum = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filter by supplier
    if (supplier_id) {
      whereClause += ' AND sp.supplier_id = ?';
      params.push(supplier_id);
    }

    // Filter by status
    if (status) {
      whereClause += ' AND sp.status = ?';
      params.push(status);
    }

    // Filter by date range
    if (date_from) {
      whereClause += ' AND sp.purchase_date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND sp.purchase_date <= ?';
      params.push(date_to);
    }

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM supplier_purchases sp 
      LEFT JOIN suppliers s ON sp.supplier_id = s.id 
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalRecords = countResult[0].total;

    // Main query
    const mainQuery = `
      SELECT
        sp.id,
        sp.supplier_id,
        sp.bill_number,
        sp.purchase_date,
        sp.items,
        sp.other_charges,
        sp.subtotal,
        sp.total_gst,
        sp.items_total,
        sp.other_charges_total,
        sp.grand_total,
        sp.payment_option,
        sp.payment_amount,
        sp.amount_pending,
        sp.payment_method,
        sp.payment_date,
        sp.receipt_image,
        sp.status,
        sp.created_at,
        sp.updated_at,
        s.supplier_name,
        s.contact_person
      FROM supplier_purchases sp
      LEFT JOIN suppliers s ON sp.supplier_id = s.id
      ${whereClause}
      ORDER BY sp.purchase_date DESC, sp.created_at DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [purchases] = await pool.execute(mainQuery, params);

    // Parse JSON fields and get payment records for each purchase
    const processedPurchases = await Promise.all(purchases.map(async (purchase) => {
      // Get payment records for this purchase
      const [paymentRecords] = await pool.execute(
        `SELECT
          id, payment_amount, payment_method, payment_date, payment_time,
          notes, receipt_image, created_at
        FROM payment_records
        WHERE purchase_id = ?
        ORDER BY payment_date DESC, payment_time DESC, created_at DESC`,
        [purchase.id]
      );

      // Parse items safely
      let parsedItems = [];
      if (purchase.items) {
        try {
          parsedItems = typeof purchase.items === 'string' ? JSON.parse(purchase.items) : purchase.items;
        } catch (parseError) {
          console.error('Error parsing items for purchase:', purchase.id, parseError);
          parsedItems = [];
        }
      }

      // Parse other charges safely
      let parsedOtherCharges = [];
      if (purchase.other_charges) {
        try {
          parsedOtherCharges = typeof purchase.other_charges === 'string' ? JSON.parse(purchase.other_charges) : purchase.other_charges;
        } catch (parseError) {
          console.error('Error parsing other charges for purchase:', purchase.id, parseError);
          parsedOtherCharges = [];
        }
      }

      return {
        ...purchase,
        items: parsedItems,
        other_charges: parsedOtherCharges,
        payment_records: paymentRecords || []
      };
    }));

    res.json({
      success: true,
      data: processedPurchases,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching supplier purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier purchases',
      error: error.message
    });
  }
};

// Get next bill number
const getNextBillNumber = async (req, res) => {
  try {
    const [result] = await pool.execute(
      'SELECT bill_number FROM supplier_purchases ORDER BY id DESC LIMIT 1'
    );

    let nextBillNumber = '#0001';
    
    if (result.length > 0) {
      const lastBillNumber = result[0].bill_number;
      const lastNumber = parseInt(lastBillNumber.replace('#', ''));
      const nextNumber = lastNumber + 1;
      nextBillNumber = `#${nextNumber.toString().padStart(4, '0')}`;
    }

    res.json({
      success: true,
      bill_number: nextBillNumber
    });
  } catch (error) {
    console.error('Error getting next bill number:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get next bill number',
      error: error.message
    });
  }
};

// Create new supplier purchase
const createSupplierPurchase = async (req, res) => {
  try {
    const {
      supplier_id,
      bill_number,
      purchase_date,
      items: itemsRaw,
      other_charges: otherChargesRaw,
      subtotal,
      total_gst,
      items_total,
      other_charges_total,
      grand_total,
      payment_option,
      payment_amount,
      payment_method,
      payment_date
    } = req.body;

    // Parse items if it's a string (from FormData)
    let items;
    try {
      items = typeof itemsRaw === 'string' ? JSON.parse(itemsRaw) : itemsRaw;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid items data format'
      });
    }

    // Parse other charges if it's a string (from FormData)
    let other_charges = [];
    try {
      other_charges = typeof otherChargesRaw === 'string' ? JSON.parse(otherChargesRaw) : otherChargesRaw;
    } catch (parseError) {
      // If parsing fails, use empty array
      other_charges = [];
    }

    // Validate required fields
    if (!supplier_id || !bill_number || !purchase_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Supplier ID, bill number, purchase date, and items are required'
      });
    }

    // Calculate amount pending (round to integers)
    const amountPending = Math.round(parseFloat(grand_total) - parseFloat(payment_amount));

    // Determine initial status based on payment
    const initialStatus = amountPending <= 0 ? 'completed' : 'pending';

    // Handle receipt image upload
    let receipt_image = null;
    if (req.files && req.files.receipt_image) {
      receipt_image = req.files.receipt_image[0].filename;
    }

    const query = `
      INSERT INTO supplier_purchases (
        supplier_id,
        bill_number,
        purchase_date,
        items,
        other_charges,
        subtotal,
        total_gst,
        items_total,
        other_charges_total,
        grand_total,
        payment_option,
        payment_amount,
        amount_pending,
        payment_method,
        payment_date,
        receipt_image,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      supplier_id,
      bill_number,
      purchase_date,
      JSON.stringify(items),
      JSON.stringify(other_charges),
      Math.round(parseFloat(subtotal)),
      Math.round(parseFloat(total_gst)),
      Math.round(parseFloat(items_total)),
      Math.round(parseFloat(other_charges_total)),
      Math.round(parseFloat(grand_total)),
      payment_option,
      Math.round(parseFloat(payment_amount)),
      amountPending,
      payment_method,
      payment_date,
      receipt_image,
      initialStatus
    ];

    const [result] = await pool.execute(query, values);
    const purchaseId = result.insertId;

    // Create initial payment record if payment was made
    if (parseFloat(payment_amount) > 0) {
      const currentTime = new Date().toTimeString().split(' ')[0];

      await pool.execute(
        `INSERT INTO payment_records (
          purchase_id, payment_amount, payment_method, payment_date, payment_time, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          purchaseId,
          payment_amount,
          payment_method,
          payment_date,
          currentTime,
          `Initial payment for bill ${bill_number}`
        ]
      );
    }

    // Add items to inventory


    for (const item of items) {
      // Skip items without valid product_id
      const productId = parseInt(item.product_id);
      if (!item.product_id || item.product_id === '' || isNaN(productId)) {

        continue;
      }

      // Create unique batch for each purchase using purchase ID and product ID
      const batch = `${productId}-${purchaseId}-${Date.now()}`;

      try {
        // Use subtotal (without GST) for cost calculation
        const costValue = Math.round(parseFloat(item.subtotal) || 0);

        await pool.execute(
          `INSERT INTO inventory (
            product_id,
            product_name,
            batch,
            action,
            quantity,
            value,
            cost_per_kg,
            unit,
            status,
            reference_type,
            reference_id
          ) VALUES (?, ?, ?, 'added', ?, ?, ?, ?, 'active', 'purchase', ?)`,
          [
            productId,
            item.product_name || 'Unknown Product',
            batch,
            parseFloat(item.quantity) || 0,
            costValue,
            (item.unit === 'kg' && parseFloat(item.quantity) > 0) ? (costValue / parseFloat(item.quantity)) : 0,
            item.unit || 'kg',
            purchaseId
          ]
        );


        // Manually update inventory summary
        await pool.execute(
          `INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             total_quantity = total_quantity + VALUES(total_quantity),
             total_value = total_value + VALUES(total_value),
             average_cost_per_kg = CASE
               WHEN total_quantity + VALUES(total_quantity) > 0
               THEN (total_value + VALUES(total_value)) / (total_quantity + VALUES(total_quantity))
               ELSE 0
             END,
             product_name = VALUES(product_name),
             unit = VALUES(unit),
             last_updated = CURRENT_TIMESTAMP`,
          [
            productId,
            item.product_name || 'Unknown Product',
            parseFloat(item.quantity) || 0,
            costValue,
            (item.unit === 'kg' && parseFloat(item.quantity) > 0) ? (costValue / parseFloat(item.quantity)) : 0,
            item.unit || 'kg'
          ]
        );


      } catch (inventoryError) {
        console.error('Error adding item to inventory:', inventoryError);
        console.error('Item data:', item);
        // Continue with other items even if one fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      purchase_id: purchaseId,
      amount_pending: amountPending
    });
  } catch (error) {
    console.error('Error creating supplier purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase',
      error: error.message
    });
  }
};

// Update supplier purchase
const updateSupplierPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      payment_amount,
      payment_method,
      payment_date,
      status
    } = req.body;

    // Check if purchase exists
    const [existingPurchase] = await pool.execute(
      'SELECT * FROM supplier_purchases WHERE id = ?',
      [id]
    );

    if (existingPurchase.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    const purchase = existingPurchase[0];
    
    // Calculate new amount pending if payment amount is updated
    let newAmountPending = purchase.amount_pending;
    if (payment_amount !== undefined) {
      const totalPaid = parseFloat(purchase.payment_amount) + parseFloat(payment_amount);
      newAmountPending = parseFloat(purchase.grand_total) - totalPaid;
    }

    // Handle receipt image upload
    let receipt_image = purchase.receipt_image;
    if (req.files && req.files.receipt_image) {
      // Delete old image if it exists
      if (receipt_image) {
        try {
          await fs.unlink(path.join(__dirname, 'receipts', receipt_image));
        } catch (error) {

        }
      }
      receipt_image = req.files.receipt_image[0].filename;
    }

    const query = `
      UPDATE supplier_purchases SET 
        payment_amount = COALESCE(?, payment_amount),
        amount_pending = ?,
        payment_method = COALESCE(?, payment_method),
        payment_date = COALESCE(?, payment_date),
        receipt_image = ?,
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      payment_amount,
      newAmountPending,
      payment_method,
      payment_date,
      receipt_image,
      status,
      id
    ];

    await pool.execute(query, values);

    res.json({
      success: true,
      message: 'Purchase updated successfully',
      amount_pending: newAmountPending
    });
  } catch (error) {
    console.error('Error updating supplier purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update purchase',
      error: error.message
    });
  }
};

// Delete supplier purchase
const deleteSupplierPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if purchase exists
    const [existingPurchase] = await pool.execute(
      'SELECT receipt_image FROM supplier_purchases WHERE id = ?',
      [id]
    );

    if (existingPurchase.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    // Delete receipt image if it exists
    if (existingPurchase[0].receipt_image) {
      try {
        await fs.unlink(path.join(__dirname, 'receipts', existingPurchase[0].receipt_image));
      } catch (error) {

      }
    }

    // Delete purchase from database
    await pool.execute('DELETE FROM supplier_purchases WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Purchase deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting supplier purchase:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete purchase',
      error: error.message
    });
  }
};

module.exports = {
  getSupplierPurchases,
  getNextBillNumber,
  createSupplierPurchase,
  updateSupplierPurchase,
  deleteSupplierPurchase
};
