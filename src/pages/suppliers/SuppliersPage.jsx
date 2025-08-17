import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  FunnelIcon,
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import AddSupplierDialog from '../../components/suppliers/AddSupplierDialog';
import SupplierCard from '../../components/suppliers/SupplierCard';
import { useToast } from '../../contexts/ToastContext';

const SuppliersPage = () => {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const suppliersPerPage = 100;

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchTerm, selectedProducts]);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      // Fetch all suppliers without pagination limit
      const response = await fetch('http://localhost:5000/api/suppliers?limit=1000');
      const data = await response.json();
      if (data.success) {
        setSuppliers(data.suppliers || []);

        // Extract all unique products for filtering
        const products = new Set();
        data.suppliers.forEach(supplier => {
          if (supplier.products_supplied) {
            supplier.products_supplied.forEach(product => products.add(product));
          }
        });
        setAllProducts(Array.from(products).sort());
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      showError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const filterSuppliers = () => {
    let filtered = suppliers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(supplier =>
        supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.phone_number.includes(searchTerm) ||
        (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (supplier.products_supplied && supplier.products_supplied.some(product =>
          product.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }

    // Filter by selected products
    if (selectedProducts.length > 0) {
      filtered = filtered.filter(supplier =>
        supplier.products_supplied &&
        selectedProducts.some(product => supplier.products_supplied.includes(product))
      );
    }

    setFilteredSuppliers(filtered);
  };

  const handleAddSupplier = () => {
    setEditSupplier(null);
    setShowAddDialog(true);
  };

  const handleEditSupplier = (supplier) => {
    setEditSupplier(supplier);
    setShowAddDialog(true);
  };

  const handleSupplierUpdated = () => {
    fetchSuppliers();
  };

  const handlePurchaseHistory = () => {
    navigate('/suppliers/purchase-history');
  };

  const handleProductFilter = (product) => {
    setSelectedProducts(prev => {
      if (prev.includes(product)) {
        return prev.filter(p => p !== product);
      } else {
        return [...prev, product];
      }
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProducts([]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <UserGroupIcon className="h-8 w-8 text-orange-600 mr-3" />
                Suppliers
              </h1>
              <p className="text-gray-600 mt-1">Manage your supplier relationships and contacts</p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handlePurchaseHistory}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Supplier Purchase History
              </button>

              <button
                onClick={handleAddSupplier}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Supplier
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search suppliers by name, contact person, phone, email, or products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Product Filters */}
            {allProducts.length > 0 && (
              <div>
                <div className="flex items-center mb-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-700">Filter by Products:</span>
                  {selectedProducts.length > 0 && (
                    <button
                      onClick={clearFilters}
                      className="ml-2 text-sm text-orange-600 hover:text-orange-800"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allProducts.slice(0, 10).map((product) => (
                    <button
                      key={product}
                      onClick={() => handleProductFilter(product)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedProducts.includes(product)
                          ? 'bg-orange-100 border-orange-300 text-orange-800'
                          : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {product}
                    </button>
                  ))}
                  {allProducts.length > 10 && (
                    <span className="px-3 py-1 text-sm text-gray-500">
                      +{allProducts.length - 10} more products
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FunnelIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Filtered Results</p>
                <p className="text-2xl font-bold text-gray-900">{filteredSuppliers.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserGroupIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Product Categories</p>
                <p className="text-2xl font-bold text-gray-900">{allProducts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Suppliers Grid */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading suppliers...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {suppliers.length === 0 ? 'No suppliers found' : 'No suppliers match your search'}
            </h3>
            <p className="text-gray-600 mb-4">
              {suppliers.length === 0
                ? 'Start by adding your first supplier to manage your supplier relationships.'
                : 'Try adjusting your search terms or filters to find what you\'re looking for.'
              }
            </p>
            {suppliers.length === 0 && (
              <button
                onClick={handleAddSupplier}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSuppliers.slice((currentPage - 1) * suppliersPerPage, currentPage * suppliersPerPage).map((supplier) => (
                <SupplierCard
                  key={supplier.id}
                  supplier={supplier}
                  onEdit={handleEditSupplier}
                  onSupplierUpdated={handleSupplierUpdated}
                />
              ))}
            </div>

            {/* Pagination logic */}
            {filteredSuppliers.length > suppliersPerPage && (
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * suppliersPerPage + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * suppliersPerPage, filteredSuppliers.length)}
                    </span>{' '}
                    of <span className="font-medium">{filteredSuppliers.length}</span> suppliers
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`inline-flex items-center px-3 py-1 border rounded-md text-sm font-medium ${
                        currentPage === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      <ChevronLeftIcon className="h-4 w-4 mr-1" />
                      Previous
                    </button>
                    
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {Math.ceil(filteredSuppliers.length / suppliersPerPage)}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredSuppliers.length / suppliersPerPage)))}
                      disabled={currentPage === Math.ceil(filteredSuppliers.length / suppliersPerPage)}
                      className={`inline-flex items-center px-3 py-1 border rounded-md text-sm font-medium ${
                        currentPage === Math.ceil(filteredSuppliers.length / suppliersPerPage)
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                      }`}
                    >
                      Next
                      <ChevronRightIcon className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Add/Edit Supplier Dialog */}
        <AddSupplierDialog
          isOpen={showAddDialog}
          onClose={() => {
            setShowAddDialog(false);
            setEditSupplier(null);
          }}
          onSupplierAdded={handleSupplierUpdated}
          editSupplier={editSupplier}
        />
      </div>
    </div>
  );
};

export default SuppliersPage;
