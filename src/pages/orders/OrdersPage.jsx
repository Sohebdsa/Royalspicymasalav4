import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

import {
  Package, Clock, CheckCircle, XCircle, Truck, Eye,
  Phone, MapPin, Calendar, Search, RefreshCw, ArrowLeft, IndianRupee, Users,
  ChevronDown,
} from 'lucide-react';

import OrderDetailsModal from '../../components/orders/order-details-modal';
import BatchAllocationDialog from '../../components/orders/BatchAllocationDialog';
import OrderConfirmationDialog from '../../components/orders/order-confirmation-dialog';
import PaymentConfirmationDialog from '../../components/orders/PaymentConfirmationDialog';
import PaymentCollectionDialog from './customerhistory/customers-detailed-page/PaymentCollectionDialog';
import { useToast } from '../../contexts/ToastContext';


// Utility functions
const formatCurrency = (amount) => {
  const numAmount = Number(amount) || 0;
  const formatted = numAmount.toFixed(2);
  if (String(amount).includes('₹')) {
    return String(amount);
  }
  return `₹${formatted}`;
};

const formatDate = (dateStr) => {
  try {
    // Ensure we're working with local date, not UTC
    const date = new Date(dateStr + 'T00:00:00');
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Kolkata' // Explicit timezone for Indian Standard Time
    }).format(date);
  } catch {
    return dateStr;
  }
};

const getDateRange = (selectedDate) => {
  return {
    start: selectedDate,
    end: selectedDate
  };
};

const getDateRangeForFilter = (filterType) => {
  // Use local date methods to avoid timezone issues
  const now = new Date();

  // Create dates using local methods to avoid UTC conversion issues
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getLocalDateString(now);

  switch (filterType) {
    case 'today':
      return {
        start: today,
        end: today
      };

    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDateString(yesterday);
      return {
        start: yesterdayStr,
        end: yesterdayStr
      };

    case 'thisWeek':
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      // Calculate Monday as start of week (Monday = 1, Sunday = 0)
      const daysToSubtract = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);

      return {
        start: getLocalDateString(startOfWeek),
        end: today
      };

    case 'thisMonth':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: getLocalDateString(startOfMonth),
        end: today
      };

    default:
      return {
        start: today,
        end: today
      };
  }
};

// Constants
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="h-4 w-4" />,
    actionButton: { text: 'Approve', action: 'approve', color: 'bg-green-600 hover:bg-green-700' }
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-blue-100 text-blue-700',
    icon: <CheckCircle className="h-4 w-4" />,
    actionButton: { text: 'Process', action: 'process', color: 'bg-purple-600 hover:bg-purple-700' }
  },
  processing: {
    label: 'Processing',
    color: 'bg-purple-100 text-purple-700',
    icon: <Package className="h-4 w-4" />,
    actionButton: { text: 'Ship', action: 'ship', color: 'bg-orange-600 hover:bg-orange-700' }
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    color: 'bg-orange-100 text-orange-700',
    icon: <Truck className="h-4 w-4" />,
    actionButton: { text: 'Deliver', action: 'deliver', color: 'bg-green-600 hover:bg-green-700' }
  },
  delivered: {
    label: 'Delivered',
    color: 'bg-green-100 text-green-700',
    icon: <CheckCircle className="h-4 w-4" />
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-4 w-4" />
  }
};

const SOURCE_CONFIG = {
  online: { label: 'Online', color: 'bg-green-100 text-green-700' },
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  phone: { label: 'Phone', color: 'bg-purple-100 text-purple-700' },
  walk_in: { label: 'Walk-in', color: 'bg-orange-100 text-orange-700' },
  all: { label: 'All Sources', color: 'bg-gray-100 text-gray-700' }
};

