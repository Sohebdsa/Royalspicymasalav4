import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '../../contexts/ToastContext';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

const QuantityInput = ({ value, onChange, maxQuantity, unit }) => (
  <div className="flex items-center gap-2">
    <Input
      type="number"
      step="0.001"
      min="0"
      max={maxQuantity}
      value={value}
      onChange={e => onChange(parseFloat(e.target.value || '0'))}
      className="w-24"
    />
    <span className="text-sm text-gray-500">{unit}</span>
  </div>
);

export default function CatererBatchSelectionDialog({
  isOpen,
  onClose,
  product,
  availableBatches,
  onBatchSelection,
  initialQuantity = ''
}) {
  const { showError, showSuccess } = useToast();
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [gst, setGst] = useState('0');

  // Initialize dialog when product changes
  useEffect(() => {
    if (product) {
      setQuantity(initialQuantity);
      setRate(product.rate || '');
      setGst(product.gst || '0');
      setSelectedAllocations([]);
    }
  }, [product, initialQuantity]);


  // Calculate totals
  const totalSelectedQuantity = selectedAllocations.reduce(
    (sum, a) => sum + (parseFloat(a.quantity) || 0),
    0
  );

  const updateBatchQty = useCallback(
    (batchId, qty) => {
      const batchInfo = availableBatches?.find(b => b.batch === batchId);
      if (!batchInfo) return;
      const clamped = Math.min(Math.max(qty, 0), parseFloat(batchInfo.totalQuantity));
      setSelectedAllocations(prev => {
        const idx = prev.findIndex(a => a.batch === batchId);
        if (clamped <= 0) {
          if (idx >= 0) {
            const next = [...prev];
            next.splice(idx, 1);
            return next;
          }
          return prev;
        }
        const entry = { batch: batchId, quantity: clamped, unit: batchInfo.unit };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = entry;
          return next;
        }
        return [...prev, entry];
      });
    },
    [availableBatches]
  );

  const selectBatch = useCallback((batchId) => {
    const batchInfo = availableBatches?.find(b => b.batch === batchId);
    if (!batchInfo) return;
    
    const requiredQuantity = parseFloat(quantity) || 0;
    const currentlySelected = selectedAllocations.find(a => a.batch === batchId)?.quantity || 0;
    const totalSelected = totalSelectedQuantity - currentlySelected; // Exclude current batch from total
    const remaining = Math.max(0, requiredQuantity - totalSelected);
    
    // If this batch has enough quantity to fulfill the remaining requirement, select only what's needed
    if (parseFloat(batchInfo.totalQuantity) >= remaining) {
      updateBatchQty(batchId, remaining);
    } else {
      // If this batch doesn't have enough, select the entire batch and continue with other batches
      updateBatchQty(batchId, parseFloat(batchInfo.totalQuantity));
      
      // If there are still batches available and we still need more quantity, select from the next available batch
      if (remaining > parseFloat(batchInfo.totalQuantity) && availableBatches.length > 1) {
        const nextBatch = availableBatches.find(b => b.batch !== batchId && !selectedAllocations.find(a => a.batch === b.batch));
        if (nextBatch) {
          const newRemaining = remaining - parseFloat(batchInfo.totalQuantity);
          if (parseFloat(nextBatch.totalQuantity) >= newRemaining) {
            updateBatchQty(nextBatch.batch, newRemaining);
          } else {
            updateBatchQty(nextBatch.batch, parseFloat(nextBatch.totalQuantity));
          }
        }
      }
    }
  }, [availableBatches, selectedAllocations, quantity, totalSelectedQuantity, updateBatchQty]);

  const selectOptimalBatchAllocation = useCallback(() => {
    const requiredQuantity = parseFloat(quantity) || 0;
    if (requiredQuantity <= 0) return;
    
    // Clear existing selections
    setSelectedAllocations([]);
    
    let remaining = requiredQuantity;
    const availableBatchesCopy = [...(availableBatches || [])];
    
    // Sort batches by quantity (largest first) to minimize the number of batches used
    availableBatchesCopy.sort((a, b) => parseFloat(b.totalQuantity) - parseFloat(a.totalQuantity));
    
    // Select from batches until we fulfill the requirement
    for (const batch of availableBatchesCopy) {
      if (remaining <= 0) break;
      
      const batchQuantity = parseFloat(batch.totalQuantity);
      const quantityToSelect = Math.min(batchQuantity, remaining);
      
      if (quantityToSelect > 0) {
        updateBatchQty(batch.batch, quantityToSelect);
        remaining -= quantityToSelect;
      }
    }
  }, [quantity, availableBatches, updateBatchQty]);

  const clearBatch = useCallback((batchId) => {
    setSelectedAllocations(prev => prev.filter(a => a.batch !== batchId));
  }, []);

  const handleSave = useCallback(() => {
    if (!product) return;

    const requiredQuantity = parseFloat(quantity) || 0;
    if (requiredQuantity <= 0) {
      showError('Please enter a valid quantity');
      return;
    }

    if (totalSelectedQuantity + 0.0005 < requiredQuantity) {
      showError(
        `Insufficient allocation. Required: ${requiredQuantity.toFixed(3)} ${product.unit}, selected: ${totalSelectedQuantity.toFixed(3)} ${product.unit}`
      );
      return;
    }

    const selectedRate = parseFloat(rate) || 0;
    const selectedGst = parseFloat(gst) || 0;

    if (isNaN(selectedRate) || selectedRate <= 0) {
      showError('Please enter a valid rate');
      return;
    }

    const subtotal = requiredQuantity * selectedRate;
    const gstAmount = (subtotal * selectedGst) / 100;
    const total = subtotal + gstAmount;

    const selectedItem = {
      product_id: product.product_id,
      product_name: product.product_name,
      quantity: requiredQuantity,
      unit: product.unit || 'kg', // Ensure unit is always set
      rate: selectedRate,
      gst: selectedGst,
      subtotal,
      gst_amount: gstAmount,
      total,
      batches: selectedAllocations
    };

    onBatchSelection(selectedItem);

    showSuccess('Item added successfully');
    onClose();
  }, [product, quantity, rate, gst, selectedAllocations, totalSelectedQuantity, onBatchSelection, showError, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  // Don't render if no product
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Select Batches for {product.product_name}
            <Badge className="ml-2 bg-orange-100 text-orange-700">
              Required: {(parseFloat(quantity) || 0).toFixed(3)} {product.unit}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Product Details and Quantity Input */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.000"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Rate (₹) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={rate}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^\d.]/g, '');
                    if (value.includes('.')) {
                      const parts = value.split('.');
                      if (parts[1] && parts[1].length > 2) return;
                    }
                    setRate(value);
                  }}
                  placeholder="0.00"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  GST (%)
                </label>
                <Input
                  type="number"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0"
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Allocation Summary */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Required:</span>
              <span className="ml-2">{(parseFloat(quantity) || 0).toFixed(3)} {product.unit}</span>
            </div>
            <div>
              <span className="font-medium">Selected:</span>
              <span className={`ml-2 ${totalSelectedQuantity >= (parseFloat(quantity) || 0) ? 'text-green-600' : 'text-orange-600'}`}>
                {totalSelectedQuantity.toFixed(3)} {product.unit}
              </span>
            </div>
          </div>

          {/* Available Batches */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Available Batches</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectOptimalBatchAllocation}
                  disabled={!quantity || availableBatches?.length === 0}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  Auto-Select Optimal
                </Button>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <InformationCircleIcon className="h-4 w-4" />
                  <span>Select button will auto-fill needed quantity</span>
                </div>
              </div>
            </div>
            {!availableBatches || availableBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No batches available for this product
              </div>
            ) : (
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selected</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availableBatches.map((b, i) => {
                    const sel = selectedAllocations.find(a => a.batch === b.batch);
                    const selQty = sel ? sel.quantity : 0;
                    const requiredQuantity = parseFloat(quantity) || 0;
                    const remaining = Math.max(0, requiredQuantity - totalSelectedQuantity);
                    // For mix products, allow selection if there's still quantity needed
                    const canMore = selQty < parseFloat(b.totalQuantity) && remaining > 0;
                    
                    return (
                      <tr key={i} className={selQty > 0 ? 'bg-green-50' : ''}>
                        <td className="px-4 py-3 font-mono">{b.batch}</td>
                        <td className="px-4 py-3">{parseFloat(b.totalQuantity).toFixed(3)} {b.unit}</td>
                        <td className="px-4 py-3">
                          <QuantityInput
                            value={selQty}
                            onChange={q => updateBatchQty(b.batch, q)}
                            maxQuantity={Math.min(parseFloat(b.totalQuantity), remaining + selQty)}
                            unit={b.unit}
                          />
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          {canMore && (
                            <Button variant="outline" size="sm" onClick={() => selectBatch(b.batch)}>
                              Select
                            </Button>
                          )}
                          {selQty > 0 && (
                            <Button variant="outline" size="sm" onClick={() => clearBatch(b.batch)} className="text-red-600 border-red-200 hover:bg-red-50">
                              Clear
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex justify-end items-center p-6 pt-4 border-t bg-gray-50">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={totalSelectedQuantity + 0.0005 < (parseFloat(quantity) || 0) || !quantity || !rate}
            className="ml-3 bg-orange-600 hover:bg-orange-700 text-white"
          >
            Add Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}