import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ArrowsRightLeftIcon,
  CubeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';

const MergeProductsDialog = ({ isOpen, onClose, selectedProduct, onMergeSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableBatches, setAvailableBatches] = useState([]);
  const [selectedBatches, setSelectedBatches] = useState([]);


  useEffect(() => {
    if (isOpen && selectedProduct) {
      fetchAvailableBatches();
    }
  }, [isOpen, selectedProduct]);

  const fetchAvailableBatches = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/inventory/product/${selectedProduct.product_id}/batches`);
      const data = await response.json();

      if (data.success) {
        const batches = data.data.map(batch => ({
          batch: batch.batch,
          totalQuantity: parseFloat(batch.total_quantity),
          totalValue: parseFloat(batch.total_value),
          unit: batch.unit,
          lastUpdated: batch.last_updated
        }));
        setAvailableBatches(batches);
      } else {
        showError('Failed to fetch available batches');
        setAvailableBatches([]);
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      showError('Failed to load available batches');
      setAvailableBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSelection = (batch, isSelected) => {
    if (isSelected) {
      setSelectedBatches(prev => [...prev, batch]);
    } else {
      setSelectedBatches(prev => prev.filter(b => b.batch !== batch.batch));
    }
  };

  const handleMerge = async () => {
    if (selectedBatches.length < 2) {
      showError('Please select at least 2 batches to merge');
      return;
    }



    try {
      setLoading(true);

      const totalQuantity = selectedBatches.reduce((sum, batch) => sum + batch.totalQuantity, 0);
      const totalValue = selectedBatches.reduce((sum, batch) => sum + batch.totalValue, 0);

      // Call merge batches API
      const response = await fetch('http://localhost:5000/api/inventory/merge-batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: selectedProduct.product_id,
          batch_ids: selectedBatches.map(b => b.batch)
        })
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`Successfully merged ${selectedBatches.length} batches into ${data.merged_batch.batch}`);
        onMergeSuccess();
        handleClose();
      } else {
        showError(data.message || 'Failed to merge batches');
      }
    } catch (error) {
      console.error('Error merging batches:', error);
      showError('Failed to merge batches');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedBatches([]);
      setAvailableBatches([]);
      onClose();
    }
  };

  const formatQuantity = (quantity, unit) => {
    return `${parseFloat(quantity).toFixed(3)} ${unit}`;
  };

  const formatCurrency = (amount) => {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  };

  if (!selectedProduct) return null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <ArrowsRightLeftIcon className="h-5 w-5 mr-2 text-purple-600" />
            Merge Product Batches
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-180px)]">
          {/* Product Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <CubeIcon className="h-8 w-8 text-orange-600 mr-3" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">{selectedProduct.product_name}</h3>
                <p className="text-sm text-gray-600">
                  Current Total: {formatQuantity(selectedProduct.total_quantity, selectedProduct.unit)} •
                  Value: {formatCurrency(selectedProduct.total_value)}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading available batches...</p>
            </div>
          ) : (
            <>
              {/* Available Batches */}
              <div className="mb-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Available Batches</h4>
                {availableBatches.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No batches available for merging</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {availableBatches.map((batch) => (
                      <label
                        key={batch.batch}
                        className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedBatches.some(b => b.batch === batch.batch)}
                          onChange={(e) => handleBatchSelection(batch, e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900">{batch.batch}</span>
                            <div className="text-right">
                              <div className="text-sm text-gray-900">
                                {formatQuantity(batch.totalQuantity, selectedProduct.unit)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatCurrency(batch.totalValue)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>



              {/* Merge Summary */}
              {selectedBatches.length >= 2 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-purple-600 mt-0.5 mr-2" />
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-purple-900 mb-2">Merge Summary</h5>
                      <div className="text-sm text-purple-800">
                        <p>Merging {selectedBatches.length} batches:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {selectedBatches.map(batch => (
                            <li key={batch.batch}>
                              {batch.batch}: {formatQuantity(batch.totalQuantity, selectedProduct.unit)}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-purple-300">
                          <p className="font-medium">
                            Total: {formatQuantity(
                              selectedBatches.reduce((sum, batch) => sum + batch.totalQuantity, 0),
                              selectedProduct.unit
                            )} •
                            Value: {formatCurrency(
                              selectedBatches.reduce((sum, batch) => sum + batch.totalValue, 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={loading || selectedBatches.length < 2}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Merging...' : 'Merge Batches'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeProductsDialog;
