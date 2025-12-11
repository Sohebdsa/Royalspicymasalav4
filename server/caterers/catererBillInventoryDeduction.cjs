const db = require('../config/database.cjs');

/**
 * Deduct products from inventory batches when a caterer bill is created
 */
const deductProductsFromInventory = async (billData) => {
  let connection;

  try {
    connection = await db.pool.getConnection();
    console.log(`🔄 ===============================================`);
    console.log(`🔄 STARTING INVENTORY DEDUCTION PROCESS`);
    console.log(`🔄 Bill Number: ${billData.bill_number || 'N/A'}`);
    console.log(`🔄 Sale ID: ${billData.id || 'N/A'}`);
    console.log(`🔄 ===============================================`);

    if (billData.items && Array.isArray(billData.items)) {
      console.log(`📦 BILL ITEMS TO PROCESS (${billData.items.length} items):`);
      billData.items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.product_name || 'Unknown Product'}`);
        console.log(`      - Product ID: ${item.product_id || 'N/A'}`);
        console.log(`      - Quantity: ${item.quantity || 0} ${item.unit || 'units'}`);
        console.log(`      - Batch: ${item.batch_number || item.batch || 'N/A'}`);
        console.log(`      - Unit Price: ₹${item.rate || 0}`);
        console.log(`      - Is Mix: ${item.isMix || item.is_mix || false}`);
      });
    } else {
      console.log(`⚠️  NO ITEMS FOUND IN BILL DATA`);
      throw new Error('No items found in bill data for inventory deduction');
    }

    await connection.beginTransaction();
    console.log(`🔧 DATABASE TRANSACTION STARTED`);

    if (billData.items && Array.isArray(billData.items)) {
      console.log(`🔄 Processing ${billData.items.length} items...`);

      for (let i = 0; i < billData.items.length; i++) {
        const item = billData.items[i];
        console.log(`\n🔄 [${i + 1}/${billData.items.length}] Processing: ${item.product_name || 'Unknown'}`);

        if (!item.product_id) {
          throw new Error(`Missing product_id for ${item.product_name || 'Unknown'}`);
        }

        if (!item.quantity || item.quantity <= 0) {
          throw new Error(`Invalid quantity ${item.quantity} for ${item.product_name || 'Unknown'}`);
        }

        try {
          await processItemDeduction(connection, item, billData.id);
          console.log(`✅ Item ${i + 1} processed: ${item.product_name}`);
        } catch (itemError) {
          console.error(`❌ Failed item ${i + 1}: ${item.product_name}`);
          console.error(`❌ Error: ${itemError.message}`);
          throw itemError;
        }
      }

      console.log(`✅ All ${billData.items.length} items processed`);
    } else {
      throw new Error('No valid items in bill data');
    }

    // Final consistency check
    console.log(`🔍 Performing consistency check...`);
    try {
      const [deductions] = await connection.execute(`
        SELECT COUNT(*) as unique_products_deducted
        FROM inventory_history
        WHERE notes LIKE ? AND quantity < 0
      `, [`%Caterer sale deduction - Sale ID: ${billData.id}%`]);

      let expectedProductsCount = 0;
      for (const item of billData.items) {
        if (item.isMix || item.is_mix || item.mixItems) {
          const mixComponents = item.mixItems || item.mix_items || [];
          expectedProductsCount += mixComponents.length;
        } else {
          expectedProductsCount += 1;
        }
      }

      const actualProductsDeducted = parseInt(deductions[0].unique_products_deducted) || 0;

      console.log(`   Expected: ${expectedProductsCount}, Actual: ${actualProductsDeducted}`);

      if (actualProductsDeducted !== expectedProductsCount) {
        throw new Error(`Consistency check failed: Expected ${expectedProductsCount}, found ${actualProductsDeducted}`);
      }

      console.log(`✅ Consistency check passed`);

    } catch (consistencyError) {
      console.error(`❌ CONSISTENCY CHECK FAILED: ${consistencyError.message}`);
      throw consistencyError;
    }

    await connection.commit();
    console.log(`\n✅ ===============================================`);
    console.log(`✅ INVENTORY DEDUCTION COMPLETED`);
    console.log(`✅ Bill Number: ${billData.bill_number || 'N/A'}`);
    console.log(`✅ Sale ID: ${billData.id || 'N/A'}`);
    console.log(`✅ Items: ${billData.items?.length || 0}`);
    console.log(`✅ ===============================================`);
    return true;

  } catch (error) {
    console.error(`\n❌ ===============================================`);
    console.error(`❌ INVENTORY DEDUCTION FAILED`);
    console.error(`❌ Bill: ${billData.bill_number || 'N/A'}`);
    console.error(`❌ Sale ID: ${billData.id || 'N/A'}`);
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ ===============================================`);

    if (connection) {
      try {
        await connection.rollback();
        console.log(`🔄 TRANSACTION ROLLED BACK`);
      } catch (rollbackError) {
        console.error('❌ Rollback error:', rollbackError.message);
      }
    }
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log(`🔓 CONNECTION RELEASED`);
    }
  }
};

