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
import CatererBillCard from '../../components/caterers/CatererBillCard';

const CatererSalesHistoryPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  
  const [bills, setBills] = useState([]);
  const [filteredBills, setFilteredBills] = useState([]);
  const [caterers, setCaterers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCaterer, setSelectedCaterer] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchBills();
    fetchCaterers();
  }, []);

  useEffect(() => {
    filterBills();
  }, [bills, searchTerm, selectedCaterer, selectedStatus, dateFrom, dateTo]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/caterer-sales');
      const data = await response.json();

      if (data.success) {
        const billData = data.data || [];
        setBills(billData);
      } else {
        showError(data.message || 'Failed to fetch caterer sales history');
        setBills([]);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      showError('Failed to load caterer sales history');
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaterers = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/caterers');
      const data = await response.json();

      if (data.success) {
        setCaterers(data.caterers || []);
      } else {
        console.error('Failed to fetch caterers:', data.message);
        setCaterers([]);
      }
    } catch (error) {
      console.error('Error fetching caterers:', error);
      setCaterers([]);
    }
  };

  const filterBills = () => {
    let filtered = [...bills];

    // Search by bill number or caterer name
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bill =>
        bill.bill_number.toLowerCase().includes(term) ||
        bill.caterer_name?.toLowerCase().includes(term) ||
        bill.contact_person?.toLowerCase().includes(term)
      );
    }

    // Filter by caterer
    if (selectedCaterer) {
      filtered = filtered.filter(bill =>
        bill.caterer_id === parseInt(selectedCaterer)
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

    setFilteredBills(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCaterer('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
  };

  const handlePaymentUpdate = () => {
    // Refresh bills when payment is updated
    fetchBills();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading caterer sales history...</p>
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
                onClick={() => navigate('/caterers')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-8 w-8 text-orange-600 mr-3" />
                  Caterer Sales History
                </h1>
                <p className="text-gray-600 mt-1">View and manage all caterer sales and payments</p>
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

            {/* Caterer Filter */}
            <select
              value={selectedCaterer}
              onChange={(e) => setSelectedCaterer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">All Caterers</option>
              {caterers.map(caterer => (
                <option key={caterer.id} value={caterer.id}>
                  {caterer.caterer_name}
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
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
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
              Showing {filteredBills.length} of {bills.length} bills
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                Paid: {filteredBills.filter(b => b.payment_status === 'paid').length}
              </span>
              <span className="text-yellow-600">
                Pending: {filteredBills.filter(b => b.payment_status === 'pending').length}
              </span>
              <span className="text-blue-600">
                Partial: {filteredBills.filter(b => b.payment_status === 'partial').length}
              </span>
            </div>
          </div>
        </div>

        {/* Caterer Bills */}
        <div className="space-y-4">
          {filteredBills.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No caterer bills found</h3>
              <p className="text-gray-600">
                {bills.length === 0 
                  ? "No caterer bills have been created yet."
                  : "Try adjusting your filters to see more results."
                }
              </p>
            </div>
          ) : (
            filteredBills.map(bill => (
              <CatererBillCard
                key={bill.id}
                bill={bill}
                onPaymentUpdate={handlePaymentUpdate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CatererSalesHistoryPage;