import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  TagIcon,
  CubeIcon,
  PlusIcon,
  MinusIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';

const InventoryHistoryPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();

  const [history, setHistory] = useState([]);
  const [filteredHistory, setFilteredHistory] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchHistory();
    fetchProducts();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [history, searchTerm, selectedProduct, selectedAction, dateFrom, dateTo]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/inventory/history');
      const data = await response.json();

      if (data.success) {
        setHistory(data.data || []);
      } else {
        showError(data.message || 'Failed to fetch inventory history');
        setHistory([]);
      }
    } catch (error) {
      console.error('Error fetching inventory history:', error);
      showError('Failed to load inventory history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/products');
      const data = await response.json();

      if (data.success) {
        setProducts(data.products || []);
      } else {
        console.error('Failed to fetch products:', data.message);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const filterHistory = () => {
    let filtered = [...history];

    // Search by product name or batch
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.product_name.toLowerCase().includes(term) ||
        item.batch.toLowerCase().includes(term)
      );
    }

    // Filter by product
    if (selectedProduct) {
      filtered = filtered.filter(item =>
        item.product_id === parseInt(selectedProduct)
      );
    }

    // Filter by action
    if (selectedAction) {
      filtered = filtered.filter(item => item.action === selectedAction);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(item =>
        new Date(item.created_at) >= new Date(dateFrom)
      );
    }

    if (dateTo) {
      filtered = filtered.filter(item =>
        new Date(item.created_at) <= new Date(dateTo)
      );
    }

    setFilteredHistory(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProduct('');
    setSelectedAction('');
    setDateFrom('');
    setDateTo('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatQuantity = (quantity, unit) => {
    return `${parseFloat(quantity).toFixed(3)} ${unit}`;
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'added':
        return <PlusIcon className="h-4 w-4 text-green-600" />;
      case 'deducted':
        return <MinusIcon className="h-4 w-4 text-red-600" />;
      case 'updated':
        return <ArrowPathIcon className="h-4 w-4 text-blue-600" />;
      case 'merged':
        return <ArrowsRightLeftIcon className="h-4 w-4 text-purple-600" />;
      default:
        return <CubeIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'added':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'deducted':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'updated':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'merged':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReferenceTypeLabel = (referenceType) => {
    const labels = {
      purchase: 'Purchase',
      manual: 'Manual Entry',
      adjustment: 'Adjustment',
      transfer: 'Transfer'
    };
    return labels[referenceType] || referenceType;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading inventory history...</p>
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
                onClick={() => navigate('/inventory')}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ClockIcon className="h-8 w-8 text-orange-600 mr-3" />
                  Inventory History
                </h1>
                <p className="text-gray-600 mt-1">Track all inventory movements and changes</p>
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
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Product Filter */}
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">All Products</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            {/* Action Filter */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">All Actions</option>
              <option value="added">Added</option>
              <option value="updated">Updated</option>
              <option value="deducted">Deducted</option>
              <option value="merged">Merged</option>
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
              Showing {filteredHistory.length} of {history.length} entries
            </p>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-green-600">
                Added: {filteredHistory.filter(h => h.action === 'added').length}
              </span>
              <span className="text-blue-600">
                Updated: {filteredHistory.filter(h => h.action === 'updated').length}
              </span>
              <span className="text-red-600">
                Deducted: {filteredHistory.filter(h => h.action === 'deducted').length}
              </span>
              <span className="text-purple-600">
                Merged: {filteredHistory.filter(h => h.action === 'merged').length}
              </span>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No history found</h3>
              <p className="text-gray-600">
                {history.length === 0
                  ? "No inventory movements have been recorded yet."
                  : "Try adjusting your filters to see more results."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product & Batch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredHistory.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {entry.product_name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <TagIcon className="h-3 w-3 mr-1" />
                            {entry.batch || 'No batch specified'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(entry.action)}`}>
                          {getActionIcon(entry.action)}
                          <span className="ml-1 capitalize">{entry.action}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          {entry.action === 'added' || entry.action === 'updated' ? (
                            <span className="text-green-600 mr-1">+</span>
                          ) : entry.action === 'deducted' ? (
                            <span className="text-red-600 mr-1"></span>
                          ) : (
                            <span className="text-gray-600 mr-1">~</span>
                          )}
                          <span className={`${entry.action === 'added' || entry.action === 'updated' ? 'text-green-900' :
                            entry.action === 'deducted' ? 'text-red-900' : 'text-gray-900'
                            }`}>
                            {formatQuantity(entry.quantity, entry.unit)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center">
                          {entry.action === 'added' || entry.action === 'updated' ? (
                            <span className="text-green-600 mr-1">+</span>
                          ) : entry.action === 'deducted' ? (
                            <span className="text-red-600 mr-1"></span>
                          ) : (
                            <span className="text-gray-600 mr-1">~</span>
                          )}
                          <span className={`${entry.action === 'added' || entry.action === 'updated' ? 'text-green-900' :
                            entry.action === 'deducted' ? 'text-red-900' : 'text-gray-900'
                            }`}>
                            {formatCurrency(entry.value)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getReferenceTypeLabel(entry.reference_type)}
                        {entry.reference_id && (
                          <div className="text-xs text-gray-400">
                            ID: {entry.reference_id}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(entry.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryHistoryPage;