// Memoized OrderCard Component
const OrderCard = React.memo(function OrderCard({ order, onViewOrder, onOrderAction }) {
  const statusConfig = STATUS_CONFIG[order.status];
  const sourceConfig = SOURCE_CONFIG[order.order_source];

  return (
    <div className="shadow-lg rounded-lg p-4 hover:bg-gray-50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-2">
          <h3 className="text-lg font-semibold truncate">#{order.order_number}</h3>
          <Badge className={`flex items-center gap-1 ${statusConfig.color}`}>
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </Badge>
          <Badge variant="outline" className={sourceConfig.color}>
            {sourceConfig.label}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 text-sm text-gray-600 gap-2">
          <div className="flex items-center gap-2 truncate">
            <Phone className="h-4 w-4" />
            <span>{order.customer_name} - {order.customer_phone}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <MapPin className="h-4 w-4" />
            <span>{order.delivery_address}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(order.created_at)}</span>
          </div>
        </div>

        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-2 items-center">
          <span className="font-medium">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</span>
          <span className="mx-2">&bull;</span>
          <span className="font-medium">Revenue: {formatCurrency(order.total_amount)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        {statusConfig.actionButton && (
          <Button
            size="sm"
            className={`${statusConfig.actionButton.color} text-white`}
            onClick={() => onOrderAction(order, statusConfig.actionButton.action)}
          >
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.actionButton.text}</span>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => onViewOrder(order)}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      </div>
    </div>
  );
});

// Memoized Orders List Component
const OrdersList = React.memo(function OrdersList({ orders, onViewOrder, onOrderAction }) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">No orders match your current filters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orders</CardTitle>
        <CardDescription>{orders.length} order{orders.length !== 1 ? 's' : ''} found</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            onViewOrder={onViewOrder}
            onOrderAction={onOrderAction}
          />
        ))}
      </CardContent>
    </Card>
  );
});

