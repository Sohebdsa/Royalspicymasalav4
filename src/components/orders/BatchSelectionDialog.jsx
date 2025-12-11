import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '../../contexts/ToastContext';

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

export default function BatchSelectionDialog({
  isOpen,
  onClose,
  product,
  availableBatches,
  currentAllocations,
  onBatchSelection,
  preAllocatedQuantities = {}
}) {
  const { showError, showSuccess } = useToast();
  const [selectedAllocations, setSelectedAllocations] = useState([]);
  const hasInitialized = useRef(false);
  const lastProductId = useRef(null);

  // Initialize only once per product or when dialog first opens with new product
  useEffect(() => {
    if (isOpen && product?.order_item_id) {
      // Only reinitialize if it's a different product or first time opening
      if (!hasInitialized.current || lastProductId.current !== product.order_item_id) {
        // Ensure currentAllocations is an array
        const allocations = Array.isArray(currentAllocations) ? currentAllocations : [];
        setSelectedAllocations(allocations);
        hasInitialized.current = true;
        lastProductId.current = product.order_item_id;
      }
    }
  }, [isOpen, product?.order_item_id, currentAllocations]);

  // Reset initialization flag when dialog closes
  useEffect(() => {
    if (!isOpen) {
      hasInitialized.current = false;
      lastProductId.current = null;
    }
  }, [isOpen]);

  const totalSelectedQuantity = selectedAllocations.reduce(
    (sum, a) => sum + (parseFloat(a.quantity) || 0),
    0
  );
  const remaining = Math.max(0, (product?.quantity || 0) - totalSelectedQuantity);
  const isFully = remaining < 0.0005;

  const updateBatchQty = useCallback(
    (batchId, qty) => {
      const batchInfo = availableBatches?.find(b => b.batch === batchId);
      if (!batchInfo) return;
      const preAllocated = preAllocatedQuantities[batchId] || 0;
      const effectiveTotal = Math.max(0, parseFloat(batchInfo.totalQuantity) - preAllocated);
      const clamped = Math.min(Math.max(qty, 0), effectiveTotal);
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

  const selectAllForBatch = useCallback((batchId) => {
    const batchInfo = availableBatches?.find(b => b.batch === batchId);
    if (!batchInfo) return;
    const preAllocated = preAllocatedQuantities[batchId] || 0;
    const maxAvail = Math.max(0, parseFloat(batchInfo.totalQuantity) - preAllocated);
    const currentlySelected = selectedAllocations.find(a => a.batch === batchId)?.quantity || 0;
    updateBatchQty(batchId, Math.min(maxAvail, remaining + currentlySelected));
  }, [availableBatches, selectedAllocations, remaining, updateBatchQty]);

  const clearBatch = useCallback((batchId) => {
    setSelectedAllocations(prev => prev.filter(a => a.batch !== batchId));
  }, []);

  const handleSave = useCallback(() => {
    if (!product) return;

    if (totalSelectedQuantity + 0.0005 < (product.quantity || 0)) {
      showError(
        `Insufficient allocation. Required: ${(product.quantity || 0).toFixed(3)} ${product.unit}, selected: ${totalSelectedQuantity.toFixed(3)} ${product.unit}`
      );
      return;
    }

    onBatchSelection({
      order_item_id: product.order_item_id,
      product_id: product.product_id,
      product_name: product.product_name,
      allocations: selectedAllocations
    });

    showSuccess('Batches selected');

    // Reset state after successful save
    hasInitialized.current = false;
    lastProductId.current = null;

    onClose();
  }, [product, selectedAllocations, totalSelectedQuantity, onBatchSelection, showSuccess, showError, onClose]);

  const handleCancel = useCallback(() => {
    // Reset state when canceling
    hasInitialized.current = false;
    lastProductId.current = null;
    onClose();
  }, [onClose]);

  // Don't render if no product
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleCancel()}>
      <DialogContent className="max-w-4xl w-[90vw] max-h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            Select Batches for {product.product_name}
            {isFully && (
              <Badge className="ml-2 bg-green-100 text-green-700">Allocated</Badge>
            )}
            {!isFully && (
              <Badge className="ml-2 bg-orange-100 text-orange-700">
                Remaining: {remaining.toFixed(3)} {product.unit}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Required:</span>
              <span className="ml-2">{(product.quantity || 0).toFixed(3)} {product.unit}</span>
            </div>
            <div>
              <span className="font-medium">Selected:</span>
              <span className={`ml-2 ${totalSelectedQuantity >= (product.quantity || 0) ? 'text-green-600' : 'text-orange-600'}`}>
                {totalSelectedQuantity.toFixed(3)} {product.unit}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Batches</h3>
            {!availableBatches || availableBatches.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No batches available
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
                    const preAllocated = preAllocatedQuantities[b.batch] || 0;
                    const totalQty = parseFloat(b.totalQuantity);
                    const effectiveTotal = Math.max(0, totalQty - preAllocated);

                    const canMore = selQty < effectiveTotal && remaining > 0;

                    // Meter Logic
                    const totalUsed = preAllocated + (selQty || 0);
                    const percentUsed = totalQty > 0 ? (totalUsed / totalQty) * 100 : 0;
                    let meterColor = 'bg-blue-600';
                    if (percentUsed > 80) meterColor = 'bg-orange-500';
                    if (percentUsed >= 99) meterColor = 'bg-red-600';

                    return (
                      <tr key={i} className={selQty > 0 ? 'bg-green-50' : ''}>
                        <td className="px-4 py-3 font-mono">{b.batch}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              <span className={effectiveTotal < 0.001 ? "text-red-500 font-medium" : ""}>
                                {effectiveTotal.toFixed(3)}
                              </span>
                              <span className="text-gray-500"> / {totalQty.toFixed(3)} {b.unit}</span>
                            </div>
                            {preAllocated > 0 && (
                              <div className="text-xs text-orange-600">
                                {preAllocated.toFixed(3)} used in other items
                              </div>
                            )}
                            {/* Meter */}
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-300 ${meterColor}`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <QuantityInput
                            value={selQty}
                            onChange={q => updateBatchQty(b.batch, q)}
                            maxQuantity={Math.min(effectiveTotal, remaining + selQty)}
                            unit={b.unit}
                          />
                        </td>
                        <td className="px-4 py-3 space-x-2">
                          {canMore && (
                            <Button variant="outline" size="sm" onClick={() => selectAllForBatch(b.batch)}>
                              Select All
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
            disabled={totalSelectedQuantity + 0.0005 < (product?.quantity || 0)}
            className="ml-3 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
