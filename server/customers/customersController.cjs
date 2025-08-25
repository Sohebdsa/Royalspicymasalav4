const { pool } = require('../config/database.cjs');

// Get all customers with pagination and search
const getCustomers = async (req, res) => {
  try {
    const search = req.query.search || '';

    // Simple query without complex joins for now
    let query, params;

    if (search) {
      const searchPattern = `%${search}%`;
      query = `
        SELECT * FROM customers
        WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
        ORDER BY created_at DESC
      `;
      params = [searchPattern, searchPattern, searchPattern];
    } else {
      query = `
        SELECT * FROM customers
        ORDER BY created_at DESC
      `;
      params = [];
    }

    // Get customers
    const [customers] = await pool.execute(query, params);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: 1,
        limit: customers.length,
        total: customers.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: error.message
    });
  }
};

// Get customer by ID with bills and payments
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get customer details
    const [customerResult] = await pool.execute(`
      SELECT * FROM customers WHERE id = ?
    `, [id]);

    if (customerResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customer = customerResult[0];

    // Get customer bills with order details
    const [bills] = await pool.execute(`
      SELECT
        cb.*,
        o.order_number,
        o.customer_name as order_customer_name,
        o.delivery_address,
        COUNT(cp.id) as payment_count,
        COALESCE(SUM(cp.amount), 0) as total_payments
      FROM customer_bills cb
      LEFT JOIN orders o ON cb.order_id = o.id
      LEFT JOIN customer_payments cp ON cb.id = cp.bill_id
      WHERE cb.customer_id = ?
      GROUP BY cb.id
      ORDER BY cb.created_at DESC, cb.bill_date DESC
    `, [id]);

    // Get customer payments
    const [payments] = await pool.execute(`
      SELECT
        cp.*,
        cb.bill_number
      FROM customer_payments cp
      LEFT JOIN customer_bills cb ON cp.bill_id = cb.id
      WHERE cp.customer_id = ?
      ORDER BY cp.created_at DESC, cp.payment_date DESC
    `, [id]);

    res.json({
      success: true,
      data: {
        customer,
        bills,
        payments
      }
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details',
      error: error.message
    });
  }
};