// Main Component
export default function OrdersPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // State management
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', source: 'all', search: '' });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateFilterType, setDateFilterType] = useState('custom');
  const [confirmationDialog, setConfirmationDialog] = useState({ isOpen: false, order: null, action: 'approve' });
  const [isConfirmationLoading, setIsConfirmationLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState({});
  const [allocationDialog, setAllocationDialog] = useState({ isOpen: false, order: null });

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

  // Data states
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    out_for_delivery: 0,
    delivered: 0,
    cancelled: 0,
    total_revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Refs for stable references and cleanup
  const abortControllerRef = useRef(null);
  const autoRefreshIntervalRef = useRef(null);
  const dailyResetIntervalRef = useRef(null);
  const lastFetchTimeRef = useRef(0);
  const timeoutRefs = useRef(new Set());
  const fetchInProgressRef = useRef(false);
  const currentValuesRef = useRef({ selectedDate });

  // Memoized dialog state check
  const isAnyDialogOpen = useMemo(() => {
    return isDetailsModalOpen ||
      confirmationDialog.isOpen ||
      allocationDialog.isOpen ||
      paymentConfirmDialog.isOpen ||
      paymentCollectionDialog.isOpen;
  }, [
    isDetailsModalOpen,
    confirmationDialog.isOpen,
    allocationDialog.isOpen,
    paymentConfirmDialog.isOpen,
    paymentCollectionDialog.isOpen
  ]);

  // Cleanup function for timeouts
  const addTimeout = useCallback((timeoutId) => {
    timeoutRefs.current.add(timeoutId);
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current.clear();
  }, []);

  // Update ref when values change
  useEffect(() => {
    currentValuesRef.current = { selectedDate };
  }, [selectedDate]);

  // Individual fetch functions with proper error handling and cancellation
  const fetchOrdersOnly = useCallback(async (customDate = selectedDate) => {
    if (ordersLoading || fetchInProgressRef.current) return;

    try {
      fetchInProgressRef.current = true;
      setOrdersLoading(true);

      // ✅ Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      let { start, end } = getDateRange(customDate);
      if (dateFilterType !== 'custom') {
        const dateRange = getDateRangeForFilter(dateFilterType);
        start = dateRange.start;
        end = dateRange.end;
      }

      const params = new URLSearchParams({ date_from: start, date_to: end });

      const response = await fetch(`http://localhost:5000/api/orders?${params}`, {
        signal: abortControllerRef.current.signal // ✅ Request cancellation
      });

      const result = await response.json();
      if (result.success) {
        setOrders(result.data);
        setError(null);
      } else {
        setError('Failed to fetch orders');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching orders:', error);
        setError('Failed to fetch orders');
      }
    } finally {
      setOrdersLoading(false);
      fetchInProgressRef.current = false;
      abortControllerRef.current = null;
    }
  }, [selectedDate, dateFilterType, ordersLoading]);

  const fetchOrderStatsOnly = useCallback(async (customDate = selectedDate) => {
    if (statsLoading) return;

    try {
      setStatsLoading(true);

      let { start, end } = getDateRange(customDate);
      if (dateFilterType !== 'custom') {
        const dateRange = getDateRangeForFilter(dateFilterType);
        start = dateRange.start;
        end = dateRange.end;
      }

      const params = new URLSearchParams({ date_from: start, date_to: end });
      const response = await fetch(`http://localhost:5000/api/orders/stats?${params}`);
      const result = await response.json();

      if (result.success) {
        setOrderStats(result.data);
      }
    } catch (error) {
      console.error('Error fetching order stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedDate, dateFilterType, statsLoading]);

  // Combined fetch function with improved debouncing
  const fetchOrders = useCallback(async (customDate = selectedDate, force = false) => {
    // ✅ Skip if dialogs are open (unless forced)
    if (!force && isAnyDialogOpen) {
      console.log('Skipping fetch: Dialog is open');
      return;
    }

    // ✅ Enhanced debouncing
    const now = Date.now();
    if (!force && now - lastFetchTimeRef.current < 1000) { // Increased to 1 second
      return;
    }

    if (ordersLoading || statsLoading || fetchInProgressRef.current) return;

    lastFetchTimeRef.current = now;

    try {
      if (force || orders.length === 0) {
        setLoading(true);
      }

      await Promise.all([
        fetchOrdersOnly(customDate),
        fetchOrderStatsOnly(customDate)
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (force || orders.length === 0) {
        setLoading(false);
      }
    }
  }, [
    selectedDate,
    ordersLoading,
    statsLoading,
    orders.length,
    fetchOrdersOnly,
    fetchOrderStatsOnly,
    isAnyDialogOpen // ✅ Added missing dependency
  ]);

  // Handle date filter type change
  const handleDateFilterChange = useCallback((filterType) => {
    setDateFilterType(filterType);

    if (filterType !== 'custom') {
      const dateRange = getDateRangeForFilter(filterType);
      setSelectedDate(dateRange.start);
    }
  }, []);

  // Auto-refresh functions with dialog state awareness
  const startAutoRefresh = useCallback(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
    }

    autoRefreshIntervalRef.current = setInterval(() => {
      // ✅ Skip auto-refresh if dialogs are open
      if (isAnyDialogOpen) {
        console.log('Skipping auto-refresh: Dialog is open');
        return;
      }

      const { selectedDate: currentDate } = currentValuesRef.current;
      fetchOrders(currentDate, false);
    }, 120000); // 2 minutes
  }, [isAnyDialogOpen, fetchOrders]);

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshIntervalRef.current) {
      clearInterval(autoRefreshIntervalRef.current);
      autoRefreshIntervalRef.current = null;
    }
  }, []);

  // Daily reset logic
  const startDailyReset = useCallback(() => {
    const checkForDailyReset = () => {
      const now = new Date();
      const lastReset = localStorage.getItem('lastOrdersReset');
      const today = now.toDateString();

      if (!lastReset || lastReset !== today) {
        const newDate = now.toISOString().split('T')[0];
        setSelectedDate(newDate);
        localStorage.setItem('lastOrdersReset', today);
        fetchOrders(newDate, true);
      }
    };

    checkForDailyReset();

    if (dailyResetIntervalRef.current) {
      clearInterval(dailyResetIntervalRef.current);
    }

    dailyResetIntervalRef.current = setInterval(checkForDailyReset, 60000);
  }, [fetchOrders]);

  // Effect for initial load
  useEffect(() => {
    fetchOrders(selectedDate, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    currentValuesRef.current = { selectedDate };
  }, [selectedDate]);

  // Effect for date changes
  useEffect(() => {
    // Only fetch if we have a selectedDate and it's different from the current date
    if (selectedDate) {
      // Use a timeout to prevent immediate fetching on initial render
      const timeoutId = setTimeout(() => {
        fetchOrders(selectedDate, true);
      }, 100);

      timeoutRefs.current.add(timeoutId);
      return () => {
        clearTimeout(timeoutId);
        timeoutRefs.current.delete(timeoutId);
      };
    }
  }, [selectedDate]);

  // Effect for auto-refresh management
  useEffect(() => {
    startAutoRefresh();
    return stopAutoRefresh;
  }, [startAutoRefresh, stopAutoRefresh]);

  // Effect for daily reset
  useEffect(() => {
    startDailyReset();
    return () => {
      if (dailyResetIntervalRef.current) {
        clearInterval(dailyResetIntervalRef.current);
        dailyResetIntervalRef.current = null;
      }
    };
  }, [startDailyReset]);

  // Effect for cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current.clear();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (dailyResetIntervalRef.current) {
        clearInterval(dailyResetIntervalRef.current);
      }
    };
  }, [stopAutoRefresh]);

  // Optimized confirmation dialog refresh - only when needed
  useEffect(() => {
    if (!confirmationDialog.isOpen && confirmationDialog.order && !isAnyDialogOpen) {
      const timeoutId = setTimeout(() => {
        fetchOrders(selectedDate, true);
      }, 500); // ✅ Increased delay

      timeoutRefs.current.add(timeoutId);
      return () => {
        clearTimeout(timeoutId);
        timeoutRefs.current.delete(timeoutId);
      };
    }
  }, [
    confirmationDialog.isOpen,
    confirmationDialog.order,
    isAnyDialogOpen,
    selectedDate,
    fetchOrders
  ]);

  // Use real stats or fallback to calculated stats
  const stats = useMemo(() => {
    if (orderStats.total > 0) {
      return {
        ...orderStats,
        // Profit will be calculated from actual inventory costs
        totalProfit: orderStats.totalProfit || 0
      };
    }

    // Fallback calculation from orders - profit from actual order data
    const result = { total: orders.length, pending: 0, confirmed: 0, processing: 0, out_for_delivery: 0, delivered: 0, cancelled: 0, totalProfit: 0 };
    orders.forEach(order => {
      result[order.status] = (result[order.status] || 0) + 1;
      // Use actual profit from order data (calculated from inventory costs)
      if (order.status === 'delivered' && order.profit) {
        result.totalProfit += parseFloat(order.profit) || 0;
      }
    });
    return result;
  }, [orders, orderStats]);

  // Filter orders (orders are already filtered by date from backend)
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    let filteredList = [...orders];

    // Apply additional filters
    if (filters.status !== 'all') {
      filteredList = filteredList.filter(order => order.status === filters.status);
    }
    if (filters.source !== 'all') {
      filteredList = filteredList.filter(order => order.order_source === filters.source);
    }

    // Apply search
    if (filters.search.trim()) {
      const query = filters.search.toLowerCase();
      filteredList = filteredList.filter(order =>
        order.order_number.toLowerCase().includes(query) ||
        order.customer_name.toLowerCase().includes(query) ||
        order.customer_phone.includes(query)
      );
    }

    return filteredList;
  }, [orders, filters]);

  // Event handlers
  const handleViewOrder = useCallback((order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  }, []);

  const handleOrderAction = useCallback((order, action) => {
    // Intercept process to force allocation dialog
    if (action === 'process') {
      setAllocationDialog({ isOpen: true, order });
      return;
    }
    setConfirmationDialog({ isOpen: true, order, action });
  }, []);

  const handleConfirmAction = async () => {
    if (!confirmationDialog.order) return;

    const orderId = confirmationDialog.order.id;

    // Prevent multiple rapid calls to the same action
    if (actionInProgress[orderId]) {
      return;
    }

    setActionInProgress(prev => ({ ...prev, [orderId]: true }));
    setIsConfirmationLoading(true);

    try {
      const { order, action } = confirmationDialog;

      // Special handling for deliver action - don't update status immediately
      if (action === 'deliver') {
        // Close confirmation dialog
        setConfirmationDialog({ isOpen: false, order: null, action: 'approve' });

        // Show payment confirmation dialog directly
        setPaymentConfirmDialog({
          isOpen: true,
          orderData: order
        });

        return; // Exit early, don't update status yet
      }

      // For all other actions, proceed with immediate status update
      let newStatus = '';

      // Map actions to status
      switch (action) {
        case 'approve':
        case 'confirm':
          newStatus = 'confirmed';
          break;
        case 'process':
          newStatus = 'processing';
          break;
        case 'ship':
          newStatus = 'out_for_delivery';
          break;
        case 'cancel':
          newStatus = 'cancelled';
          break;
        default:
          newStatus = action;
      }

      const response = await fetch(`http://localhost:5000/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          changed_by: 'Admin User',
          notes: `Status changed to ${newStatus}`
        })
      });

      const result = await response.json();

      if (result.success) {
        showSuccess(`Order ${action}d successfully - ${order.order_number}`);

        // Close confirmation dialog
        setConfirmationDialog({ isOpen: false, order: null, action: 'approve' });

        // Refresh orders and close details modal
        await Promise.all([
          fetchOrders(selectedDate),
          fetchOrderStatsOnly(selectedDate)
        ]);
        setIsDetailsModalOpen(false);
      } else {
        throw new Error(result.message || 'Failed to update order');
      }
    } catch (error) {
      console.error('[FRONTEND] Error updating order:', error);
      showError('Failed to update order status. Please try again.');
      // Only close confirmation dialog on error, keep details modal open
      setConfirmationDialog({ isOpen: false, order: null, action: 'approve' });
    } finally {
      setIsConfirmationLoading(false);
      setActionInProgress(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Payment dialog handlers
  const handlePaymentConfirmYes = async () => {
    try {
      // Get customer phone from order data
      const customerPhone = paymentConfirmDialog.orderData?.customer_phone;
      if (!customerPhone) {
        showError('Customer phone number not found');
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
        showError('Customer not found in database');
        return;
      }

      // Fetch customer details and bills
      const customerResponse = await fetch(`http://localhost:5000/api/customers/${customer.id}`);
      const customerResult = await customerResponse.json();

      if (!customerResult.success) {
        throw new Error('Failed to fetch customer details');
      }

      // Find the bill for this order
      const orderBill = customerResult.data.bills.find(bill =>
        bill.order_id === paymentConfirmDialog.orderData.id
      );

      // Open payment collection dialog
      setPaymentCollectionDialog({
        isOpen: true,
        customer: customerResult.data.customer,
        bills: customerResult.data.bills,
        selectedBill: orderBill || null
      });

    } catch (error) {
      console.error('Error preparing payment collection:', error);
      showError('Failed to open payment collection dialog');
    }
  };

  const handlePaymentConfirmNo = async () => {
    try {
      setIsPaymentLoading(true);
      const orderData = paymentConfirmDialog.orderData;

      // First, deduct inventory based on saved allocations
      const deductRes = await fetch(`http://localhost:5000/api/orders/${orderData.id}/deliver-with-deduction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markDelivered: false })
      });
      const deductData = await deductRes.json();
      if (!deductData.success) {
        throw new Error(deductData.message || 'Failed to deduct inventory. Ensure batches are allocated.');
      }

      // Now mark as delivered and add to outstanding
      const response = await fetch(`http://localhost:5000/api/orders/${orderData.id}/status`, {
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

      // Close payment confirmation dialog
      setPaymentConfirmDialog({ isOpen: false, orderData: null });

      showSuccess('Order marked as delivered and amount added to customer\'s outstanding balance');

      // Refresh data
      await Promise.all([
        fetchOrders(selectedDate),
        fetchOrderStatsOnly(selectedDate)
      ]);
      setIsDetailsModalOpen(false);

    } catch (error) {
      console.error('Error marking delivered:', error);
      showError('Failed to mark order as delivered. Please try again.');
    } finally {
      setIsPaymentLoading(false);
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

      // Payment recorded successfully, now deduct inventory and mark as delivered
      const orderData = paymentConfirmDialog.orderData;

      // First, deduct inventory based on saved allocations
      const deductRes = await fetch(`http://localhost:5000/api/orders/${orderData.id}/deliver-with-deduction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markDelivered: false })
      });
      const deductData = await deductRes.json();
      if (!deductData.success) {
        throw new Error(deductData.message || 'Failed to deduct inventory. Ensure batches are allocated.');
      }

      // Now mark order as delivered
      const orderResponse = await fetch(`http://localhost:5000/api/orders/${orderData.id}/status`, {
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

      showSuccess('Payment has been successfully recorded and order marked as delivered');

      // Close all dialogs
      setPaymentCollectionDialog({
        isOpen: false,
        customer: null,
        bills: [],
        selectedBill: null
      });
      setPaymentConfirmDialog({ isOpen: false, orderData: null });

      // Refresh data
      await Promise.all([
        fetchOrders(selectedDate),
        fetchOrderStatsOnly(selectedDate)
      ]);
      setIsDetailsModalOpen(false);

    } catch (error) {
      console.error('Error recording payment:', error);
      showError(error.message || 'Failed to record payment');
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

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Auto-refresh status indicator */}
      {isAnyDialogOpen && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg p-2 text-sm text-yellow-800 z-50">
          Auto-refresh paused while dialog is open
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/dashboard')} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Order Management</h1>
            <p className="text-gray-600">Manage customer orders and track deliveries</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/orders/customer-history')}
          >
            <Users className="h-4 w-4 mr-2" />
            Customer History
          </Button>
          <Button variant="outline" onClick={() => {
            fetchOrders(selectedDate, true); // Force refresh
          }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading orders...</span>
        </div>
      ) : (
        <>
          {/* Date Range Info */}
          <div className="mb-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {dateFilterType === 'custom' 
                        ? `Showing data for: ${formatDate(selectedDate)}` 
                        : `Showing ${dateFilterType}: ${dateFilterType === 'thisWeek' ? getDateRangeForFilter('thisWeek').start : selectedDate} to ${getDateRangeForFilter(dateFilterType).end}`}
                    </span>
                  </div>
                  <div className="text-sm text-blue-600">
                    {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { label: 'Total', value: stats.total, icon: Package, color: 'text-blue-600', filterable: false },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-600', filterable: true, status: 'pending' },
              { label: 'Processing', value: stats.processing, icon: Package, color: 'text-purple-600', filterable: true, status: 'processing' },
              { label: 'Out for Delivery', value: stats.out_for_delivery, icon: Truck, color: 'text-orange-600', filterable: true, status: 'out_for_delivery' },
              { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'text-green-600', filterable: true, status: 'delivered' },
              { label: 'Profit', value: formatCurrency(stats.totalProfit), icon: IndianRupee, color: 'text-blue-600', filterable: false },
            ].map((stat, idx) => (
              <Card
                key={idx}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${filters.status === stat.status
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:bg-gray-50'
                  }`}
                onClick={() => {
                  if (stat.filterable) {
                    // Toggle between the specific status and 'all'
                    const newStatus = filters.status === stat.status ? 'all' : stat.status;
                    updateFilter('status', newStatus);
                  }
                }}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search and Filter Section */}
          <div className="mt-4">
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center justify-start w-full">
                  <div className="relative w-80 flex-shrink-0">
                    <Input
                      placeholder="Search orders..."
                      value={filters.search}
                      onChange={e => updateFilter('search', e.target.value)}
                      className="pl-10 w-full"
                    />
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                  <Select value={filters.status} onValueChange={value => updateFilter('status', value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filters.source} onValueChange={value => updateFilter('source', value)}>
                    <SelectTrigger className="w-48 flex-shrink-0">
                      <SelectValue placeholder="Filter by Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setDateFilterType('custom'); // Switch to custom when date is manually changed
                      }}
                      className="w-40"
                      max={new Date().toISOString().split('T')[0]}
                    />
                    <Select value={dateFilterType} onValueChange={handleDateFilterChange}>
                      <SelectTrigger className="w-fit min-w-[120px]">
                        <SelectValue placeholder="Quick Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="thisWeek">This Week</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4">
            <OrdersList
              orders={filteredOrders}
              onViewOrder={handleViewOrder}
              onOrderAction={handleOrderAction}
            />
          </div>

          {/* Modals */}
          {selectedOrder && (
            <OrderDetailsModal
              order={selectedOrder}
              isOpen={isDetailsModalOpen}
              onClose={() => {
                setSelectedOrder(null);
                setIsDetailsModalOpen(false);
              }}
              onRefresh={() => {
                fetchOrders(selectedDate);
                fetchOrderStatsOnly(selectedDate);
                showSuccess('Order updated successfully');
              }}
            />
          )}

          {confirmationDialog.order && (
            <OrderConfirmationDialog
              isOpen={confirmationDialog.isOpen}
              onClose={() => setConfirmationDialog({ isOpen: false, order: null, action: 'approve' })}
              onConfirm={handleConfirmAction}
              order={confirmationDialog.order}
              action={confirmationDialog.action}
              isLoading={isConfirmationLoading}
            />
          )}

          {/* Batch Allocation Dialog */}
          {allocationDialog.order && (
            <BatchAllocationDialog
              isOpen={allocationDialog.isOpen}
              order={allocationDialog.order}
              onClose={async (saved) => {
                setAllocationDialog({ isOpen: false, order: null });
                if (saved) {
                  // After saving allocations, set status to processing
                  try {
                    const response = await fetch(`http://localhost:5000/api/orders/${allocationDialog.order.id}/status`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'processing', changed_by: 'Admin', notes: 'Processing after batch allocation' })
                    });
                    const result = await response.json();
                    if (result.success) {
                      showSuccess('Order moved to Processing');
                      await Promise.all([
                        fetchOrders(selectedDate),
                        fetchOrderStatsOnly(selectedDate)
                      ]);
                    } else {
                      showError(result.message || 'Failed to update status');
                    }
                  } catch (e) {
                    console.error(e);
                    showError('Failed to update status to Processing');
                  }
                }
              }}
            />
          )}

          {/* Payment Confirmation Dialog */}
          <PaymentConfirmationDialog
            isOpen={paymentConfirmDialog.isOpen}
            onClose={() => setPaymentConfirmDialog({ isOpen: false, orderData: null })}
            onYes={handlePaymentConfirmYes}
            onNo={handlePaymentConfirmNo}
            orderDetails={paymentConfirmDialog.orderData}
            isLoading={isPaymentLoading}
          />

          {/* Payment Collection Dialog */}
          <PaymentCollectionDialog
            isOpen={paymentCollectionDialog.isOpen}
            onClose={closePaymentCollectionDialog}
            onPaymentSubmit={handlePaymentSubmit}
            customer={paymentCollectionDialog.customer}
            bills={paymentCollectionDialog.bills}
            selectedBill={paymentCollectionDialog.selectedBill}
            isLoading={isPaymentLoading}
          />
        </>
      )}
    </div>
  );
}
