const { pool } = require('../config/database.cjs');

// Get current inventory summary (by batches)
const getInventorySummary = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      status = 'active'
    } = req.query;

    const limitNum = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitNum;

    let whereClause = 'WHERE batch_summary.total_quantity > 0';
    let params = [];

    // Search functionality
    if (search) {
      whereClause += ` AND (
        batch_summary.product_name LIKE ? OR
        p.name LIKE ?
      )`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT
          i.product_id,
          i.product_name,
          i.batch,
          SUM(CASE
            WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.quantity
            WHEN i.action = 'deducted' THEN -i.quantity
            ELSE 0
          END) as total_quantity
        FROM inventory i
        GROUP BY i.product_id, i.product_name, i.batch
        HAVING total_quantity > 0
      ) batch_summary
      LEFT JOIN products p ON batch_summary.product_id = p.id
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const totalRecords = countResult[0].total;

    // Main query - get inventory by batches
    const mainQuery = `
      SELECT
        batch_summary.product_id,
        batch_summary.product_name,
        batch_summary.batch,
        batch_summary.total_quantity,
        batch_summary.total_value,
        batch_summary.cost_per_kg,
        batch_summary.unit,
        batch_summary.last_updated,
        p.category_id,
        p.sub_category,
        p.market_price,
        p.retail_price,
        p.caterer_price,
        p.is_active as product_active,
        p.product_images
      FROM (
        SELECT
          i.product_id,
          i.product_name,
          i.batch,
          i.unit,
          SUM(CASE
            WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.quantity
            WHEN i.action = 'deducted' THEN -i.quantity
            ELSE 0
          END) as total_quantity,
          SUM(CASE
            WHEN i.action = 'added' OR i.action = 'updated' OR i.action = 'merged' THEN i.value
            WHEN i.action = 'deducted' THEN -i.value
            ELSE 0
          END) as total_value,
          -- Use the actual cost_per_kg from the batch purchase (weighted average of 'added' actions)
          CASE
            WHEN SUM(CASE WHEN i.action = 'added' THEN i.quantity ELSE 0 END) > 0 THEN
              SUM(CASE WHEN i.action = 'added' THEN i.cost_per_kg * i.quantity ELSE 0 END) / 
              SUM(CASE WHEN i.action = 'added' THEN i.quantity ELSE 0 END)
            ELSE 0
          END as cost_per_kg,
          MAX(i.created_at) as last_updated
        FROM inventory i
        WHERE i.status != 'merged'
        GROUP BY i.product_id, i.product_name, i.batch, i.unit
        HAVING total_quantity > 0
      ) batch_summary
      LEFT JOIN products p ON batch_summary.product_id = p.id
      ${whereClause}
      ORDER BY batch_summary.product_name ASC, batch_summary.last_updated DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [inventory] = await pool.execute(mainQuery, params);

    // Parse product images if they're stored as JSON strings
    const processedInventory = inventory.map(item => {
      let productImages = [];
      if (item.product_images) {
        try {
          productImages = typeof item.product_images === 'string' ?
            JSON.parse(item.product_images) :
            item.product_images;

          // Convert URLs to just filenames if they're full URLs
          productImages = productImages.map(img => {
            if (typeof img === 'string' && img.startsWith('/api/products/images/')) {
              return img.replace('/api/products/images/', '');
            }
            return img;
          });
        } catch (parseError) {
          console.error('Error parsing product images:', parseError);
          productImages = [];
        }
      }



      return {
        ...item,
        product_images: productImages
      };
    });

    res.json({
      success: true,
      data: processedInventory,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory summary',
      error: error.message
    });
  }
};

// Get inventory history
const getInventoryHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      product_id = '',
      action = '',
      date_from = '',
      date_to = ''
    } = req.query;

    const limitNum = parseInt(limit);
    const offset = (parseInt(page) - 1) * limitNum;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filter by product
    if (product_id) {
      whereClause += ' AND i.product_id = ?';
      params.push(product_id);
    }

    // Filter by action
    if (action) {
      whereClause += ' AND i.action = ?';
      params.push(action);
    }

    // Filter by date range
    if (date_from) {
      whereClause += ' AND DATE(i.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND DATE(i.created_at) <= ?';
      params.push(date_to);
    }

    // Count total records
    const countQuery = `SELECT COUNT(*) as total FROM inventory_history i ${whereClause}`;
    const [countResult] = await pool.execute(countQuery, params);
    const totalRecords = countResult[0].total;

    // Main query
    const mainQuery = `
      SELECT 
        i.id,
        i.product_id,
        i.product_name,
        i.batch,
        i.action,
        i.quantity,
        i.value,
        i.unit,
        i.notes,
        i.reference_type,
        i.reference_id,
        i.created_at,
        p.name as current_product_name,
        p.category_id,
        p.sub_category
      FROM inventory_history i
      LEFT JOIN products p ON i.product_id = p.id
      ${whereClause}
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const [history] = await pool.execute(mainQuery, params);

    res.json({
      success: true,
      data: history,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecords / limitNum),
        totalRecords,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory history',
      error: error.message
    });
  }
};

