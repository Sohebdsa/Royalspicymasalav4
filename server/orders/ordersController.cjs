const { pool } = require('../config/database.cjs');
const { createOrUpdateCustomer } = require('../customers/customersController.cjs');

// Generate unique order number
const generateOrderNumber = async () => {
  try {
    const connection = await pool.getConnection();
    
    const [rows] = await connection.execute(
      'SELECT order_number FROM orders ORDER BY id DESC LIMIT 1'
    );
    
    let nextNumber = 1001;
    if (rows.length > 0) {
      const lastOrderNumber = rows[0].order_number;
      const lastNumber = parseInt(lastOrderNumber.replace('ORD', ''));
      nextNumber = lastNumber + 1;
    }
    
    connection.release();
    return `ORD${nextNumber}`;
  } catch (error) {
    console.error('Error generating order number:', error);
    return `ORD${Date.now()}`;
  }
};

// Get all orders with pagination and filtering
const getOrders = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    const {
      page = 1,
      limit = 50,
      status,
      source,
      search,
      date_from,
      date_to
    } = req.query;
    
    let whereConditions = [];
    let queryParams = [];
    
    if (status && status !== 'all') {
      whereConditions.push('o.status = ?');
      queryParams.push(status);
    }
    
    if (source && source !== 'all') {
      whereConditions.push('o.order_source = ?');
      queryParams.push(source);
    }
    
    if (search) {
      whereConditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (date_from) {
      whereConditions.push('DATE(o.created_at) >= ?');
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push('DATE(o.created_at) <= ?');
      queryParams.push(date_to);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const [countResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM orders o ${whereClause}
    `, queryParams);
    
    const totalOrders = countResult[0].total;
    const offset = (page - 1) * limit;

    let finalQuery = `
      SELECT
        o.*,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count,
        0 as profit
      FROM orders o
      ${whereClause}
      ORDER BY o.created_at DESC
    `;

    let finalParams = [...queryParams];

    if (limit && limit > 0) {
      finalQuery += ` LIMIT ${parseInt(limit)}`;
      if (offset && offset > 0) {
        finalQuery += ` OFFSET ${parseInt(offset)}`;
      }
    }

    const [orders] = await connection.execute(finalQuery, finalParams);
    
    connection.release();
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalOrders,
        pages: Math.ceil(totalOrders / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get single order with items
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    const [orderRows] = await connection.execute(
      'SELECT * FROM orders WHERE id = ?',
      [id]
    );
    
    if (orderRows.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const [itemRows] = await connection.execute(`
      SELECT
        oi.*,
        COALESCE(p1.product_images, p2.product_images) as product_images,
        COALESCE(p1.retail_price, p2.retail_price) as product_retail_price,
        COALESCE(inv1.average_cost_per_kg, inv2.average_cost_per_kg, 0) as average_cost_price
      FROM order_items oi
      LEFT JOIN products p1 ON oi.product_id = p1.id
      LEFT JOIN products p2 ON oi.product_id IS NULL AND LOWER(oi.product_name) = LOWER(p2.name)
      LEFT JOIN inventory_summary inv1 ON oi.product_id = inv1.product_id
      LEFT JOIN inventory_summary inv2 ON p2.id = inv2.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `, [id]);
    
    const [historyRows] = await connection.execute(
      'SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC',
      [id]
    );
    
    connection.release();

    const processedItems = itemRows.map(item => {
      let productImage = null;
      if (item.product_images) {
        try {
          let images;
          if (typeof item.product_images === 'string') {
            if (item.product_images.startsWith('[') || item.product_images.startsWith('{')) {
              images = JSON.parse(item.product_images);
            } else {
              images = [item.product_images];
            }
          } else {
            images = item.product_images;
          }

          if (images && images.length > 0) {
            const imageUrl = images[0];
            if (imageUrl.startsWith('http')) {
              productImage = imageUrl;
            } else if (imageUrl.startsWith('/api/')) {
              productImage = `http://localhost:5000${imageUrl}`;
            } else {
              productImage = `http://localhost:5000/api/products/images/${imageUrl}`;
            }
          }
        } catch (e) {
          console.error('Error parsing product images:', e);
          if (typeof item.product_images === 'string') {
            if (item.product_images.startsWith('http')) {
              productImage = item.product_images;
            } else if (item.product_images.startsWith('/api/')) {
              productImage = `http://localhost:5000${item.product_images}`;
            }
          }
        }
      }
      return {
        ...item,
        product_image: productImage
      };
    });

    const order = {
      ...orderRows[0],
      items: processedItems,
      status_history: historyRows
    };

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Create new order - FIXED VERSION
const createOrder = async (req, res) => {
  try {
    const {
      customer_name,
      customer_phone,
      customer_email,
      delivery_address,
      notes,
      cart_items,
      subtotal,
      delivery_fee,
      total_amount,
      order_source = 'online'
    } = req.body;
    
    if (!customer_name || !customer_phone || !delivery_address || !cart_items || cart_items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer_name, customer_phone, delivery_address, cart_items'
      });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const order_number = await generateOrderNumber();      
      
      const [orderResult] = await connection.execute(`
        INSERT INTO orders (
          order_number, customer_name, customer_phone, customer_email,
          delivery_address, notes, subtotal, delivery_fee, total_amount, order_source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order_number, customer_name, customer_phone, customer_email,
        delivery_address, notes, subtotal, delivery_fee, total_amount, order_source
      ]);
      
      const orderId = orderResult.insertId;
      
      // Process each cart item
      for (const item of cart_items) {
        // Determine product ID
        let productId = null;
        if (item.product_id) {
          const parsedId = parseInt(item.product_id);
          if (!isNaN(parsedId) && parsedId > 0) {
            productId = parsedId;
          }
        } else if (item.id && !item.isMix && !item.isCustom) {
          const parsedId = parseInt(item.id);
          if (!isNaN(parsedId) && parsedId > 0) {
            productId = parsedId;
          }
        }

        // Prepare custom details with proper structure
        let customDetails = null;
        
        if (item.isCustom) {
          customDetails = {
            type: 'custom',
            originalEnteredAmount: item.originalEnteredAmount,
            originalRetailPrice: item.originalRetailPrice,
            displayName: item.displayName
          };
        } else if (item.isMix || item.source === 'mix-calculator') {
          // Enhanced mix data extraction
          let mixItems = [];
          let mixNumber = null;
          let totalBudget = parseFloat(item.price) || 0;
          let totalWeight = parseFloat(item.totalWeight) || parseFloat(item.quantity) || 0;

          // Try multiple data sources for mix items
          if (item.custom_details && item.custom_details.mixItems) {
            mixItems = item.custom_details.mixItems;
            mixNumber = item.custom_details.mixNumber;
            totalBudget = item.custom_details.totalBudget || totalBudget;
            totalWeight = item.custom_details.totalWeight || totalWeight;
          } else if (item.mixDetails && item.mixDetails.items) {
            mixItems = item.mixDetails.items;
            mixNumber = item.mixDetails.mixNumber || item.id.replace('mix-', '');
            totalBudget = item.mixDetails.totalBudget || totalBudget;
          } else if (item.mixItems) {
            mixItems = item.mixItems;
            mixNumber = item.mixNumber || item.id.replace('mix-', '');
          }

          // Ensure mixItems are properly structured
          const processedMixItems = mixItems.map(mixItem => ({
            id: mixItem.id || mixItem.product_id,
            name: mixItem.name || mixItem.product_name,
            price: parseFloat(mixItem.price) || parseFloat(mixItem.retail_price) || 0,
            calculatedQuantity: parseFloat(mixItem.calculatedQuantity) || parseFloat(mixItem.quantity) || 0,
            actualCost: parseFloat(mixItem.actualCost) || parseFloat(mixItem.allocatedBudget) || 0,
            unit: mixItem.unit || 'kg',
            allocatedBudget: parseFloat(mixItem.allocatedBudget) || parseFloat(mixItem.actualCost) || 0
          }));

          customDetails = {
            type: 'mix',
            mixItems: processedMixItems,
            mixNumber: mixNumber || item.id.replace('mix-', ''),
            totalWeight: totalWeight,
            totalBudget: totalBudget,
            itemCount: processedMixItems.length,
            source: 'mix-calculator'
          };
        }

        // Convert to JSON string with error handling
        let customDetailsJson = null;
        if (customDetails) {
          try {
            customDetailsJson = JSON.stringify(customDetails);
            // Validate JSON can be parsed back
            JSON.parse(customDetailsJson);
          } catch (jsonError) {
            console.error('JSON serialization error:', jsonError);
            console.error('Failed to serialize:', customDetails);
            // Fallback to simpler structure
            customDetailsJson = JSON.stringify({
              type: item.isMix ? 'mix' : 'custom',
              error: 'Serialization failed',
              originalData: String(customDetails).substring(0, 500)
            });
          }
        }

        // Insert order item with proper error handling
        await connection.execute(`
          INSERT INTO order_items (
            order_id, product_id, product_name, quantity, unit,
            unit_price, total_price, source, mix_number, is_custom, custom_details
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          orderId,
          productId,
          item.name,
          parseFloat(item.quantity) || 1,
          item.unit || 'kg',
          parseFloat(item.price) || 0,
          parseFloat(item.originalEnteredAmount) || (parseFloat(item.price) * parseFloat(item.quantity)),
          item.isMix ? 'mix-calculator' : (item.isCustom ? 'custom' : 'manual'),
          item.mixNumber || null,
          Boolean(item.isCustom) || false,
          customDetailsJson
        ]);
      }
      
      // Add initial status history
      await connection.execute(`
        INSERT INTO order_status_history (order_id, new_status, notes)
        VALUES (?, 'pending', 'Order created')
      `, [orderId]);
      
      await connection.commit();
      connection.release();
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: {
          id: orderId,
          order_number,
          status: 'pending'
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, changed_by, payment } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [currentOrder] = await connection.execute(
        'SELECT status FROM orders WHERE id = ?',
        [id]
      );

      if (currentOrder.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }

      const oldStatus = currentOrder[0].status;

      let updateFields = ['status = ?'];
      let updateValues = [status];

      if (status === 'confirmed') {
        updateFields.push('confirmed_at = CURRENT_TIMESTAMP');
        if (changed_by) {
          updateFields.push('confirmed_by = ?');
          updateValues.push(changed_by);
        }
      } else if (status === 'delivered') {
        updateFields.push('delivered_at = CURRENT_TIMESTAMP');
      } else if (status === 'cancelled') {
        updateFields.push('cancelled_at = CURRENT_TIMESTAMP');
      }

      updateValues.push(id);

      await connection.execute(`
        UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?
      `, updateValues);

      await connection.execute(`
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [id, oldStatus, status, changed_by, notes]);

      // Handle bill creation for delivered orders
      if (status === 'delivered' && oldStatus !== 'delivered') {
        try {
          console.log('🔥 [DEBUG] Creating bill for delivered order:', { id, oldStatus, status });
          
          const [orderResult] = await connection.execute(`
            SELECT o.*,
                   GROUP_CONCAT(
                     JSON_OBJECT(
                       'product_name', oi.product_name,
                       'quantity', oi.quantity,
                       'unit', oi.unit,
                       'unit_price', oi.unit_price,
                       'total_price', oi.total_price
                     )
                   ) as order_items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            WHERE o.id = ?
            GROUP BY o.id
          `, [id]);

          if (orderResult.length > 0) {
            const order = orderResult[0];
            console.log('🔥 [DEBUG] Order data for bill creation:', {
              orderId: id,
              customerId: order.customer_phone,
              totalAmount: order.total_amount
            });
            
            const customerId = await createOrUpdateCustomer(order);

            let orderItems = [];
            if (order.order_items) {
              try {
                orderItems = JSON.parse(`[${order.order_items}]`);
              } catch (e) {
                console.error('Error parsing order items:', e);
                orderItems = [];
              }
            }

            const [existingBills] = await connection.execute(`
              SELECT id, bill_number FROM customer_bills WHERE order_id = ?
            `, [id]);

            if (existingBills.length > 0) {
              console.log('🔥 [DEBUG] Updating existing bill for order:', id);
              await connection.execute(`
                UPDATE customer_bills
                SET
                  subtotal = ?,
                  delivery_fee = ?,
                  total_amount = ?,
                  pending_amount = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE order_id = ?
              `, [
                order.subtotal || 0,
                order.delivery_fee || 0,
                order.total_amount,
                order.total_amount,
                id
              ]);
            } else {
              console.log('🔥 [DEBUG] Creating new bill for order:', id);
              const billNumber = `BILL-${Date.now()}`;

              const [billResult] = await connection.execute(`
                INSERT INTO customer_bills (
                  customer_id, order_id, bill_number, bill_date,
                  order_items, subtotal, delivery_fee, total_amount, pending_amount, due_date
                ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY))
              `, [
                customerId,
                id,
                billNumber,
                JSON.stringify(orderItems),
                order.subtotal || 0,
                order.delivery_fee || 0,
                order.total_amount,
                order.total_amount
              ]);
              
              const billId = billResult.insertId;
              console.log('🔥 [DEBUG] Bill created successfully:', { billId, billNumber, customerId, totalAmount: order.total_amount });
              
              // DO NOT create automatic payment record - this is the main issue!
              // The bill should be created with pending_amount = total_amount
              // and customer outstanding_balance should be increased by total_amount
              
              // Update customer outstanding balance - INCREASE instead of decrease
              await connection.execute(`
                UPDATE customers
                SET
                  total_amount = total_amount + ?,
                  outstanding_balance = outstanding_balance + ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [order.total_amount, order.total_amount, customerId]);
              
              console.log('🔥 [DEBUG] Customer outstanding balance updated - increased by:', order.total_amount);
            }

            // Handle actual payments if provided (this is for when customer pays during delivery)
            if (payment && payment.amount > 0) {
              console.log('🔥 [DEBUG] Processing actual payment:', payment);
              const paymentAmount = parseFloat(payment.amount);

              // Get the bill ID (either existing or newly created)
              const [billResult] = await connection.execute(`
                SELECT id FROM customer_bills WHERE order_id = ?
              `, [id]);
              
              const billId = billResult.length > 0 ? billResult[0].id : null;
              
              if (billId) {
                await connection.execute(`
                  INSERT INTO customer_payments (
                    customer_id, bill_id, payment_date, amount,
                    payment_method, reference_number, notes
                  ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
                `, [
                  customerId,
                  billId,
                  paymentAmount,
                  payment.paymentMethod || 'cash',
                  payment.referenceNumber || null,
                  payment.notes || `Payment for order ${order.order_number}`
                ]);

                await connection.execute(`
                  UPDATE customer_bills
                  SET
                    paid_amount = paid_amount + ?,
                    pending_amount = pending_amount - ?,
                    status = CASE
                      WHEN pending_amount - ? <= 0.01 THEN 'paid'
                      WHEN paid_amount + ? > 0 THEN 'partial'
                      ELSE 'pending'
                    END,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `, [paymentAmount, paymentAmount, paymentAmount, paymentAmount, billId]);

                // Update customer totals - reduce outstanding by payment amount
                await connection.execute(`
                  UPDATE customers
                  SET
                    total_paid = total_paid + ?,
                    outstanding_balance = outstanding_balance - ?,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `, [paymentAmount, paymentAmount, customerId]);
                
                console.log('🔥 [DEBUG] Payment processed - outstanding reduced by:', paymentAmount);
              }
            }
          }
        } catch (billError) {
          console.error('🔥 [ERROR] Error creating customer bill:', billError);
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Order status updated successfully'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const {
      date_from,
      date_to
    } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (date_from) {
      whereConditions.push('DATE(created_at) >= ?');
      queryParams.push(date_from);
    }

    if (date_to) {
      whereConditions.push('DATE(created_at) <= ?');
      queryParams.push(date_to);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [statusCounts] = await connection.execute(`
      SELECT
        status,
        COUNT(*) as count,
        SUM(total_amount) as total_value,
        SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END) as delivered_revenue
      FROM orders
      ${whereClause}
      GROUP BY status
    `, queryParams);

    const [todayStats] = await connection.execute(`
      SELECT
        COUNT(*) as today_orders,
        COALESCE(SUM(total_amount), 0) as today_revenue
      FROM orders
      WHERE DATE(created_at) = CURDATE()
    `);

    const [monthlyStats] = await connection.execute(`
      SELECT
        COUNT(*) as month_orders,
        COALESCE(SUM(total_amount), 0) as month_revenue,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) as month_delivered_revenue
      FROM orders
      WHERE YEAR(created_at) = YEAR(CURDATE())
      AND MONTH(created_at) = MONTH(CURDATE())
    `);

    const deliveredWhereClause = whereConditions.length > 0
      ? `WHERE o.status = 'delivered' AND ${whereConditions.join(' AND ')}`
      : `WHERE o.status = 'delivered'`;

    const [deliveredOrders] = await connection.execute(`
      SELECT o.id, o.total_amount
      FROM orders o
      ${deliveredWhereClause}
    `, queryParams);

    let totalProfit = 0;
    let deliveredRevenue = 0;

    for (const order of deliveredOrders) {
      deliveredRevenue += parseFloat(order.total_amount);

      const [orderItems] = await connection.execute(`
        SELECT
          oi.*,
          COALESCE(inv1.average_cost_per_kg, inv2.average_cost_per_kg, 0) as average_cost_price
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN inventory_summary inv1 ON oi.product_id = inv1.product_id
        LEFT JOIN inventory_summary inv2 ON oi.product_id IS NULL AND LOWER(oi.product_name) = LOWER(p.name) AND inv2.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);

      for (const item of orderItems) {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unit_price) || 0;
        const costPrice = parseFloat(item.average_cost_price) || 0;

        if (item.source === 'mix-calculator' && item.custom_details) {
          try {
            const customDetails = typeof item.custom_details === 'string'
              ? JSON.parse(item.custom_details)
              : item.custom_details;

            if (customDetails.mixItems) {
              let mixProfit = 0;

              for (const mixItem of customDetails.mixItems) {
                const mixQuantity = parseFloat(mixItem.calculatedQuantity || mixItem.quantity || 0);
                const mixRetailPrice = parseFloat(mixItem.price || 0);

                const [costData] = await connection.execute(`
                  SELECT inv.average_cost_per_kg
                  FROM inventory_summary inv
                  JOIN products p ON inv.product_id = p.id
                  WHERE LOWER(p.name) = LOWER(?)
                  LIMIT 1
                `, [mixItem.name]);

                const mixCostPrice = costData.length > 0 ? parseFloat(costData[0].average_cost_per_kg || 0) : 0;

                if (mixCostPrice > 0) {
                  const mixItemProfit = (mixRetailPrice - mixCostPrice) * mixQuantity;
                  if (mixItemProfit > 0) {
                    mixProfit += mixItemProfit;
                  }
                }
              }
              totalProfit += mixProfit;
            }
          } catch (e) {
            console.error('Error parsing mix item custom_details:', e);
          }
        } else {
          if (costPrice > 0) {
            const profitPerUnit = unitPrice - costPrice;
            const itemProfit = profitPerUnit * quantity;

            if (itemProfit > 0) {
              totalProfit += itemProfit;
            }
          }
        }
      }
    }

    const deliveredStats = [{
      delivered_orders: deliveredOrders.length,
      delivered_revenue: deliveredRevenue,
      total_profit: totalProfit
    }];

    connection.release();

    const stats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      total_revenue: 0,
      delivered_revenue: deliveredStats[0].delivered_revenue,
      delivered_orders: deliveredStats[0].delivered_orders,
      totalProfit: deliveredStats[0].total_profit,
      today: todayStats[0],
      monthly: monthlyStats[0]
    };

    statusCounts.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
      stats.total_revenue += parseFloat(row.total_value || 0);
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: error.message
    });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  getOrderStats
};
