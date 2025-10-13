import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '../../contexts/ToastContext';
import BatchSelectionDialog from './BatchSelectionDialog';

function useDebounce(value, delay = 100) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useThrottleCallback(callback, limit = 1000) {
  const lastCall = useRef(0);
  return useCallback(async (...args) => {
    const now = Date.now();
    if (now - lastCall.current >= limit) {
      lastCall.current = now;
      await callback(...args);
    }
  }, [callback, limit]);
}

const QuantityInput = ({ value, onChange }) => (
  <Input
    type="number"
    step="0.001"
    min="0"
    value={value}
    onChange={e => onChange(parseFloat(e.target.value || '0'))}
    className="w-24"
  />
);

export default function BatchAllocationDialog({ isOpen, onClose, order }) {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(false);
  const [allocations, setAllocations] = useState({});
  const [availableBatches, setAvailableBatches] = useState({});
  const [orderData, setOrderData] = useState(order || null);
  const [batchSelectionDialog, setBatchSelectionDialog] = useState({
    isOpen: false,
    product: null,
    currentAllocations: []
  });

  // Memoize order prop to prevent unnecessary re-renders
  const memoizedOrder = useMemo(() => order, [order?.id, JSON.stringify(order)]);
  
  // Preserve allocations between re-renders when the same order is opened
  const prevOrderRef = useRef(memoizedOrder?.id);
  const prevAllocationsRef = useRef(allocations);
  
  useEffect(() => {
    if (memoizedOrder?.id && memoizedOrder.id === prevOrderRef.current) {
      // Same order, restore previous allocations
      setAllocations(prevAllocationsRef.current);
    } else if (memoizedOrder?.id) {
      // New order, reset allocations
      prevOrderRef.current = memoizedOrder.id;
      prevAllocationsRef.current = {};
      setAllocations({});
    }
  }, [memoizedOrder?.id]);

  const formatCurrency = amt =>
    typeof amt !== 'number' || isNaN(amt) ? '₹0.00' : `₹${amt.toFixed(2)}`;

  const itemsNeedingAllocation = useMemo(() => {
    if (!orderData?.items) return [];
    const allocationItems = [];
    for (const item of orderData.items) {
      if (item.source === 'mix-calculator') {
        let details;
        try {
          details = typeof item.custom_details === 'string'
            ? JSON.parse(item.custom_details)
            : item.custom_details;
        } catch {
          continue;
        }
        if (details?.mixItems) {
          details.mixItems.forEach((mixItem, idx) => {
            const pid = parseInt(mixItem.id) || parseInt(mixItem.product_id);
            if (!pid) return;
            const mixKey = `${item.id}::${idx}`;
            allocationItems.push({
              order_item_id: mixKey,
              product_id: pid,
              product_name: mixItem.name,
              quantity: parseFloat(mixItem.calculatedQuantity || mixItem.quantity || 0),
              unit: mixItem.unit || 'kg',
              price: parseFloat(mixItem.price || 0),
              source: 'mix',
              parent_mix_id: item.id,
              mix_component_index: idx
            });
          });
        }
      } else {
        const pid = item.product_id || parseInt(item.id);
        if (!pid) continue;
        allocationItems.push({
          order_item_id: item.id.toString(),
          product_id: pid,
          product_name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit: item.unit || 'kg',
          source: 'regular',
          price: parseFloat(item.price || 0)
        });
      }
    }
    return allocationItems;
  }, [orderData?.items]);

  // Track if data has been fetched to prevent double fetching
  const fetchedRef = useRef(null);

  // Combined data fetching with proper debouncing and duplicate prevention
  useEffect(() => {
    if (!isOpen || !memoizedOrder?.id) return;
    
    // Prevent duplicate fetches for the same order
    if (fetchedRef.current === memoizedOrder.id) return;
    
    let abort = false;
    let isLoading = false;
    
    const fetchAllData = async () => {
      if (isLoading) return;
      isLoading = true;
      setLoading(true);
      fetchedRef.current = memoizedOrder.id;
      
      try {
        // Only fetch order details if we don't have complete order data
        if (!orderData?.items?.length && memoizedOrder.id) {
          const orderRes = await fetch(`http://localhost:5000/api/orders/${memoizedOrder.id}`);
          const { success, data } = await orderRes.json();
          if (success && !abort) {
            setOrderData(data);
          }
        }
        
        // Fetch allocations
        const allocRes = await fetch(`http://localhost:5000/api/orders/${memoizedOrder.id}/allocations`);
        const { success: allocSuccess, data: allocData } = await allocRes.json();
        if (allocSuccess && Array.isArray(allocData) && !abort) {
          const grouped = {};
          allocData.forEach(a => {
            const key = a.order_item_id.toString();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(a);
          });
          setAllocations(grouped);
        }
        
        // Fetch available batches - this will run after orderData is set
        // We'll handle this in a separate effect below
        
      } catch (error) {
        console.error('Error fetching batch allocation data:', error);
        showError('Failed to load allocation data');
      } finally {
        isLoading = false;
        setLoading(false);
      }
    };
    
    // Debounce the fetch to prevent rapid calls
    const timeoutId = setTimeout(fetchAllData, 300);
    
    return () => {
      abort = true;
      clearTimeout(timeoutId);
    };
  }, [isOpen, memoizedOrder?.id]); // Removed problematic dependencies

  // Separate effect for fetching batches after we have items
  useEffect(() => {
    if (!itemsNeedingAllocation.length || !isOpen) return;
    
    let abort = false;
    
    const fetchBatches = async () => {
      try {
        const all = {};
        const pids = [...new Set(itemsNeedingAllocation.map(i => i.product_id))];
        
        // Use Promise.all for concurrent batch fetching with better error handling
        const batchPromises = pids.map(async (pid) => {
          try {
            const res = await fetch(`http://localhost:5000/api/inventory/product/${pid}/batches`);
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            const { success, data } = await res.json();
            if (success && Array.isArray(data)) {
              all[pid] = data.map(b => ({
                batch: b.batch || b.batch_id,
                totalQuantity: parseFloat(b.total_quantity || b.quantity || 0),
                unit: b.unit || 'kg'
              })).filter(b => b.batch && b.totalQuantity > 0);
            } else {
              console.warn(`No batches found for product ${pid} or invalid response`);
              all[pid] = [];
            }
          } catch (error) {
            console.error(`Error fetching batches for product ${pid}:`, error);
            all[pid] = [];
          }
        });
        
        await Promise.all(batchPromises);
        if (!abort) {
          setAvailableBatches(all);
          console.log('Batches fetched:', all); // Debug log
        }
      } catch (error) {
        console.error('Error fetching batches:', error);
      }
    };
    
    fetchBatches();
    
    return () => {
      abort = true;
    };
  }, [itemsNeedingAllocation.length, isOpen]); // Only depend on items length and dialog state

  // Reset fetchedRef when dialog closes
  useEffect(() => {
    if (!isOpen) {
      fetchedRef.current = null;
    }
  }, [isOpen]);

  const totalAllocatedForItem = useCallback(
    key => (allocations[key] || []).reduce((sum, a) => sum + parseFloat(a.quantity || 0), 0),
    [allocations]
  );

  const handleBatchSelection = useCallback(selection => {
    const totalQty = selection.allocations.reduce((s, a) => s + parseFloat(a.quantity || 0), 0);
    setAllocations(prev => ({
      ...prev,
      [selection.order_item_id]: [{
        ...selection,
        quantity: totalQty,
        batch: selection.allocations[0]?.batch || '',
        unit: selection.allocations?.unit || 'kg'
      }]
    }));
    setTimeout(() => {
      setBatchSelectionDialog({ isOpen: false, product: null, currentAllocations: [] });
    }, 200);
  }, []);

  const openBatchSelection = useCallback(product => {
    setBatchSelectionDialog({
      isOpen: true,
      product,
      currentAllocations: allocations[product.order_item_id] || []
    });
  }, [allocations]);

  const handleSave = useThrottleCallback(async () => {
    try {
      setLoading(true);
      for (const it of itemsNeedingAllocation) {
        const allocated = totalAllocatedForItem(it.order_item_id);
        if (Math.abs(allocated - it.quantity) > 0.0005) {
          showError(`Allocation mismatch for ${it.product_name}. Required ${it.quantity}, allocated ${allocated}.`);
          setLoading(false);
          return;
        }
      }
      const flat = Object.values(allocations).flat();
      const res = await fetch(`http://localhost:5000/api/orders/${memoizedOrder?.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: flat })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      showSuccess('Allocations saved');
      
      // Show loading spinner for 2 seconds before closing dialog
      setTimeout(() => {
        setLoading(false);
        onClose(true);
      }, 2000);
    } catch (e) {
      showError(e.message || 'Failed to save allocations');
      setLoading(false);
    }
  }, 1000);

  const groupedItems = useMemo(() => {
    const regular = [];
    const mixGroups = {};
    itemsNeedingAllocation.forEach(item => {
      if (item.source === 'mix') {
        const pid = item.parent_mix_id;
        if (!mixGroups[pid]) mixGroups[pid] = { type: 'mix', mix_id: pid, items: [] };
        mixGroups[pid].items.push(item);
      } else {
        regular.push(item);
      }
    });
    const groups = [];
    if (regular.length) groups.push({ type: 'regular', title: 'Regular Products', items: regular });
    Object.values(mixGroups).forEach(g => groups.push(g));
    return groups;
  }, [itemsNeedingAllocation]);

  return (
    <>
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose(false)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="space-y-3 p-6 pb-4 border-b border-gray-200">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="font-bold">Allocate Product Batches</div>
              <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700">
                {itemsNeedingAllocation.length} items
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="text-sm text-gray-500 p-6">Loading...</div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-8">
              {groupedItems.map((group, idx) => (
                <div key={idx}>
                  <div className="mb-6">
                    <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${
                      group.type === 'regular' ? 'text-blue-800' : 'text-orange-800'
                    }`}>
                      {group.type === 'regular' ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      )}
                      {group.type === 'regular' ? group.title : `Mix ${group.mix_number}`}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {group.items.map((item, i) => {
                      const itemAllocs = allocations[item.order_item_id] || [];
                      const allocated = totalAllocatedForItem(item.order_item_id);
                      const remaining = Math.max(0, item.quantity - allocated);
                      const isFully = remaining < 0.001;
                      return (
                        <div key={`${item.source}-${item.product_id}-${item.parent_mix_id}-${item.mix_component_index}`} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {group.type === 'mix' && (
                                <span className="text-orange-600 font-medium text-sm w-6">{i + 1}.</span>
                              )}
                              <div>
                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                  {item.product_name}
                                  {isFully && (
                                    <div className="flex items-center gap-1 text-green-600">
                                      <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                      </svg>
                                      <span className="text-xs font-medium">Allocated</span>
                                    </div>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Quantity: {item.quantity} {item.unit}
                                  {item.price ? ` • Price: ${formatCurrency(item.price)}/${item.unit}` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`text-sm px-3 py-1 rounded-full flex items-center gap-2 ${
                                isFully
                                  ? 'text-green-700 bg-green-100'
                                  : 'text-orange-600 bg-orange-100'
                              }`}>
                                {isFully
                                  ? (<><svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>Allocated</>)
                                  : `Remaining: ${remaining.toFixed(3)} ${item.unit}`}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openBatchSelection(item)}
                                className={`${isFully
                                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                }`}
                              >
                                {isFully ? 'Edit Batches' : 'Select Batches'}
                              </Button>
                            </div>
                          </div>
                          {itemAllocs.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <div className="text-sm font-medium text-gray-700 mb-2">Current Allocations:</div>
                              <div className="space-y-2">
                                {itemAllocs.map((alloc, idx2) => (
                                  <div key={`${alloc.batch}-${idx2}`} className="flex items-center justify-between text-sm bg-green-50 border border-green-200 p-2 rounded">
                                    <span className="font-mono text-green-700">{alloc.batch}</span>
                                    <span className="font-medium text-green-800">{alloc.quantity} {alloc.unit}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center p-6 pt-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {loading && (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading...</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onClose(false)} className="px-6">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading} className="px-6 bg-blue-600 hover:bg-blue-700">
                {loading ? (
                  <>
                    <svg className="h-4 w-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5 13l4 4L19 7" />
                    </svg>
                    Save Allocations
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {batchSelectionDialog.isOpen && (
        <BatchSelectionDialog
          isOpen
          onClose={() => setBatchSelectionDialog({ isOpen: false, product: null, currentAllocations: [] })}
          product={batchSelectionDialog.product}
          availableBatches={availableBatches[batchSelectionDialog.product.product_id] || []}
          currentAllocations={batchSelectionDialog.currentAllocations}
          onBatchSelection={handleBatchSelection}
        />
      )}
    </>
  );
}