// Add inventory entry
const addInventoryEntry = async (req, res) => {
  try {
    const {
      product_id,
      batch,
      action = 'added',
      quantity,
      value,
      unit = 'kg',
      status = 'active',
      notes,
      reference_type = 'manual',
      reference_id
    } = req.body;

    // Validate required fields
    if (!product_id || !batch || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, batch, and quantity are required'
      });
    }

    // Get product details
    const [productResult] = await pool.execute(
      'SELECT name, unit FROM products WHERE id = ?',
      [product_id]
    );

    if (productResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = productResult[0];
    const productUnit = unit || product.unit || 'kg';

    // Calculate cost per kg
    const costPerKg = productUnit === 'kg' && parseFloat(quantity) > 0 ? (parseFloat(value || 0) / parseFloat(quantity)) : 0;

    const query = `
      INSERT INTO inventory (
        product_id,
        product_name,
        batch,
        action,
        quantity,
        value,
        cost_per_kg,
        unit,
        status,
        notes,
        reference_type,
        reference_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      product_id,
      product.name,
      batch,
      action,
      parseFloat(quantity),
      parseFloat(value || 0),
      costPerKg,
      productUnit,
      status,
      notes || null,
      reference_type,
      reference_id || null
    ];

    const [result] = await pool.execute(query, values);

    // Get the created entry
    // Manually update inventory summary
    await pool.execute(
      `INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_quantity = CASE
           WHEN ? = 'added' OR ? = 'updated' THEN total_quantity + ?
           WHEN ? = 'deducted' THEN total_quantity - ?
           ELSE total_quantity
         END,
         total_value = CASE
           WHEN ? = 'added' OR ? = 'updated' THEN total_value + ?
           WHEN ? = 'deducted' THEN total_value - ?
           ELSE total_value
         END,
         average_cost_per_kg = CASE
           WHEN total_quantity > 0 THEN total_value / total_quantity
           ELSE 0
         END,
         product_name = ?,
         unit = ?,
         last_updated = CURRENT_TIMESTAMP`,
      [
        product_id,
        product.name,
        parseFloat(quantity),
        parseFloat(value || 0),
        costPerKg,
        productUnit,
        action, action, parseFloat(quantity),
        action, parseFloat(quantity),
        action, action, parseFloat(value || 0),
        action, parseFloat(value || 0),
        product.name,
        productUnit
      ]
    );

    const [createdEntry] = await pool.execute(
      'SELECT * FROM inventory WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Inventory entry added successfully',
      data: createdEntry[0]
    });
  } catch (error) {
    console.error('Error adding inventory entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add inventory entry',
      error: error.message
    });
  }
};

// Update inventory entry
const updateInventoryEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      batch,
      quantity,
      value,
      unit,
      status,
      notes
    } = req.body;

    // Check if entry exists
    const [existingEntry] = await pool.execute(
      'SELECT * FROM inventory WHERE id = ?',
      [id]
    );

    if (existingEntry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventory entry not found'
      });
    }

    const updateQuery = `
      UPDATE inventory SET 
        batch = COALESCE(?, batch),
        quantity = COALESCE(?, quantity),
        value = COALESCE(?, value),
        unit = COALESCE(?, unit),
        status = COALESCE(?, status),
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await pool.execute(updateQuery, [
      batch,
      quantity ? parseFloat(quantity) : null,
      value ? parseFloat(value) : null,
      unit,
      status,
      notes !== undefined ? notes : null,
      id
    ]);

    // Get updated entry
    const [updatedEntry] = await pool.execute(
      'SELECT * FROM inventory WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Inventory entry updated successfully',
      data: updatedEntry[0]
    });
  } catch (error) {
    console.error('Error updating inventory entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory entry',
      error: error.message
    });
  }
};