/**
 * Process deduction for a single item
 */
const processItemDeduction = async (connection, item, saleId) => {
  console.log(`🔍 Processing: ${item.product_name} (Qty: ${item.quantity})`);
  console.log(`   Product ID: ${item.product_id}`);
  console.log(`   Batch: ${item.batch_number || item.batch || 'N/A'}`);
  console.log(`   Unit: ${item.unit || 'N/A'}`);
  console.log(`   Is Mix: ${item.isMix || item.is_mix || false}`);

  if (!item.quantity || item.quantity <= 0 || !item.product_id) {
    console.log(`   └─ Skipping: Invalid data`);
    return;
  }

  if (item.isMix || item.is_mix === true || item.mixItems) {
    console.log(`   📦 Mix product, processing components...`);
    await processMixProductDeduction(connection, item, saleId);
    return;
  }

  console.log(`   🔧 Regular product, processing...`);
  await processRegularProductDeduction(connection, item, saleId);
  console.log(`   ✅ Completed: ${item.product_name}`);
};

/**
 * Process deduction for mix products
 */
const processMixProductDeduction = async (connection, mixItem, saleId) => {
  console.log(`   📦 Mix product: ${mixItem.product_name}`);
  console.log(`   📦 Mix batch: ${mixItem.batch_number || mixItem.batch || 'N/A'}`);

  const mixComponents = mixItem.mixItems || mixItem.mix_items || [];
  console.log(`   📦 Components: ${mixComponents.length}`);

  if (mixComponents.length === 0) {
    console.log(`   ⚠️  No components, skipping`);
    return;
  }

  for (const component of mixComponents) {
    console.log(`   🔧 Component: ${component.product_name} (${component.quantity})`);

    const batchNumber = component.batch_number || component.batch || mixItem.batch_number || mixItem.batch;

    await processRegularProductDeduction(connection, {
      ...component,
      isMix: false,
      batch_number: batchNumber,
      batch: batchNumber
    }, saleId);
  }

  console.log(`   ✅ Mix completed: ${mixItem.product_name}`);
};

