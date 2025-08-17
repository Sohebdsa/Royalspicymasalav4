import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator'; // Fixed typo: was 'seprator'
import {
  Printer,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Package,
  User,
  MessageSquare,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  IndianRupee,
  X,
  FileText,
  CreditCard
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import BatchAllocationDialog from './BatchAllocationDialog';
import PaymentConfirmationDialog from './PaymentConfirmationDialog';
import OrderPaymentCollectionDialog from './OrderPaymentCollectionDialog';


const formatCurrency = (amount) => {
  const numAmount = Number(amount) || 0;
  const formatted = numAmount.toFixed(2);
  // Check if the amount already has ₹ symbol to avoid duplication
  if (String(amount).includes('₹')) {
    return String(amount);
  }
  return `₹${formatted}`;
};

const formatDate = (dateStr) => {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
};

const formatQuantity = (qty) => {
  const numQty = parseFloat(qty);
  return isNaN(numQty) ? '0.000' : numQty.toFixed(3);
};


const calculateActualProfit = (items) => {
  let totalProfit = 0;

  // Cost lookup for consistent profit calculation
  const costLookup = {
    'almonds': 900,
    'cashews': 500,
    'mirchi': 250
  };

  items.forEach(item => {
    const quantity = parseFloat(item.quantity) || 0;
    const unitPrice = parseFloat(item.unit_price) || 0;
    const costPrice = parseFloat(item.average_cost_price) || 0;

    // Handle mix items specially
    if (item.source === 'mix-calculator' && item.custom_details?.mixItems) {
      // Calculate profit based on mix components
      let mixProfit = 0;
      item.custom_details.mixItems.forEach(mixItem => {
        const mixQuantity = parseFloat(mixItem.calculatedQuantity || mixItem.quantity || 0);
        const mixRetailPrice = parseFloat(mixItem.price || 0);
        const mixCostPrice = costLookup[mixItem.name.toLowerCase()] || 0;

        if (mixCostPrice > 0) {
          const mixItemProfit = (mixRetailPrice - mixCostPrice) * mixQuantity;
          if (mixItemProfit > 0) {
            mixProfit += mixItemProfit;
          }
        }
      });
      totalProfit += mixProfit;
    } else {
      // Regular item profit calculation
      if (costPrice > 0) {
        const profitPerUnit = unitPrice - costPrice;
        const itemProfit = profitPerUnit * quantity;

        // Only add positive profits (ignore items where cost > retail)
        if (itemProfit > 0) {
          totalProfit += itemProfit;
        }
      }
    }
  });

  return totalProfit;
};


const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    processing: 'bg-purple-100 text-purple-700',
    out_for_delivery: 'bg-orange-100 text-orange-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};


export default function OrderDetailsModal({ order, isOpen, onClose, onRefresh }) {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Payment dialog states
  const [paymentConfirmDialog, setPaymentConfirmDialog] = useState({
    isOpen: false,
    orderData: null
  });
  const [paymentCollectionDialog, setPaymentCollectionDialog] = useState({
    isOpen: false,
    customer: null,
    bills: [],
    selectedBill: null
  });
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [allocationDialogOpen, setAllocationDialogOpen] = useState(false);

  // Reset state when modal opens/closes or order changes
  useEffect(() => {
    if (isOpen && order) {
      setOrderDetails(order);
      setNewStatus(order.status || '');
      setIsLoading(false);
      setFetchingDetails(false);
    } else if (!isOpen) {
      // Reset state when modal closes
      setOrderDetails(null);
      setNewStatus('');
      setIsLoading(false);
      setFetchingDetails(false);
    }
  }, [isOpen, order?.id]);

  // Fetch full order details only once when modal opens
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!order?.id || !isOpen || fetchingDetails) return;

      try {
        setFetchingDetails(true);
        const response = await fetch(`http://localhost:5000/api/orders/${order.id}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data) {
          setOrderDetails(result.data);
          setNewStatus(result.data.status);
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
        // Keep the basic order data if fetch fails
      } finally {
        setFetchingDetails(false);
      }
    };

    // Only fetch if we have basic order data but no items
    if (isOpen && order && (!orderDetails?.items || orderDetails.items.length === 0)) {
      fetchOrderDetails();
    }
  }, [isOpen, order?.id, orderDetails?.items]);

  // Handle dialog close properly
  const handleClose = (open) => {
    if (!open) {
      setIsLoading(false);
      setNewStatus('');
      onClose();
    }
  };

  const handleStatusUpdate = async () => {
    const displayOrder = orderDetails || order;
    if (newStatus === displayOrder.status) return;

    // If moving to processing, require allocations first
    if (newStatus === 'processing') {
      setAllocationDialogOpen(true);
      return;
    }

    // If moving to delivered, ONLY show payment confirmation dialog (no status update yet)
    if (newStatus === 'delivered') {
      setPaymentConfirmDialog({
        isOpen: true,
        orderData: displayOrder
      });
      return; // Don't update status here
    }

    // For other status changes, update immediately
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/orders/${displayOrder.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          changed_by: 'Admin User',
          notes: `Status changed to ${newStatus} from order details`
        })
      });

      const result = await response.json();

      if (result.success) {
        setOrderDetails(prev => prev ? { ...prev, status: newStatus } : prev);

        toast({
          title: 'Status Updated',
          description: `Order status changed to ${newStatus.replace('_', ' ')}`,
          type: 'success'
        });

        if (onRefresh) onRefresh();
      } else {
        throw new Error(result.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order status. Please try again.',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    // Print functionality removed - will be updated later
  };

  // Payment dialog handlers
  const handlePaymentConfirmYes = async () => {
    try {
      // Get customer phone from order data
      const customerPhone = paymentConfirmDialog.orderData?.customer_phone;

      if (!customerPhone) {
        toast({
          title: 'Error',
          description: 'Customer phone number not found',
          type: 'error'
        });
        return;
      }

      // Find customer by phone number
      const customersResponse = await fetch('http://localhost:5000/api/customers');
      const customersResult = await customersResponse.json();

      if (!customersResult.success) {
        throw new Error('Failed to fetch customers');
      }

      // Find customer by phone number
      const customer = customersResult.data.find(c => c.phone === customerPhone);
      if (!customer) {
        toast({
          title: 'Error',
          description: 'Customer not found in database',
          type: 'error'
        });
        return;
      }

      // Fetch customer details and bills
      const customerResponse = await fetch(`http://localhost:5000/api/customers/${customer.id}`);
      const customerResult = await customerResponse.json();

      if (!customerResult.success) {
        throw new Error('Failed to fetch customer details');
      }

      // Debug: Log the customer data structure
      console.log('🔥 [DEBUG] Customer data structure:', {
        customer: customerResult.data.customer,
        hasOutstandingBalance: 'outstanding_balance' in customerResult.data.customer,
        outstandingBalance: customerResult.data.customer?.outstanding_balance,
        hasTotalOutstanding: 'total_outstanding' in customerResult.data.customer,
        totalOutstanding: customerResult.data.customer?.total_outstanding,
        bills: customerResult.data.bills,
        orderData: paymentConfirmDialog.orderData
      });

      // Find the bill for this order
      const orderBill = customerResult.data.bills.find(bill =>
        bill.order_id === paymentConfirmDialog.orderData.id
      );

      // Debug: Log the order data structure
      console.log('🔥 [DEBUG] Order data structure:', {
        order: paymentConfirmDialog.orderData,
        hasTotalAmount: 'total_amount' in paymentConfirmDialog.orderData,
        totalAmount: paymentConfirmDialog.orderData?.total_amount,
        orderBill: orderBill
      });

      // Open payment collection dialog
      setPaymentCollectionDialog({
        isOpen: true,
        customer: customerResult.data.customer,
        bills: customerResult.data.bills,
        selectedBill: orderBill || null
      });

    } catch (error) {
      console.error('Error preparing payment collection:', error);
      toast({
        title: 'Error',
        description: 'Failed to open payment collection dialog',
        type: 'error'
      });
    }
  };

  const handlePaymentConfirmNo = async () => {
    try {
      const displayOrder = orderDetails || order;
      const response = await fetch(`http://localhost:5000/api/orders/${displayOrder.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'delivered',
          changed_by: 'Admin User',
          notes: 'Order delivered; amount added to outstanding'
        })
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to mark order as delivered');
      }
      setOrderDetails(prev => prev ? { ...prev, status: 'delivered' } : prev);
      setPaymentConfirmDialog({ isOpen: false, orderData: null });
      toast({
        title: 'Payment Status Updated',
        description: 'Order marked as delivered and amount added to outstanding',
        type: 'success'
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error marking delivered:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark order as delivered. Please try again.',
        type: 'error'
      });
    }
  };

  const handlePaymentSubmit = async (formData) => {
    try {
      setIsPaymentLoading(true);

      // First record the payment
      const response = await fetch('http://localhost:5000/api/customers/payments', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to record payment');
      }

      // Payment recorded successfully, now mark order as delivered
      const displayOrder = orderDetails || order;
      const orderResponse = await fetch(`http://localhost:5000/api/orders/${displayOrder.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'delivered',
          changed_by: 'Admin User',
          notes: 'Order marked as delivered after payment confirmation'
        })
      });

      const orderResult = await orderResponse.json();
      if (!orderResult.success) {
        throw new Error(orderResult.message || 'Failed to mark order as delivered');
      }

      toast({
        title: 'Payment Recorded',
        description: 'Payment has been successfully recorded and order marked as delivered',
        type: 'success'
      });

      // Update local order details
      setOrderDetails(prev => prev ? { ...prev, status: 'delivered' } : prev);
      setNewStatus('delivered'); // Update the select dropdown

      // Close payment collection dialog
      setPaymentCollectionDialog({
        isOpen: false,
        customer: null,
        bills: [],
        selectedBill: null
      });

      // Close payment confirmation dialog if it's open
      setPaymentConfirmDialog({ isOpen: false, orderData: null });

      // Call parent refresh callback
      if (onRefresh) onRefresh();

    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to record payment',
        type: 'error'
      });
    } finally {
      setIsPaymentLoading(false);
    }
  };


  const closePaymentCollectionDialog = () => {
    setPaymentCollectionDialog({
      isOpen: false,
      customer: null,
      bills: [],
      selectedBill: null
    });
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      confirmed: <CheckCircle className="h-4 w-4" />,
      processing: <Package className="h-4 w-4" />,
      out_for_delivery: <Truck className="h-4 w-4" />,
      delivered: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };

  // Don't render if no order data
  if (!order) return null;

  // Use orderDetails if available, fallback to order
  const displayOrder = orderDetails || order;

  // Show loading state while fetching details
  if (fetchingDetails) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-gray-600">Loading order details...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] max-h-[95vh] p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
              #{order.order_number?.slice(-3) || '000'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-500">#{order.order_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(displayOrder.status)}`}>
              {displayOrder.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="text-gray-900 font-medium">{displayOrder.customer_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <p className="text-gray-900 flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {displayOrder.customer_phone}
                    </p>
                  </div>
                  {displayOrder.customer_email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-gray-900 flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {displayOrder.customer_email}
                      </p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600">Delivery Address</label>
                    <p className="text-gray-900 flex items-start gap-1">
                      <MapPin className="h-4 w-4 mt-0.5" />
                      {displayOrder.delivery_address}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Items
                </h3>
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(displayOrder.items || []).map((item, index) => {
                        let customDetails = null;
                        if (item.custom_details) {
                          try {
                            // MySQL JSON fields are returned as objects, not strings
                            customDetails = typeof item.custom_details === 'string'
                              ? JSON.parse(item.custom_details)
                              : item.custom_details;
                          } catch (e) {
                            customDetails = item.custom_details; // Fallback to raw data
                          }
                        }

                        return (
                          <React.Fragment key={index}>
                            <tr>
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-medium text-gray-900">{item.product_name}</div>
                                  {item.source === 'mix-calculator' && (
                                    <div className="text-xs text-blue-600">Mix Item</div>
                                  )}
                                  {item.source === 'custom' && (
                                    <div className="text-xs text-purple-600">Custom Item</div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-900">
                                {formatQuantity(item.quantity)} {item.unit}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-gray-900">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                                {formatCurrency(item.total_price)}
                              </td>
                            </tr>

                            {item.source === 'mix-calculator' && customDetails?.mixItems && (
                              <tr>
                                <td colSpan="4" className="px-4 py-0">
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-2">
                                    <div className="flex items-center justify-between mb-3">
                                      <h6 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                                        <Package className="h-4 w-4" />
                                        Mix Components to Prepare
                                      </h6>
                                      <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                        {customDetails.mixItems.length} items
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {customDetails.mixItems.map((mixItem, mixIndex) => (
                                        <div key={mixIndex} className="bg-white border border-blue-200 rounded-lg p-3">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <div className="font-medium text-gray-900 text-sm">{mixItem.name}</div>
                                              <div className="text-xs text-gray-500">@ {formatCurrency(mixItem.price || 0)}/kg</div>
                                            </div>
                                            <div className="text-right">
                                              <div className="font-bold text-blue-600">
                                                {formatQuantity(mixItem.calculatedQuantity || mixItem.quantity || 0)} kg
                                              </div>
                                              <div className="text-xs text-gray-500">= {formatCurrency(mixItem.actualCost || mixItem.allocatedBudget || 0)}</div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-blue-200">
                                      <div className="flex justify-between text-sm">
                                        <span className="text-blue-700 font-medium">Total Mix Weight:</span>
                                        <span className="text-blue-800 font-bold">
                                          {(customDetails.totalWeight?.toFixed(3) || item.quantity?.toFixed(3)) + ' kg'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-blue-700 font-medium">Total Budget:</span>
                                        <span className="text-blue-800 font-bold">{formatCurrency(customDetails.totalBudget || item.total_price)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {displayOrder.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{displayOrder.notes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Order Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(displayOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Fee</span>
                    <span className="font-medium">{displayOrder.delivery_fee === 0 ? 'FREE' : formatCurrency(displayOrder.delivery_fee || 0)}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between">
                      <span className="text-lg font-semibold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-blue-600">{formatCurrency(displayOrder.total_amount)}</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Status</span>
                      <span className={`font-medium ${displayOrder.payment_status === 'paid' ? 'text-green-600' : displayOrder.payment_status === 'partial' ? 'text-yellow-600' : 'text-red-600'}`}>
                        {displayOrder.payment_status || 'unpaid'}
                      </span>
                    </div>
                    {displayOrder.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method</span>
                        <span className="font-medium capitalize">{displayOrder.payment_method}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Current Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(displayOrder.status)}`}>
                        {displayOrder.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Update Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="processing">Processing</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {newStatus !== displayOrder.status && newStatus !== 'delivered' && (
                    <button
                      onClick={handleStatusUpdate}
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Updating...' : 'Update Status'}
                    </button>
                  )}
                  {newStatus === 'delivered' && displayOrder.status !== 'delivered' && (
                    <button
                      onClick={() => setPaymentConfirmDialog({ isOpen: true, orderData: displayOrder })}
                      disabled={isLoading}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Proceed to Payment Confirmation'}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Order Timeline
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="text-gray-900">{formatDate(displayOrder.created_at)}</span>
                  </div>
                  {displayOrder.approved_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="text-gray-900">{formatDate(displayOrder.approved_at)}</span>
                    </div>
                  )}
                  {displayOrder.delivered_at && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Delivered</span>
                      <span className="text-gray-900">{formatDate(displayOrder.delivered_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </DialogContent>

      {/* Payment Confirmation Dialog */}
      <PaymentConfirmationDialog
        isOpen={paymentConfirmDialog.isOpen}
        onClose={() => setPaymentConfirmDialog({ isOpen: false, orderData: null })}
        onYes={handlePaymentConfirmYes}
        onNo={handlePaymentConfirmNo}
        orderDetails={paymentConfirmDialog.orderData}
        isLoading={isPaymentLoading}
      />

      {/* Order Payment Collection Dialog */}
      <OrderPaymentCollectionDialog
        isOpen={paymentCollectionDialog.isOpen}
        onClose={closePaymentCollectionDialog}
        onPaymentSubmit={handlePaymentSubmit}
        order={displayOrder}
        customer={paymentCollectionDialog.customer}
        isLoading={isPaymentLoading}
      />

      {/* Batch Allocation Dialog */}
      {order && (
        <BatchAllocationDialog
          key={displayOrder.id} // Add key to force re-render when order changes
          isOpen={allocationDialogOpen}
          order={displayOrder}
          onClose={async (saved) => {
            setAllocationDialogOpen(false);
            if (saved) {
              // After saving allocations, set status to processing
              try {
                const response = await fetch(`http://localhost:5000/api/orders/${displayOrder.id}/status`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'processing', changed_by: 'Admin', notes: 'Processing after batch allocation' })
                });
                const result = await response.json();
                if (result.success) {
                  toast({ title: 'Status Updated', description: 'Order moved to Processing', type: 'success' });
                  if (onRefresh) onRefresh();
                } else {
                  toast({ title: 'Error', description: result.message || 'Failed to update status', type: 'error' });
                }
              } catch (e) {
                console.error(e);
                toast({ title: 'Error', description: 'Failed to update status to Processing', type: 'error' });
              }
            }
          }}
        />
      )}
    </Dialog>
  );
}
// Remove the automatic status update from handleStatusUpdate for 'delivered' status


// Modified handlePaymentConfirmNo to mark as delivered
const handlePaymentConfirmNo = async () => {
  try {
    setIsPaymentLoading(true);
    const displayOrder = orderDetails || order;

    const response = await fetch(`http://localhost:5000/api/orders/${displayOrder.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'delivered',
        changed_by: 'Admin User',
        notes: 'Order delivered; amount added to outstanding'
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to mark order as delivered');
    }

    setOrderDetails(prev => prev ? { ...prev, status: 'delivered' } : prev);
    setNewStatus('delivered'); // Update the select dropdown
    setPaymentConfirmDialog({ isOpen: false, orderData: null });

    toast({
      title: 'Order Delivered',
      description: 'Order marked as delivered and amount added to outstanding',
      type: 'success'
    });

    if (onRefresh) onRefresh();
  } catch (error) {
    console.error('Error marking delivered:', error);
    toast({
      title: 'Error',
      description: 'Failed to mark order as delivered. Please try again.',
      type: 'error'
    });
  } finally {
    setIsPaymentLoading(false);
  }
};

// Modified handlePaymentSubmit to mark as delivered after payment