// Delete inventory entry
const deleteInventoryEntry = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if entry exists
    const [existingEntry] = await pool.execute(
      'SELECT * FROM inventory WHERE id = ?',
      [id]
    );

    if (existingEntry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inventory entry not found'
      });
    }

    const entry = existingEntry[0];

    // Delete the inventory entry
    await pool.execute('DELETE FROM inventory WHERE id = ?', [id]);

    // Recalculate inventory summary for this product
    await pool.execute(`
      INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
      SELECT
        product_id,
        product_name,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN quantity
          WHEN action = 'deducted' THEN -quantity
          ELSE 0
        END) as total_quantity,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN value
          WHEN action = 'deducted' THEN -value
          ELSE 0
        END) as total_value,
        CASE
          WHEN SUM(CASE
            WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN quantity
            WHEN action = 'deducted' THEN -quantity
            ELSE 0
          END) > 0 THEN
            SUM(CASE
              WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN value
              WHEN action = 'deducted' THEN -value
              ELSE 0
            END) / SUM(CASE
              WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN quantity
              WHEN action = 'deducted' THEN -quantity
              ELSE 0
            END)
          ELSE 0
        END as average_cost_per_kg,
        unit
      FROM inventory
      WHERE product_id = ? AND status != 'merged'
      GROUP BY product_id, product_name, unit
      ON DUPLICATE KEY UPDATE
        total_quantity = VALUES(total_quantity),
        total_value = VALUES(total_value),
        average_cost_per_kg = VALUES(average_cost_per_kg),
        product_name = VALUES(product_name),
        unit = VALUES(unit),
        last_updated = CURRENT_TIMESTAMP
    `, [entry.product_id]);

    res.json({
      success: true,
      message: 'Inventory entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting inventory entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory entry',
      error: error.message
    });
  }
};

// Rebuild inventory summary from inventory records
const rebuildInventorySummary = async (req, res) => {
  try {
    // Clear existing summary
    await pool.execute('DELETE FROM inventory_summary');

    // Rebuild from inventory records
    const [inventoryRecords] = await pool.execute(`
      SELECT
        i.product_id,
        i.product_name,
        i.unit,
        SUM(CASE
          WHEN i.action = 'added' OR i.action = 'updated' THEN i.quantity
          WHEN i.action = 'deducted' THEN -i.quantity
          ELSE 0
        END) as total_quantity,
        SUM(CASE
          WHEN i.action = 'added' OR i.action = 'updated' THEN i.value
          WHEN i.action = 'deducted' THEN -i.value
          ELSE 0
        END) as total_value
      FROM inventory i
      WHERE i.status != 'merged'
      GROUP BY i.product_id, i.product_name, i.unit
      HAVING total_quantity > 0
    `);

    // Insert into summary table
    for (const record of inventoryRecords) {
      await pool.execute(
        `INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, unit)
         VALUES (?, ?, ?, ?, ?)`,
        [
          record.product_id,
          record.product_name,
          record.total_quantity,
          record.total_value,
          record.unit
        ]
      );
    }

    res.json({
      success: true,
      message: 'Inventory summary rebuilt successfully',
      records_processed: inventoryRecords.length
    });
  } catch (error) {
    console.error('Error rebuilding inventory summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rebuild inventory summary',
      error: error.message
    });
  }
};

// Get batches for a specific product
const getProductBatches = async (req, res) => {
  try {
    const { product_id } = req.params;

    const [batches] = await pool.execute(`
      SELECT
        batch,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' THEN quantity
          WHEN action = 'deducted' THEN -quantity
          ELSE 0
        END) as total_quantity,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' THEN value
          WHEN action = 'deducted' THEN -value
          ELSE 0
        END) as total_value,
        unit,
        MAX(created_at) as last_updated
      FROM inventory
      WHERE product_id = ? AND status != 'merged'
      GROUP BY batch, unit
      HAVING total_quantity > 0
      ORDER BY last_updated DESC
    `, [product_id]);

    res.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching product batches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product batches',
      error: error.message
    });
  }
};

// Get average cost prices for all products
const getAverageCostPrices = async (req, res) => {
  try {
    const [results] = await pool.execute(`
      SELECT
        product_id,
        product_name,
        average_cost_per_kg,
        total_quantity,
        total_value,
        unit
      FROM inventory_summary
      WHERE total_quantity > 0 AND average_cost_per_kg > 0
      ORDER BY product_name
    `);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching average cost prices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch average cost prices',
      error: error.message
    });
  }
};

