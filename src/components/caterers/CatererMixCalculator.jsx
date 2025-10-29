import React, { useState, useCallback, useMemo } from 'react';
import { Calculator, Plus, Minus, X, ShoppingCart, ChevronDown } from 'lucide-react';

const CatererMixCalculator = ({ onClose, products = [], onBatchSelectionComplete }) => {
  const [totalBudget, setTotalBudget] = useState('');
  const [mixName, setMixName] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [errors, setErrors] = useState({});
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Helper function to check if product is in stock
  const isProductInStock = useCallback((product) => {
    const stockLevel = Number(
      product.available_quantity ||
      product.stock ||
      product.quantity ||
      product.inventory ||
      0
    );

    const isOutOfStock = (
      product.isOutOfStock === true ||
      product.is_active === 0 ||
      product.is_active === false ||
      product.active === 0 ||
      product.active === false ||
      product.status === 'inactive' ||
      product.status === 'out_of_stock' ||
      stockLevel <= 0
    );

    return !isOutOfStock && stockLevel > 0;
  }, []);

  // Helper function to check if product has valid price
  const hasValidPrice = useCallback((product) => {
    const price = Number(product.caterer_price || product.price || 0);
    return price > 0;
  }, []);

  // Calculate mix details with equal division and last-item adjustment
  const mixCalculation = useMemo(() => {
    if (!totalBudget || selectedProducts.length === 0) {
      return null;
    }
    const budget = Number(totalBudget);

    // Get products with their prices
    const productsWithPrices = selectedProducts.map(product => ({
      ...product,
      price: Number(product.caterer_price || product.price || 0)
    })).filter(product => product.price > 0);

    if (productsWithPrices.length === 0) {
      return null;
    }

    // Calculate equal allocation, rounded down to 2 decimals for each, remainder to last
    const num = productsWithPrices.length;
    const equalShare = Math.floor((budget / num) * 100) / 100;
    let allocated = 0;

    const mixItems = productsWithPrices.map((product, idx) => {
      const isLast = idx === num - 1;
      const allocatedBudget = isLast
        ? +(budget - allocated).toFixed(2)
        : equalShare;
      allocated += allocatedBudget;

      const quantity = +((allocatedBudget / product.price).toFixed(3));
      const actualCost = allocatedBudget;

      return {
        ...product,
        allocatedBudget,
        calculatedQuantity: quantity,
        actualCost,
        unit: product.unit || 'kg'
      };
    });

    const totalCalculatedCost = mixItems.reduce((sum, item) => sum + item.actualCost, 0);

    return {
      mixItems,
      totalCalculatedCost: +totalCalculatedCost.toFixed(2),
      budgetDifference: +(budget - totalCalculatedCost).toFixed(2)
    };
  }, [totalBudget, selectedProducts]);

  // Add product to mix
  const addProductToMix = useCallback((product) => {
    if (selectedProducts.find(p => p.id === product.id)) {
      return; // Already added
    }
    setSelectedProducts(prev => [...prev, product]);
    setErrors(prev => ({ ...prev, products: null }));
    setDropdownOpen(false);
    setSearchTerm('');
  }, [selectedProducts]);

  // Remove product from mix
  const removeProductFromMix = useCallback((productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  // Validation
  const validateMix = useCallback(() => {
    const newErrors = {};
    if (!mixName || mixName.trim() === '') {
      newErrors.mixName = 'Please enter a mix name';
    }
    if (!totalBudget || parseFloat(totalBudget) <= 0) {
      newErrors.budget = 'Please enter a valid budget amount';
    }
    if (selectedProducts.length === 0) {
      newErrors.products = 'Please select at least one product';
    }
    const invalidProducts = selectedProducts.filter(p => {
      return !hasValidPrice(p) || !isProductInStock(p);
    });
    if (invalidProducts.length > 0) {
      newErrors.products = `Some selected products are no longer available or have invalid prices`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [totalBudget, selectedProducts, hasValidPrice, isProductInStock, mixName]);

  // Add mix to cart - directly adds mix to parent component
  const handleAddMixToCart = useCallback(() => {
    if (!validateMix() || !mixCalculation) return;
    
    // Generate mix data for parent component
    const mixData = {
      mixProducts: mixCalculation.mixItems.map(item => ({
        ...item,
        product_id: item.id,
        product_name: item.name,
        calculatedQuantity: item.calculatedQuantity,
        unit: item.unit || 'kg'
      })),
      mixName: mixName || 'Custom Mix',
      totalBudget: Number(totalBudget),
      mixItems: mixCalculation.mixItems
    };
    
    onBatchSelectionComplete(mixData);
    onClose();
  }, [validateMix, mixCalculation, onBatchSelectionComplete, onClose, mixName, totalBudget]);

  // Available products with enhanced filtering
  const availableProducts = useMemo(() => {
    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }
    const filtered = products.filter(product => {
      if (selectedProducts.find(p => p.id === product.id)) return false;
      if (!isProductInStock(product)) return false;
      if (!hasValidPrice(product)) return false;
      if (searchTerm && !product.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
    return filtered;
  }, [products, selectedProducts, searchTerm, isProductInStock, hasValidPrice]);

  // Filter selected products to remove any that became out of stock
  const validSelectedProducts = useMemo(() => {
    return selectedProducts.filter(product =>
      isProductInStock(product) && hasValidPrice(product)
    );
  }, [selectedProducts, isProductInStock, hasValidPrice]);

  // Keep selected products in sync with availability
  React.useEffect(() => {
    if (validSelectedProducts.length !== selectedProducts.length) {
      setSelectedProducts(validSelectedProducts);
      if (validSelectedProducts.length < selectedProducts.length) {
        setErrors(prev => ({
          ...prev,
          products: 'Some selected products became unavailable and were removed'
        }));
      }
    }
  }, [validSelectedProducts, selectedProducts]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200/50 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6 text-orange-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Mix Calculator</h2>
                <p className="text-gray-600 text-sm">Create custom spice mix packets with exact equal budget division</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100/50 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Mix Configuration */}
          <div className="grid md:grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mix Name *
              </label>
              <input
                type="text"
                value={mixName}
                onChange={(e) => setMixName(e.target.value)}
                placeholder="Enter custom mix name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white/80 backdrop-blur-sm ${errors.mixName ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.mixName && (
                <p className="text-red-500 text-xs mt-1">{errors.mixName}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Budget (₹) *
              </label>
              <input
                type="number"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                placeholder="500"
                min="1"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white/80 backdrop-blur-sm ${errors.budget ? 'border-red-300' : 'border-gray-300'
                  }`}
              />
              {errors.budget && (
                <p className="text-red-500 text-xs mt-1">{errors.budget}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Mix will cost exactly this amount
              </p>
            </div>
          </div>

          {/* Product Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add Products to Mix
            </label>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={products.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span className="text-gray-700">
                  {products.length === 0 ? 'No products available' : 'Select products to add...'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              {dropdownOpen && products.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 max-h-64 overflow-hidden">
                  {/* Search Input */}
                  <div className="p-3 border-b border-gray-200">
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  {/* Product List */}
                  <div className="max-h-48 overflow-y-auto">
                    {availableProducts.length === 0 ? (
                      <div className="p-3 text-center text-gray-500 text-sm">
                        {searchTerm ? 'No products match your search' : 'No available products'}
                      </div>
                    ) : (
                      availableProducts.map((product) => (
                        <div
                          key={product.id}
                          className="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer flex items-center justify-between"
                          onClick={() => addProductToMix(product)}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 text-sm">{product.name}</div>
                            <div className="text-xs text-gray-600">
                              ₹{Number(product.caterer_price || product.price || 0).toFixed(2)}/{product.unit || 'kg'}
                            </div>
                          </div>
                          <button
                            className="bg-orange-600 text-white px-2 py-1 rounded text-xs hover:bg-orange-700 flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              addProductToMix(product);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            Add
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selected Products */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Selected Products ({validSelectedProducts.length})
            </h3>
            {errors.products && (
              <p className="text-red-500 text-sm mb-3">{errors.products}</p>
            )}
            {validSelectedProducts.length === 0 ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50/50 backdrop-blur-sm">
                <p className="text-gray-500">No products selected yet</p>
                <p className="text-gray-400 text-sm">Use the dropdown above to select products</p>
              </div>
            ) : (
              <div className="grid gap-3 mb-4">
                {validSelectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-orange-50/80 backdrop-blur-sm border border-orange-200 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-600">
                        ₹{Number(product.caterer_price || product.price || 0).toFixed(2)}/{product.unit || 'kg'}
                      </div>
                    </div>
                    <button
                      onClick={() => removeProductFromMix(product.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100/50 transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mix Calculation Display */}
          {mixCalculation && (
            <div className="bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-3">
                {mixName || 'Custom Mix'} Calculation
              </h4>
              <div className="space-y-2">
                {mixCalculation.mixItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name}</span>
                    <span className="text-green-700 font-medium">
                      {item.calculatedQuantity} {item.unit} (₹{item.actualCost.toFixed(2)})
                    </span>
                  </div>
                ))}
                <div className="border-t border-green-300 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total Cost:</span>
                    <span className="text-green-800">₹{mixCalculation.totalCalculatedCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Budget Match:</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200/50 bg-gray-50/50 backdrop-blur-sm flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100/50 backdrop-blur-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAddMixToCart}
            disabled={!mixCalculation || validSelectedProducts.length === 0}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            Add {mixName || 'Custom Mix'} to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatererMixCalculator;