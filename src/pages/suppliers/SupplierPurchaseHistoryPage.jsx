import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import BillCard from '../../components/suppliers/BillCard';

const SupplierPurchaseHistoryPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  
  const [purchases, setPurchases] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchPurchases();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterPurchases();
  }, [purchases, searchTerm, selectedSupplier, selectedStatus, dateFrom, dateTo]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/supplier-purchases');
      const data = await response.json();

      if (data.success) {
        const purchaseData = data.data || [];
        setPurchases(purchaseData);
      } else {
        showError(data.message || 'Failed to fetch purchase history');
        setPurchases([]);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
      showError('Failed to load purchase history');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/suppliers');
      const data = await response.json();

      if (data.success) {
        setSuppliers(data.suppliers || []);
      } else {
        console.error('Failed to fetch suppliers:', data.message);
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Error fetching supplierss:', error);
      setSuppliers([]);
    }
  };

  const filterPurchases = () => {
    let filtered = [...purchases];

    // Search by bill number or supplier name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(purchase =>
        purchase.bill_number.toLowerCase().includes(term) ||
        purchase.supplier_name?.toLowerCase().includes(term) ||
        purchase.contact_person?.toLowerCase().includes(term)
      );
    }

    // Filter by supplier
    if (selectedSupplier) {
      filtered = filtered.filter(purchase => 
        purchase.supplier_id === parseInt(selectedSupplier)
      );
    }

    // Filter by status
    if (selectedStatus) {
      filtered = filtered.filter(purchase => purchase.status === selectedStatus);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(purchase => 
        new Date(purchase.purchase_date) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(purchase => 
        new Date(purchase.purchase_date) <= new Date(dateTo)
      );
    }

    setFilteredPurchases(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedSupplier('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
  };

  const handlePaymentUpdate = () => {
    // Refresh purchases when payment is updated
    fetchPurchases();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading purchase history...</p>
            </div>
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
                onClick={() => navigate('/suppliers')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-orange-600 mr-3" />
                  Supplier Purchase History
                </h1>
                <p className="text-gray-600 mt-1">View and manage all supplier purchases</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <FunnelIcon className="h-5 w-5 mr-2" />
              Filters
            </h2>
            <button
              onClick={clearFilters}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search bills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Supplier Filter */}
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Date From */}
            <div className="relative">
              <CalendarIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                placeholder="From Date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div className="relative">
              <CalendarIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                placeholder="To Date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {filteredPurchases.length} of {purchases.length} purchases
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                Paid: {filteredPurchases.filter(p => p.status === 'completed').length}
              </span>
              <span className="text-yellow-600">
                Pending: {filteredPurchases.filter(p => p.status === 'pending').length}
              </span>
              <span className="text-red-600">
                Cancelled: {filteredPurchases.filter(p => p.status === 'cancelled').length}
              </span>
            </div>
          </div>
        </div>

        {/* Purchase Bills */}
        <div className="space-y-4">
          {filteredPurchases.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No purchases found</h3>
              <p className="text-gray-600">
                {purchases.length === 0 
                  ? "No supplier purchases have been made yet."
                  : "Try adjusting your filters to see more results."
                }
              </p>
            </div>
          ) : (
            filteredPurchases.map(purchase => (
              <BillCard
                key={purchase.id}
                bill={purchase}
                onPaymentUpdate={handlePaymentUpdate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierPurchaseHistoryPage;