// Merge multiple batches into one
const mergeBatches = async (req, res) => {
  try {
    const { product_id, batch_ids, new_batch_name } = req.body;

    if (!product_id || !batch_ids || !Array.isArray(batch_ids) || batch_ids.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and at least 2 batch IDs are required'
      });
    }

    // Get all batches to merge
    const placeholders = batch_ids.map(() => '?').join(',');
    const [batches] = await pool.execute(`
      SELECT
        batch,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN quantity
          WHEN action = 'deducted' THEN -quantity
          ELSE 0
        END) as total_quantity,
        SUM(CASE
          WHEN action = 'added' OR action = 'updated' OR action = 'merged' THEN value
          WHEN action = 'deducted' THEN -value
          ELSE 0
        END) as total_value,
        unit,
        product_name
      FROM inventory
      WHERE product_id = ? AND batch IN (${placeholders})
      GROUP BY batch, unit, product_name
      HAVING total_quantity > 0
    `, [product_id, ...batch_ids]);

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid batches found to merge'
      });
    }

    // Calculate merged totals
    const mergedQuantity = batches.reduce((sum, batch) => sum + parseFloat(batch.total_quantity), 0);
    const mergedValue = batches.reduce((sum, batch) => sum + parseFloat(batch.total_value), 0);
    const mergedCostPerKg = mergedQuantity > 0 ? (mergedValue / mergedQuantity) : 0;
    const unit = batches[0].unit;
    const productName = batches[0].product_name;

    // Create new merged batch
    const mergedBatchName = new_batch_name || `MERGED-${product_id}-${Date.now()}`;

    await pool.execute(`
      INSERT INTO inventory (
        product_id,
        product_name,
        batch,
        action,
        quantity,
        value,
        cost_per_kg,
        unit,
        status,
        notes,
        reference_type
      ) VALUES (?, ?, ?, 'merged', ?, ?, ?, ?, 'active', ?, 'manual')
    `, [
      product_id,
      productName,
      mergedBatchName,
      mergedQuantity,
      mergedValue,
      mergedCostPerKg,
      unit,
      `Merged from batches: ${batch_ids.join(', ')}`
    ]);

    // Create history entries for old batches before removing them
    for (const batch of batches) {
      // Create history entry
      await pool.execute(`
        INSERT INTO inventory (
          product_id,
          product_name,
          batch,
          action,
          quantity,
          value,
          cost_per_kg,
          unit,
          status,
          notes,
          reference_type
        ) VALUES (?, ?, ?, 'deducted', ?, ?, ?, ?, 'inactive', ?, 'manual')
      `, [
        product_id,
        productName,
        batch.batch,
        batch.total_quantity,
        batch.total_value,
        batch.total_quantity > 0 ? (batch.total_value / batch.total_quantity) : 0,
        unit,
        `Batch merged into: ${mergedBatchName} on ${new Date().toISOString().split('T')[0]}`
      ]);
    }

    // Remove old batch records (keep only history)
    await pool.execute(`
      UPDATE inventory
      SET status = 'merged', notes = CONCAT(COALESCE(notes, ''), ' - Merged into ?')
      WHERE product_id = ? AND batch IN (${placeholders}) AND action != 'deducted'
    `, [mergedBatchName, product_id, ...batch_ids]);

    // Update inventory summary
    await pool.execute(`
      UPDATE inventory_summary
      SET
        average_cost_per_kg = CASE
          WHEN total_quantity > 0 THEN total_value / total_quantity
          ELSE 0
        END,
        last_updated = CURRENT_TIMESTAMP
      WHERE product_id = ?
    `, [product_id]);

    res.json({
      success: true,
      message: 'Batches merged successfully',
      merged_batch: mergedBatchName,
      merged_quantity: mergedQuantity,
      merged_value: mergedValue
    });
  } catch (error) {
    console.error('Error merging batches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to merge batches',
      error: error.message
    });
  }
};

// Clean up merged batches (utility function)
const cleanupMergedBatches = async (req, res) => {
  try {
    // First, find the IDs of batches that should be marked as merged
    const [batchesToUpdate] = await pool.execute(`
      SELECT DISTINCT i1.id
      FROM inventory i1
      INNER JOIN inventory i2 ON (
        i2.product_id = i1.product_id
        AND i2.action = 'merged'
        AND i2.notes LIKE CONCAT('%', i1.batch, '%')
        AND i2.created_at > i1.created_at
      )
      WHERE i1.status != 'merged'
    `);

    if (batchesToUpdate.length === 0) {
      return res.json({
        success: true,
        message: 'No batches need cleanup',
        affected_rows: 0
      });
    }

    // Update the batches using the IDs we found
    const ids = batchesToUpdate.map(row => row.id);
    const placeholders = ids.map(() => '?').join(',');

    const [result] = await pool.execute(`
      UPDATE inventory
      SET status = 'merged'
      WHERE id IN (${placeholders})
    `, ids);

    res.json({
      success: true,
      message: `Cleaned up ${result.affectedRows} merged batch records`,
      affected_rows: result.affectedRows
    });
  } catch (error) {
    console.error('Error cleaning up merged batches:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup merged batches',
      error: error.message
    });
  }
};

module.exports = {
  getInventorySummary,
  getInventoryHistory,
  addInventoryEntry,
  updateInventoryEntry,
  deleteInventoryEntry,
  rebuildInventorySummary,
  getProductBatches,
  getAverageCostPrices,
  mergeBatches,
  cleanupMergedBatches
};
