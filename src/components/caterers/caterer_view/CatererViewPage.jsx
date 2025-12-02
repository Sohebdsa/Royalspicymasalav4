import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  DocumentTextIcon,
  CurrencyRupeeIcon,
  ClockIcon,
  CalendarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShoppingBagIcon,
  ChartBarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../../contexts/ToastContext';
import CatererBillCard from '../CatererBillCard';
import CatererViewFilters from './CatererViewFilters';

const CatererViewPage = () => {
  const { catererId } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  
  // Caterer data state
  const [caterer, setCaterer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Bills data state
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  
  // Request controller for preventing duplicate requests
  const requestController = useRef(null);
  
  // Debounced payment update handler
  const debouncedPaymentUpdate = useRef(null);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Stats state
  const [stats, setStats] = useState({
    totalBills: 0,
    totalAmount: 0,
    paidBills: 0,
    pendingBills: 0,
    partialBills: 0,
    totalPaid: 0,
    totalPending: 0
  });

  // Fetch caterer details
  useEffect(() => {
    fetchCatererDetails();
  }, [catererId]);

  // Fetch caterer bills
  useEffect(() => {
    if (caterer) {
      fetchCatererBills();
    }
  }, [caterer]);

  // Apply filters when filter criteria change
  useEffect(() => {
    filterBills();
  }, [bills, searchTerm, selectedStatus, dateFrom, dateTo, minAmount, maxAmount]);

  // Cleanup abort controller on component unmount
  useEffect(() => {
    return () => {
      if (requestController.current) {
        requestController.current.abort();
      }
    };
  }, []);

  // Simple debounce function with cancel method
  const debounce = (func, wait) => {
    let timeout;
    const debounced = function(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
    
    debounced.cancel = function() {
      clearTimeout(timeout);
    };
    
    return debounced;
  };

  // Initialize debounce
  useEffect(() => {
    debouncedPaymentUpdate.current = debounce(fetchCatererBills, 1000);
    return () => {
      if (debouncedPaymentUpdate.current) {
        debouncedPaymentUpdate.current.cancel();
      }
    };
  }, []);

  const fetchCatererDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:5000/api/caterers/${catererId}`);
      const result = await response.json();
      
      if (result.success) {
        setCaterer(result.caterer);
      } else {
        throw new Error(result.message || 'Failed to fetch caterer details');
      }
    } catch (error) {
      console.error('Error fetching caterer details:', error);
      setError(error.message || 'Failed to fetch caterer details');
      showError('Failed to load caterer information');
    } finally {
      setLoading(false);
    }
  };

  const fetchCatererBills = async () => {
    try {
      // Prevent concurrent requests to the same endpoint
      if (billsLoading) return;
      
      // Cancel any ongoing request
      if (requestController.current) {
        requestController.current.abort();
      }
      
      // Create new controller
      requestController.current = new AbortController();
      
      setBillsLoading(true);
      
      const response = await fetch(`http://localhost:5000/api/caterer-view/${catererId}/sales`, {
        signal: requestController.current.signal
      });
      
      const result = await response.json();
      
      if (result.success) {
        const billData = result.data || [];
        setBills(billData);
        calculateStats(billData);
      } else {
        setBills([]);
        calculateStats([]);
        showError(result.message || 'Failed to fetch caterer bills');
      }
    } catch (error) {
      // Ignore abort errors
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      console.error('Error fetching caterer bills:', error);
      setBills([]);
      calculateStats([]);
      showError('Failed to load caterer bills');
    } finally {
      setBillsLoading(false);
      requestController.current = null;
    }
  };

  const calculateStats = (billData) => {
    const totalBills = billData.length;
    const totalAmount = billData.reduce((sum, bill) => sum + parseFloat(bill.grand_total || 0), 0);
    const paidBills = billData.filter(bill => bill.payment_status === 'paid').length;
    const pendingBills = billData.filter(bill => bill.payment_status === 'pending').length;
    const partialBills = billData.filter(bill => bill.payment_status === 'partial').length;
    const totalPaid = billData.reduce((sum, bill) => sum + parseFloat(bill.total_paid || 0), 0);
    const totalPending = billData.reduce((sum, bill) => {
      const pending = parseFloat(bill.grand_total || 0) - parseFloat(bill.total_paid || 0);
      return sum + (pending > 0 ? pending : 0);
    }, 0);

    setStats({
      totalBills,
      totalAmount,
      paidBills,
      pendingBills,
      partialBills,
      totalPaid,
      totalPending
    });
  };

  const filterBills = () => {
    let filtered = [...bills];

    // Search by bill number or caterer name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bill =>
        bill.bill_number.toLowerCase().includes(term) ||
        bill.caterer_name?.toLowerCase().includes(term)
      );
    }

    // Filter by status
    if (selectedStatus) {
      filtered = filtered.filter(bill => bill.payment_status === selectedStatus);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(bill =>
        new Date(bill.sell_date) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(bill =>
        new Date(bill.sell_date) <= new Date(dateTo)
      );
    }

    // Filter by amount range
    if (minAmount) {
      filtered = filtered.filter(bill =>
        parseFloat(bill.grand_total || 0) >= parseFloat(minAmount)
      );
    }

    if (maxAmount) {
      filtered = filtered.filter(bill =>
        parseFloat(bill.grand_total || 0) <= parseFloat(maxAmount)
      );
    }

    setFilteredBills(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setMaxAmount('');
  };

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return '₹0.00';
    return `₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading caterer details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
                <div className="mt-4">
                  <button
                    onClick={() => navigate('/caterers')}
                    className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Back to Caterers
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!caterer) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Caterer not found</h3>
            <p className="text-gray-600 mb-4">The requested caterer could not be found.</p>
            <button
              onClick={() => navigate('/caterers')}
              className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700"
            >
              Back to Caterers
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/caterers')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <UserIcon className="h-8 w-8 text-orange-600 mr-3" />
                  Caterer Details
                </h1>
                <p className="text-gray-600 mt-1">View and manage caterer information and transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Caterer Information Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start space-x-4">
              {/* Caterer Image */}
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                {caterer.card_image_url ? (
                  <img
                    src={caterer.card_image_url}
                    alt={caterer.caterer_name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <UserIcon className="h-8 w-8 text-gray-400" />
                )}
              </div>
              
              {/* Caterer Details */}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{caterer.caterer_name}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {caterer.contact_person && (
                    <div className="flex items-center text-gray-600">
                      <UserIcon className="h-4 w-4 mr-2" />
                      {caterer.contact_person}
                    </div>
                  )}
                  {caterer.phone_number && (
                    <div className="flex items-center text-gray-600">
                      <PhoneIcon className="h-4 w-4 mr-2" />
                      {caterer.phone_number}
                    </div>
                  )}
                  {caterer.email && (
                    <div className="flex items-center text-gray-600">
                      <EnvelopeIcon className="h-4 w-4 mr-2" />
                      {caterer.email}
                    </div>
                  )}
                  {caterer.address && (
                    <div className="flex items-center text-gray-600">
                      <MapPinIcon className="h-4 w-4 mr-2" />
                      {caterer.address}
                    </div>
                  )}
                  {(caterer.city || caterer.state || caterer.pincode) && (
                    <div className="flex items-center text-gray-600">
                      <MapPinIcon className="h-4 w-4 mr-2" />
                      {[caterer.city, caterer.state, caterer.pincode].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {caterer.gst_number && (
                    <div className="flex items-center text-gray-600">
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      GST: {caterer.gst_number}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={() => navigate(`/caterers/${catererId}/sell`)}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <ShoppingBagIcon className="h-4 w-4 mr-2" />
                Sell to Caterer
              </button>
              <button
                onClick={() => navigate(`/caterers/${catererId}/edit`)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bills</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBills}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CurrencyRupeeIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Paid Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPaid)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pending Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalPending)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
            </h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              {(searchTerm || selectedStatus || dateFrom || dateTo || minAmount || maxAmount) && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Clear All
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <CatererViewFilters
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              minAmount={minAmount}
              setMinAmount={setMinAmount}
              maxAmount={maxAmount}
              setMaxAmount={setMaxAmount}
            />
          )}
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredBills.length} of {bills.length} bills
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                Paid: {stats.paidBills}
              </span>
              <span className="text-yellow-600">
                Pending: {stats.pendingBills}
              </span>
              <span className="text-blue-600">
                Partial: {stats.partialBills}
              </span>
            </div>
          </div>
        </div>

        {/* Bills List */}
        <div className="space-y-4">
          {billsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : filteredBills.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bills found</h3>
              <p className="text-gray-600">
                {bills.length === 0 
                  ? "No bills have been created for this caterer yet."
                  : "Try adjusting your filters to see more results."
                }
              </p>
            </div>
          ) : (
            filteredBills.map(bill => (
              <CatererBillCard
                key={bill.id}
                bill={bill}
                onPaymentUpdate={debouncedPaymentUpdate.current}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CatererViewPage;