const checkInventorySufficiency = async (productId, requiredQuantity, batchNumber = null) => {
  let connection;
  try {
    connection = await db.pool.getConnection();
    let query = `
      SELECT SUM(quantity) as total_available
      FROM inventory
      WHERE product_id = ? AND quantity > 0
    `;
    let params = [productId];

    if (batchNumber) {
      query += ' AND batch = ?';
      params.push(batchNumber);
    }

    const [result] = await connection.execute(query, params);
    const availableQuantity = parseFloat(result[0].total_available) || 0;

    return {
      isSufficient: availableQuantity >= requiredQuantity,
      availableQuantity: availableQuantity,
      requiredQuantity: requiredQuantity,
      deficit: Math.max(0, requiredQuantity - availableQuantity)
    };
  } catch (error) {
    console.error('❌ Error checking inventory sufficiency:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Unit mapping helper
const normalizeUnit = (unit) => {
  const unitMapping = {
    'bag': 'pack', 'bags': 'pack',
    'piece': 'pack', 'pieces': 'pack',
    'pc': 'pack', 'pcs': 'pack',
    'each': 'pack', 'item': 'pack', 'items': 'pack'
  };
  return unitMapping[unit?.toLowerCase()] || unit || 'kg';
};

/**
 * Process deduction for regular products
 */
const processRegularProductDeduction = async (connection, item, saleId) => {
  const quantityToDeduct = parseFloat(item.quantity) || 0;
  const productId = item.product_id;
  // CRITICAL: Use batch_number (from form) OR batch (from components)
  const batchNumber = item.batch_number ?? item.batch ?? null;

  console.log(`   🔍 Regular product deduction:`);
  console.log(`      Product ID: ${productId}`);
  console.log(`      Batch: ${batchNumber ?? 'Not specified'}`);
  console.log(`      Quantity: ${quantityToDeduct}`);
  console.log(`      Product: ${item.product_name}`);
  console.log(`      Rate: ₹${item.rate || 0}`);

  if (quantityToDeduct <= 0) {
    console.log(`   └─ Skipping: Invalid quantity`);
    return;
  }

  let query, params;

  if (batchNumber !== null) {
    console.log(`   🔍 Searching for batch "${batchNumber}"...`);
    query = `SELECT
      i.id as inventory_id,
      i.quantity as available_quantity,
      i.unit as inventory_unit,
      i.batch,
      i.cost_per_kg,
      p.name as product_name,
      p.unit as product_unit
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.product_id = ? AND i.batch = ? AND i.quantity > 0
    ORDER BY i.created_at ASC
    LIMIT 1`;
    params = [productId, batchNumber];

    const [batchItems] = await connection.execute(query, params);

    if (batchItems.length === 0) {
      console.log(`   ⚠️  Batch "${batchNumber}" not found, falling back to FIFO for product ${productId}...`);
      query = `SELECT
        i.id as inventory_id,
        i.quantity as available_quantity,
        i.unit as inventory_unit,
        i.batch,
        i.cost_per_kg,
        p.name as product_name,
        p.unit as product_unit
      FROM inventory i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.product_id = ? AND i.quantity > 0
      ORDER BY i.created_at ASC
      LIMIT 1`;
      params = [productId];
    }
  } else {
    console.log(`   🔍 No batch - using FIFO for product ${productId}...`);
    query = `SELECT
      i.id as inventory_id,
      i.quantity as available_quantity,
      i.unit as inventory_unit,
      i.batch,
      i.cost_per_kg,
      p.name as product_name,
      p.unit as product_unit
    FROM inventory i
    LEFT JOIN products p ON i.product_id = p.id
    WHERE i.product_id = ? AND i.quantity > 0
    ORDER BY i.created_at ASC
    LIMIT 1`;
    params = [productId];
  }

  const [inventoryItems] = await connection.execute(query, params);

  console.log(`   📦 Found ${inventoryItems.length} inventory item(s)`);

  if (inventoryItems.length === 0) {
    const batchInfo = batchNumber ? `Batch ${batchNumber}` : 'Any batch';
    console.log(`   ❌ ${batchInfo} not found for ${item.product_name}`);

    const [allInventory] = await connection.execute(
      `SELECT id, batch, quantity, unit
       FROM inventory
       WHERE product_id = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [productId]
    );

    console.log(`   🔍 Available inventory:`);
    allInventory.forEach(inv => {
      console.log(`      - Batch ${inv.batch ?? 'N/A'}: ${inv.quantity} ${inv.unit}`);
    });

    if (batchNumber && allInventory.length > 0) {
      console.log(`   🔄 Using FIFO fallback since batch ${batchNumber} not found`);
      throw new Error(`Batch ${batchNumber} not found for ${item.product_name}. Using available inventory instead.`);
    } else {
      throw new Error(`No available inventory found for ${item.product_name}`);
    }
  }

  const inventoryItem = inventoryItems[0];
  const availableQuantity = parseFloat(inventoryItem.available_quantity) || 0;

  console.log(`   📦 Available: ${availableQuantity} ${inventoryItem.inventory_unit}`);
  console.log(`   📦 Batch: ${inventoryItem.batch ?? 'N/A'}`);
  console.log(`   📦 Cost/kg from inventory: ₹${inventoryItem.cost_per_kg || 0}`);

  if (availableQuantity < quantityToDeduct) {
    console.log(`   ❌ Insufficient. Need: ${quantityToDeduct}, Have: ${availableQuantity}`);
    throw new Error(`Insufficient quantity for ${item.product_name}. Available: ${availableQuantity}, Required: ${quantityToDeduct}`);
  }

  const newQuantity = availableQuantity - quantityToDeduct;

  console.log(`   🔧 Updating inventory ${inventoryItem.inventory_id}...`);
  console.log(`      ${availableQuantity} → ${newQuantity}`);

  if (newQuantity <= 0.001) {
    // Quality is effectively zero, remove the batch entry
    console.log(`   🗑️  Quantity exhausted (remaining: ${newQuantity.toFixed(4)}), removing inventory batch...`);
    const [deleteResult] = await connection.execute(
      `DELETE FROM inventory WHERE id = ?`,
      [inventoryItem.inventory_id]
    );
    if (deleteResult.affectedRows === 0) {
      throw new Error(`Failed to delete exhausted inventory ${inventoryItem.inventory_id}`);
    }
    console.log(`   ✅ Inventory batch removed`);
  } else {
    // Update with new quantity
    const [updateResult] = await connection.execute(
      `UPDATE inventory
       SET quantity = ?, updated_at = NOW()
       WHERE id = ?`,
      [newQuantity.toFixed(3), inventoryItem.inventory_id]
    );

    if (updateResult.affectedRows === 0) {
      throw new Error(`Failed to update inventory ${inventoryItem.inventory_id}`);
    }
  }

  console.log(`   ✅ Deducted ${quantityToDeduct}. New: ${newQuantity.toFixed(3)}`);

  // Log deduction to inventory_history table
  console.log(`   📝 Logging deduction to inventory_history...`);

  const finalUnit = normalizeUnit(item.unit || inventoryItem.inventory_unit);
  const batchValue = inventoryItem.batch ?? 'default';

  // Use cost_per_kg from the inventory batch (not the sale rate)
  const costPerUnit = parseFloat(inventoryItem.cost_per_kg) || 0;
  const totalValue = quantityToDeduct * costPerUnit;

  console.log(`   📝 Unit: ${finalUnit}`);
  console.log(`   📝 Cost/unit (from inventory): ₹${costPerUnit}`);
  console.log(`   📝 Total value: ₹${totalValue.toFixed(2)}`);

  const [insertResult] = await connection.execute(
    `INSERT INTO inventory_history
     (product_id, product_name, quantity, unit, action, notes, batch, cost_per_kg, value, reference_type, reference_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      productId,
      item.product_name,
      -quantityToDeduct,
      finalUnit,
      'deducted',
      `Caterer sale deduction - Sale ID: ${saleId}, Item: ${item.product_name}, Sale Rate: ₹${item.rate || 0}`,
      batchValue,
      costPerUnit,
      -totalValue,
      'caterer_sale',
      saleId
    ]
  );

  console.log(`   ✅ Deduction logged to history: ID ${insertResult.insertId}`);

  // Update inventory summary from current batch quantities only
  console.log(`   🔧 Updating inventory summary...`);

  // Calculate totals from current batch quantities (only positive quantities)
  // Use the actual cost_per_kg from batches, not value/quantity
  const [calculationResult] = await connection.execute(
    `SELECT
       SUM(i.quantity) as total_quantity,
       SUM(i.value) as total_value,
       SUM(i.cost_per_kg * i.quantity) / NULLIF(SUM(i.quantity), 0) as average_cost_per_kg,
       i.unit,
       i.product_name
     FROM inventory i
     WHERE i.product_id = ? AND i.quantity > 0 AND i.status != 'merged'
     GROUP BY i.product_id, i.product_name, i.unit`,
    [productId]
  );

  if (calculationResult.length > 0) {
    const { total_quantity, total_value, average_cost_per_kg, unit, product_name } = calculationResult[0];

    console.log(`   📊 Calculated from current batches:`);
    console.log(`      Total quantity: ${total_quantity} kg`);
    console.log(`      Total value: ₹${total_value}`);
    console.log(`      Average cost (from batch purchase): ₹${average_cost_per_kg}/kg`);
    console.log(`      Unit: ${unit}`);
    console.log(`      Product: ${product_name}`);

    // Update or insert the summary record
    const [updateResult] = await connection.execute(
      `INSERT INTO inventory_summary (product_id, product_name, total_quantity, total_value, average_cost_per_kg, unit)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         total_quantity = VALUES(total_quantity),
         total_value = VALUES(total_value),
         average_cost_per_kg = VALUES(average_cost_per_kg),
         product_name = VALUES(product_name),
         unit = VALUES(unit),
         last_updated = CURRENT_TIMESTAMP`,
      [
        productId,
        product_name,
        total_quantity,
        total_value,
        average_cost_per_kg || 0,
        unit
      ]
    );

    console.log(`   ✅ Inventory summary updated for product ${productId}`);
    console.log(`   📊 Summary: ${updateResult.affectedRows} rows affected`);
  } else {
    console.log(`   ⚠️  No current batches found for product ${productId}`);
  }

  // Verify
  const [verifyInventory] = await connection.execute(
    `SELECT quantity FROM inventory WHERE id = ?`,
    [inventoryItem.inventory_id]
  );

  if (verifyInventory.length > 0) {
    const verifiedQuantity = parseFloat(verifyInventory[0].quantity);
    console.log(`   🔍 Verified: ${verifiedQuantity} (expected: ${newQuantity.toFixed(3)})`);

    if (Math.abs(verifiedQuantity - newQuantity) > 0.001) {
      console.log(`   ⚠️  Verification mismatch!`);
    } else {
      console.log(`   ✅ Verification passed`);
    }
  }
};

/**
 * Get inventory deduction history
 */
const getInventoryDeductionHistory = async (saleId) => {
  let connection;
  try {
    connection = await db.pool.getConnection();
    const [deductions] = await connection.execute(
      `SELECT
        i.id,
        i.product_id,
        i.quantity as deducted_quantity,
        i.unit,
        i.batch,
        i.notes,
        i.created_at as deduction_date,
        i.value,
        i.cost_per_kg,
        p.name as product_name
      FROM inventory_history i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.notes LIKE ? AND i.quantity < 0
      ORDER BY i.created_at DESC`,
      [`%Caterer sale deduction - Sale ID: ${saleId}%`]
    );

    return deductions;
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Get current inventory status
 */
const getProductInventoryStatus = async (productId) => {
  let connection;
  try {
    connection = await db.pool.getConnection();
    const [inventoryItems] = await connection.execute(
      `SELECT
        id,
        quantity,
        unit,
        batch,
        cost_per_kg,
        value,
        created_at,
        updated_at
      FROM inventory
      WHERE product_id = ? AND quantity > 0
      ORDER BY created_at ASC`,
      [productId]
    );

    return inventoryItems;
  } catch (error) {
    console.error('❌ Error fetching status:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

module.exports = {
  deductProductsFromInventory,
  getInventoryDeductionHistory,
  checkInventorySufficiency,
  getProductInventoryStatus
};
