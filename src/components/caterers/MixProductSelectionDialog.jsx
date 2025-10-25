import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { useToast } from '../../contexts/ToastContext';
import { InformationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function MixProductSelectionDialog({
  isOpen,
  onClose,
  mixProducts,
  mixName,
  totalBudget,
  onBatchSelectionComplete
}) {
  const { showError, showSuccess } = useToast();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initialize selected products when dialog opens
  useEffect(() => {
    if (isOpen && mixProducts) {
      setSelectedProducts(mixProducts.map(product => ({
        ...product,
        selectedBatch: null,
        selectedQuantity: product.calculatedQuantity || 0,
        allocatedBudget: product.allocatedBudget || 0
      })));
    }
  }, [isOpen, mixProducts]);

  const handleBatchSelect = (productIndex, batchName) => {
    setSelectedProducts(prev => {
      const updated = [...prev];
      updated[productIndex] = {
        ...updated[productIndex],
        selectedBatch: batchName
      };
      return updated;
    });
  };

  const handleBatchClear = (productIndex) => {
    setSelectedProducts(prev => {
      const updated = [...prev];
      updated[productIndex] = {
        ...updated[productIndex],
        selectedBatch: null
      };
      return updated;
    });
  };

  const isAllProductsSelected = () => {
    return selectedProducts.every(product => product.selectedBatch !== null);
  };

  const handleComplete = async () => {
    if (!isAllProductsSelected()) {
      showError('Please select batches for all products');
      return;
    }

    setLoading(true);
    
    try {
      // Prepare the mix data with batch information
      const mixData = {
        mixName: mixName,
        totalBudget: totalBudget,
        mixProducts: selectedProducts.map(product => ({
          ...product,
          batches: [product.selectedBatch] // Array of selected batch names
        }))
      };

      onBatchSelectionComplete(mixData);
      showSuccess('Mix products selected successfully!');
      onClose();
    } catch (error) {
      console.error('Error completing batch selection:', error);
      showError('Failed to complete batch selection');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // Don't render if no products
  if (!mixProducts || mixProducts.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Select Products for Mix: {mixName}
            <Badge className={`ml-2 ${isAllProductsSelected() ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {selectedProducts.filter(p => p.selectedBatch).length}/{mixProducts.length} Selected
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Mix Summary */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium">Total Products:</span>
                <span className="ml-2">{mixProducts.length}</span>
              </div>
              <div>
                <span className="font-medium">Total Budget:</span>
                <span className="ml-2 font-semibold text-blue-600">₹{totalBudget.toFixed(2)}</span>
              </div>
              <div>
                <span className="font-medium">Total Quantity:</span>
                <span className="ml-2">
                  {mixProducts.reduce((sum, p) => sum + (p.calculatedQuantity || 0), 0).toFixed(3)} {mixProducts[0]?.unit || 'kg'}
                </span>
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-4">
            {selectedProducts.map((product, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{product.name}</h4>
                    <p className="text-sm text-gray-600">
                      Quantity: {(product.calculatedQuantity || 0).toFixed(3)} {product.unit || 'kg'} |
                      Budget: ₹{(product.allocatedBudget || 0).toFixed(2)}
                    </p>
                  </div>
                  {product.selectedBatch && (
                    <div className="flex items-center text-green-600">
                      <CheckCircleIcon className="h-5 w-5 mr-1" />
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </div>
                <div className="pt-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Available Batches</h5>
                  {product.availableBatches && product.availableBatches.length > 0 ? (
                    <Select
                      value={product.selectedBatch || ''}
                      onValueChange={(value) => handleBatchSelect(index, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a batch..." />
                      </SelectTrigger>
                      <SelectContent>
                        {product.availableBatches.map((batch, batchIndex) => (
                          <SelectItem key={batchIndex} value={batch.batch}>
                            <div className="flex items-center justify-between w-full">
                              <span>{batch.batch}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {parseFloat(batch.totalQuantity).toFixed(3)} {batch.unit || 'kg'}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      <InformationCircleIcon className="h-4 w-4 mx-auto mb-1" />
                      <p>No batches available for this product</p>
                    </div>
                  )}
                </div>

                {/* Selected Batch Display */}
                {product.selectedBatch && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-800">
                        Selected: {product.selectedBatch}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBatchClear(index)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end items-center p-6 pt-4 border-t bg-gray-50">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!isAllProductsSelected() || loading}
            className="ml-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            ) : (
              'Complete Selection'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}