// Create or update customer from order
const createOrUpdateCustomer = async (orderData) => {
  try {
    const connection = await pool.getConnection();
    
    // Check if customer exists by phone
    const [existingCustomer] = await connection.execute(`
      SELECT id FROM customers WHERE phone = ?
    `, [orderData.customer_phone]);

    let customerId;

    if (existingCustomer.length > 0) {
      // Update existing customer
      customerId = existingCustomer[0].id;
      console.log('🔥 [DEBUG] Updating existing customer:', { customerId, phone: orderData.customer_phone, amountToAdd: orderData.total_amount });
      await connection.execute(`
        UPDATE customers
        SET
          name = ?,
          email = ?,
          address = ?,
          total_orders = total_orders + 1,
          total_amount = total_amount + ?,
          outstanding_balance = outstanding_balance + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        orderData.customer_name,
        orderData.customer_email,
        orderData.delivery_address,
        orderData.total_amount,
        orderData.total_amount,
        customerId
      ]);
    } else {
      // Create new customer
      console.log('🔥 [DEBUG] Creating new customer:', { phone: orderData.customer_phone, initialAmount: orderData.total_amount });
      const [result] = await connection.execute(`
        INSERT INTO customers (
          name, phone, email, address, total_orders, total_amount, outstanding_balance
        ) VALUES (?, ?, ?, ?, 1, ?, ?)
      `, [
        orderData.customer_name,
        orderData.customer_phone,
        orderData.customer_email,
        orderData.delivery_address,
        orderData.total_amount,
        orderData.total_amount
      ]);
      customerId = result.insertId;
    }

    connection.release();
    return customerId;
  } catch (error) {
    console.error('🔥 [ERROR] Error creating/updating customer:', error);
    throw error;
  }
};

// Create customer bill from order
const createCustomerBill = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Get order details with items
    const [orderResult] = await pool.execute(`
      SELECT * FROM orders WHERE id = ? AND status = 'delivered'
    `, [orderId]);

    if (orderResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not delivered'
      });
    }

    const order = orderResult[0];

    // Get order items
    const [orderItems] = await pool.execute(`
      SELECT * FROM order_items WHERE order_id = ?
    `, [orderId]);

    // Check if bill already exists for this order
    const [existingBill] = await pool.execute(`
      SELECT id FROM customer_bills WHERE order_id = ?
    `, [orderId]);

    if (existingBill.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bill already exists for this order'
      });
    }

    // Create or update customer
    const customerId = await createOrUpdateCustomer(order);

    // Generate bill number
    const billNumber = `BILL-${Date.now()}`;

    // Create customer bill
    const [billResult] = await pool.execute(`
      INSERT INTO customer_bills (
        customer_id, order_id, bill_number, bill_date,
        order_items, subtotal, delivery_fee, total_amount, pending_amount, due_date
      ) VALUES (?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 30 DAY))
    `, [
      customerId,
      orderId,
      billNumber,
      JSON.stringify(orderItems),
      order.subtotal || 0,
      order.delivery_fee || 0,
      order.total_amount,
      order.total_amount
    ]);

    res.json({
      success: true,
      message: 'Customer bill created successfully',
      data: {
        billId: billResult.insertId,
        billNumber,
        customerId
      }
    });
  } catch (error) {
    console.error('Error creating customer bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer bill',
      error: error.message
    });
  }
};

// Add payment to customer bill with validation
const addCustomerPayment = async (req, res) => {
  try {
    const { customerId, billId, amount, paymentMethod, referenceNumber, notes } = req.body;

    // Handle receipt image upload
    let receiptImage = null;
    if (req.file) {
      receiptImage = req.file.filename;
    }

    // Validate required fields
    if (!customerId || !amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, amount, and payment method are required'
      });
    }

    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }

    // Validate payment method specific requirements
    if ((paymentMethod === 'cheque' || paymentMethod === 'bank_transfer') && !referenceNumber) {
      return res.status(400).json({
        success: false,
        message: `Reference number is required for ${paymentMethod.replace('_', ' ')} payments`
      });
    }

    // Check customer exists and get current balance
    const [customerResult] = await pool.execute(`
      SELECT outstanding_balance FROM customers WHERE id = ?
    `, [customerId]);

    if (customerResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerBalance = parseFloat(customerResult[0].outstanding_balance);

    // If paying against specific bill, validate bill and amount
    if (billId) {
      const [billResult] = await pool.execute(`
        SELECT pending_amount, status FROM customer_bills
        WHERE id = ? AND customer_id = ?
      `, [billId, customerId]);

      if (billResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Bill not found for this customer'
        });
      }

      const bill = billResult[0];
      console.log('Bill data:', bill); // Debug log

      // Check if bill is already fully paid
      if (bill.status === 'paid') {
        return res.status(400).json({
          success: false,
          message: 'This bill is already fully paid'
        });
      }

      const billOutstanding = parseFloat(bill.pending_amount);
      console.log('Bill outstanding amount:', billOutstanding, 'Payment amount:', paymentAmount); // Debug log

      // Check if payment amount exceeds pending amount
      if (paymentAmount > billOutstanding) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (₹${paymentAmount.toFixed(2)}) cannot exceed bill outstanding amount (₹${billOutstanding.toFixed(2)})`
        });
      }
    } else {
      // For general payments, check against customer total outstanding
      if (paymentAmount > customerBalance) {
        return res.status(400).json({
          success: false,
          message: `Payment amount (${amount}) cannot exceed customer outstanding balance (${customerBalance.toFixed(2)})`
        });
      }
    }

    // Create payment record
    const [paymentResult] = await pool.execute(`
      INSERT INTO customer_payments (
        customer_id, bill_id, payment_date, amount,
        payment_method, reference_number, notes, receipt_image
      ) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)
    `, [
      customerId,
      billId || null,
      paymentAmount,
      paymentMethod,
      referenceNumber || null,
      notes || null,
      receiptImage || null
    ]);

    // Update bill status and amounts if specific bill payment
    if (billId) {
      // First update the amounts
      await pool.execute(`
        UPDATE customer_bills
        SET
          paid_amount = paid_amount + ?,
          pending_amount = pending_amount - ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [paymentAmount, paymentAmount, billId]);

      // Then update the status based on the new pending amount
      await pool.execute(`
        UPDATE customer_bills
        SET
          status = CASE
            WHEN pending_amount <= 0.01 THEN 'paid'
            WHEN paid_amount > 0 THEN 'partial'
            ELSE 'pending'
          END
        WHERE id = ?
      `, [billId]);
    }

    // Update customer totals
    await pool.execute(`
      UPDATE customers
      SET
        total_paid = total_paid + ?,
        outstanding_balance = outstanding_balance - ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paymentAmount, paymentAmount, customerId]);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: {
        paymentId: paymentResult.insertId,
        amount: paymentAmount,
        paymentMethod,
        referenceNumber,
        receiptImage
      }
    });
  } catch (error) {
    console.error('Error adding customer payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record payment',
      error: error.message
    });
  }
};

// Get customer statistics
const getCustomerStats = async (_req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT
        COUNT(*) as total_customers,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_paid), 0) as total_collected,
        COALESCE(SUM(outstanding_balance), 0) as total_outstanding,
        COUNT(CASE WHEN outstanding_balance > 0 THEN 1 END) as customers_with_outstanding
      FROM customers
    `);

    const [billStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_bills,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bills,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_bills,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_bills
      FROM customer_bills
    `);

    res.json({
      success: true,
      data: {
        customers: stats[0],
        bills: billStats[0]
      }
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer statistics',
      error: error.message
    });
  }
};

// Get payments for a specific bill
const getBillPayments = async (req, res) => {
  try {
    const { billId } = req.params;

    // Get bill payments with timestamps
    const [payments] = await pool.execute(`
      SELECT
        cp.*,
        cb.bill_number,
        cb.customer_id
      FROM customer_payments cp
      LEFT JOIN customer_bills cb ON cp.bill_id = cb.id
      WHERE cp.bill_id = ?
      ORDER BY cp.created_at DESC, cp.payment_date DESC
    `, [billId]);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error fetching bill payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill payments',
      error: error.message
    });
  }
};

// Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const [customerResult] = await pool.execute(`
      SELECT name FROM customers WHERE id = ?
    `, [id]);

    if (customerResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Delete customer (bills and payments will be deleted due to CASCADE)
    await pool.execute(`DELETE FROM customers WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: `Customer ${customerResult[0].name} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: error.message
    });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createOrUpdateCustomer,
  createCustomerBill,
  addCustomerPayment,
  getCustomerStats,
  getBillPayments,
  deleteCustomer
};
