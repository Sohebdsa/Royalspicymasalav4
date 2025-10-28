import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, UserGroupIcon, ClockIcon, DocumentTextIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import AddCatererDialog from '../../components/caterers/AddCatererDialog';
import EditCatererDialog from '../../components/caterers/EditCatererDialog';
import CatererCard from '../../components/caterers/CatererCard';

const TabButton = ({ id, label, icon: Icon, isActive, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-orange-100 text-orange-700 border border-orange-200'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`}
  >
    <Icon className="h-4 w-4 mr-2" />
    {label}
  </button>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

const ErrorMessage = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Error</h3>
        <div className="mt-2 text-sm text-red-700">{message}</div>
        {onRetry && (
          <div className="mt-4">
            <button
              onClick={onRetry}
              className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

const EmptyState = ({ message }) => (
  <div className="bg-white rounded-lg shadow p-12 text-center">
    <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
    <h3 className="mt-2 text-sm font-medium text-gray-900">No caterers found</h3>
    <p className="mt-1 text-sm text-gray-500">{message}</p>
  </div>
);

const CaterersPage = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // Dialog state management
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCaterer, setEditingCaterer] = useState(null);

  // Data state
  const [caterers, setCaterers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  // API configuration
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Fetch caterers from API
  const fetchCaterers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/caterers`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch caterers');
      }
      
      if (data.success) {
        setCaterers(data.caterers || []);
      } else {
        throw new Error(data.message || 'Failed to fetch caterers');
      }
    } catch (error) {
      console.error('❌ Error fetching caterers:', error);
      setError(error.message);
      showError(error.message || 'Failed to fetch caterers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch caterers on component mount
  useEffect(() => {
    fetchCaterers();
  }, []);

  // Add Dialog Handlers
  const handleAddCaterer = () => {
    console.log('🆕 Opening add caterer dialog');
    setShowAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    console.log('❌ Closing add caterer dialog');
    setShowAddDialog(false);
    setError(null);
  };

  const handleCatererAdded = (newCaterer) => {
    console.log('✅ New caterer added:', newCaterer);
    setCaterers(prev => [newCaterer, ...prev]);
    setShowAddDialog(false);
    setError(null);
    showSuccess('Caterer added successfully');
  };

  // Edit Dialog Handlers
  const handleEditCaterer = (caterer) => {
    console.log('✏️ Opening edit dialog for:', caterer);
    setEditingCaterer(caterer);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    console.log('❌ Closing edit caterer dialog');
    setShowEditDialog(false);
    setEditingCaterer(null);
  };

  const handleCatererUpdated = (updatedCaterer) => {
    console.log('✅ Caterer updated:', updatedCaterer);
    setCaterers(prev => prev.map(c => 
      c.id === updatedCaterer.id ? updatedCaterer : c
    ));
    setShowEditDialog(false);
    setEditingCaterer(null);
    showSuccess('Caterer updated successfully');
  };

  // Delete caterer handler
  const handleDeleteCaterer = async (caterer) => {
    try {
      console.log('🗑️ Deleting caterer:', caterer.id);
      
      const response = await fetch(`${API_BASE_URL}/caterers/${caterer.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete caterer');
      }
      
      if (data.success) {
        console.log('✅ Caterer deleted successfully');
        setCaterers(prev => prev.filter(c => c.id !== caterer.id));
        showSuccess('Caterer deleted successfully');
      } else {
        throw new Error(data.message || 'Failed to delete caterer');
      }
    } catch (error) {
      console.error('❌ Error deleting caterer:', error);
      setError(error.message);
      showError(error.message || 'Failed to delete caterer');
    }
  };

  // Update caterer (for refresh after operations)
  const handleCatererUpdatedRefresh = async () => {
    try {
      console.log('🔄 Refreshing caterers after update...');
      await fetchCaterers();
    } catch (error) {
      console.error('❌ Error refreshing caterers:', error);
      setError(error.message);
      showError(error.message || 'Failed to refresh caterers');
    }
  };

  // Filter caterers based on search query, tab, and pending filter
  const filteredCaterers = useMemo(() => {
    let filtered = [...caterers];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(caterer =>
        caterer.caterer_name.toLowerCase().includes(query) ||
        (caterer.contact_person && caterer.contact_person.toLowerCase().includes(query)) ||
        caterer.phone_number.includes(query) ||
        (caterer.email && caterer.email.toLowerCase().includes(query)) ||
        (caterer.address && caterer.address.toLowerCase().includes(query))
      );
    }

    // Apply pending bills filter
    if (showPendingOnly) {
      filtered = filtered.filter(caterer =>
        caterer.balance_due && parseFloat(caterer.balance_due) > 0
      );
    }

    // Apply tab filter
    switch (activeTab) {
      case 'pending':
        return filtered.filter(caterer =>
          caterer.balance_due && parseFloat(caterer.balance_due) > 0
        );
      default:
        return filtered;
    }
  }, [caterers, searchQuery, showPendingOnly, activeTab]);

  const pendingCount = caterers.filter(c => c.balance_due && parseFloat(c.balance_due) > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-2xl font-bold text-gray-900">Caterers Management</h1>
            <p className="text-gray-600">
              Manage caterers and their transactions
              {!loading && (
                <span className="ml-2 text-sm text-gray-500">
                  ({caterers.length} caterer{caterers.length !== 1 ? 's' : ''})
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/caterers/sales-history')}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Caterers Selling History
            </button>
            <button
              onClick={handleAddCaterer}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Caterer
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            message={error}
            onRetry={fetchCaterers}
          />
        )}

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search caterers by name, contact person, phone, email, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Pending Bills Filter */}
            {activeTab === 'all' && (
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={showPendingOnly}
                    onChange={(e) => setShowPendingOnly(e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  Show only pending bills
                </label>
              </div>
            )}
          </div>

          {/* Results count */}
          {!loading && (
            <div className="mt-3 text-sm text-gray-600">
              Showing {filteredCaterers.length} of {caterers.length} caterer{caterers.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
              {showPendingOnly && ` with pending bills`}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-1 mb-6">
          <TabButton
            id="all"
            label={`All Caterers ${!loading ? `(${caterers.length})` : ''}`}
            icon={UserGroupIcon}
            isActive={activeTab === 'all'}
            onClick={setActiveTab}
          />
          <TabButton
            id="pending"
            label={`Pending Bills ${!loading ? `(${pendingCount})` : ''}`}
            icon={ClockIcon}
            isActive={activeTab === 'pending'}
            onClick={setActiveTab}
          />
        </div>

        {/* Loading State */}
        {loading && <LoadingSpinner />}

        {/* Tab Content */}
        {!loading && (
          <>
            {activeTab === 'all' && (
              <>
                {filteredCaterers.length === 0 ? (
                  <EmptyState message="Get started by adding your first caterer." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCaterers.map(caterer => (
                      <CatererCard 
                        key={caterer.id} 
                        caterer={caterer}
                        onEdit={handleEditCaterer}
                        onDelete={handleDeleteCaterer}
                        onCatererUpdated={handleCatererUpdatedRefresh}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'pending' && (
              <>
                {filteredCaterers.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <ClockIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Bills</h3>
                    <p>All caterer bills are up to date!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCaterers.map(caterer => (
                      <CatererCard 
                        key={caterer.id} 
                        caterer={caterer}
                        onEdit={handleEditCaterer}
                        onDelete={handleDeleteCaterer}
                        onCatererUpdated={handleCatererUpdatedRefresh}
                        showPendingAmount={true}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Add Caterer Dialog */}
        <AddCatererDialog 
          isOpen={showAddDialog} 
          onClose={handleCloseAddDialog} 
          onCatererAdded={handleCatererAdded} 
        />

        {/* Edit Caterer Dialog */}
        <EditCatererDialog
          isOpen={showEditDialog}
          onClose={handleCloseEditDialog}
          caterer={editingCaterer}
          onCatererUpdated={handleCatererUpdated}
        />
      </div>
    </div>
  );
};

export default CaterersPage;
