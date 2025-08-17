import React, { useState, useMemo, useCallback, memo } from 'react';
import Modal from '../../components/common/Modal';
import { Plus, Minus } from 'lucide-react';

const ProductCard = ({ product, onAddToCart, cartItem, onQuantityChange, viewMode, index }) => {
  const [showCustomInputs, setShowCustomInputs] = useState(false);
  const [customQuantity, setCustomQuantity] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [inputErrors, setInputErrors] = useState({});
  const [imageError, setImageError] = useState(false);

  const productData = useMemo(() => {
    const stockLevel = Number(
      product.available_quantity ||
      product.stock ||
      product.quantity ||
      product.inventory ||
      0
    );
    const isOutOfStock = (product.isOutOfStock === true || product.is_active === 0 || stockLevel <= 0);
    const isLowStock = stockLevel > 0 && stockLevel <= 5;

    // Use caterer_price if available and we're on caterer page, otherwise use retail_price
    const isCatererPage = window.location.pathname.includes('caterer-online');
    const retailPrice = isCatererPage
      ? Number(product.caterer_price || product.retail_price || product.retailPrice || product.price || 0)
      : Number(product.retail_price || product.retailPrice || product.price || 0);
    const marketPrice = Number(product.market_price || product.marketPrice || 0);
    const unit = product.unit || 'kg';

    // Robust image resolution
    const getImageUrl = () => {
      if (Array.isArray(product.product_images) && product.product_images.length) {
        const imagePath = product.product_images[0];
        if (!imagePath || typeof imagePath !== 'string' || !imagePath.trim()) {
          return 'https://placehold.co/300x300/f3f4f6/9ca3af?text=No+Image';
        }
        if (imagePath.startsWith('http')) return imagePath;
        if (imagePath.startsWith('/')) return `http://localhost:5000${imagePath}`;
        return `http://localhost:5000/${imagePath}`;
      }
      if (product.image) {
        if (!product.image.trim()) return 'https://placehold.co/300x300/f3f4f6/9ca3af?text=No+Image';
        if (product.image.startsWith('http')) return product.image;
        if (product.image.startsWith('/')) return `http://localhost:5000${product.image}`;
        return `http://localhost:5000/${product.image}`;
      }
      return 'https://placehold.co/300x300/f3f4f6/9ca3af?text=No+Image';
    };

    const imageUrl = getImageUrl();
    const discountPercentage =
      marketPrice > 0 && retailPrice > 0 && marketPrice > retailPrice
        ? Math.round((1 - retailPrice / marketPrice) * 100)
        : 0;

    return {
      stockLevel, isOutOfStock, isLowStock, retailPrice,
      marketPrice, unit, imageUrl, discountPercentage,
    };
  }, [product]);

  const formatCurrency = useCallback((amount) =>
    typeof amount !== 'number' || isNaN(amount)
      ? '₹0.00'
      : `₹${amount.toFixed(2)}`
  , []);

  const generateCustomId = useCallback((type) =>
    `${product.id}-${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  , [product.id]);

  const validateInputs = useCallback(() => {
    const errors = {};
    const quantity = parseFloat(customQuantity), price = parseFloat(customPrice);
    if (customQuantity && (isNaN(quantity) || quantity <= 0)) errors.quantity = 'Please enter a valid quantity';
    if (customPrice && (isNaN(price) || price <= 0)) errors.price = 'Please enter a valid price';
    if (customQuantity && quantity > productData.stockLevel) errors.quantity = `Only ${productData.stockLevel} available`;
    setInputErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customQuantity, customPrice, productData.stockLevel]);

  // Cart logic
  const handleStandardAddToCart = useCallback((e) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (productData.retailPrice > 0 && !productData.isOutOfStock) {
      onAddToCart({
        ...product, 
        price: productData.retailPrice, 
        quantity: 1, 
        isCustom: false, 
        unit: productData.unit
      });
    }
  }, [product, productData.retailPrice, productData.isOutOfStock, productData.unit, onAddToCart]);

  const handleAddCustomQuantity = useCallback((e) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (!validateInputs()) return;
    const quantity = parseFloat(customQuantity);
    if (quantity > 0 && productData.retailPrice > 0) {
      onAddToCart({
        ...product,
        id: generateCustomId('qty'),
        price: productData.retailPrice,
        quantity,
        isCustom: true,
        displayName: `${product.name} (${quantity} ${productData.unit})`,
        unit: productData.unit
      });
      setCustomQuantity(''); 
      setShowCustomInputs(false); 
      setInputErrors({});
    }
  }, [customQuantity, productData.retailPrice, productData.unit, product, onAddToCart, validateInputs, generateCustomId]);

  const handleAddCustomPrice = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!validateInputs()) return;
    const enteredPrice = parseFloat(customPrice);
    if (enteredPrice > 0 && productData.retailPrice > 0) {
      const calculatedQuantity = parseFloat((enteredPrice / productData.retailPrice).toFixed(3));
      onAddToCart({
        ...product,
        id: generateCustomId('price'),
        price: productData.retailPrice,
        quantity: calculatedQuantity,
        isCustom: true,
        displayName: `${product.name} (${calculatedQuantity} ${productData.unit} for ₹${enteredPrice})`,
        unit: productData.unit,
        originalEnteredAmount: enteredPrice,
        originalRetailPrice: productData.retailPrice
      });
      setCustomPrice('');
      setShowCustomInputs(false);
      setInputErrors({});
    }
  }, [customPrice, productData.retailPrice, productData.unit, product, onAddToCart, validateInputs, generateCustomId]);

  // Cart quantity
  const handleQuantityIncrease = useCallback((e) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (cartItem && cartItem.quantity < productData.stockLevel) {
      onQuantityChange(product.id, cartItem.quantity + 1);
    }
  }, [cartItem, productData.stockLevel, onQuantityChange, product.id]);

  const handleQuantityDecrease = useCallback((e) => {
    e.preventDefault(); 
    e.stopPropagation();
    if (cartItem) onQuantityChange(product.id, cartItem.quantity - 1);
  }, [cartItem, onQuantityChange, product.id]);

  // Image handlers
  const handleImageError = useCallback((e) => {
    setImageError(true);
    e.target.onerror = null;
    e.target.src = 'https://placehold.co/300x300/f3f4f6/9ca3af?text=No+Image';
  }, []);
  
  const handleImageLoad = useCallback(() => setImageError(false), []);

  // Open/close modal
  const openCustomInputs = useCallback(() => setShowCustomInputs(true), []);
  const closeCustomInputs = useCallback(() => {
    setShowCustomInputs(false); 
    setCustomQuantity(''); 
    setCustomPrice(''); 
    setInputErrors({});
  }, []);

  // Main render
  return (
    <div
      className={`
        product-card-hover bg-white rounded-xl shadow-md border border-gray-100 p-3 
        flex flex-col transition-all duration-500 relative 
        group
        ${showCustomInputs ? 'z-10 shadow-lg' : ''}
      `}
      style={{
        minHeight: '340px',
        width: '280px', // Fixed width instead of maxWidth
        marginBottom: '24px',
        overflow: 'visible',
      }}
    >
      {/* Product Image */}
      <div className="w-full h-32 min-h-32 max-h-32 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden relative flex-shrink-0">
        <img
          src={productData.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover transition-all duration-500"
          style={
            productData.isOutOfStock
              ? { filter: 'grayscale(1) brightness(0.7)' }
              : undefined
          }
          onError={handleImageError}
          onLoad={handleImageLoad}
          loading="lazy"
        />
        {/* Out of stock overlay */}
        {productData.isOutOfStock && (
          <div className="absolute inset-0 bg-opacity-60 flex items-center justify-center">
            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow border border-red-500">
              OUT OF STOCK
            </span>
          </div>
        )}
        {/* Low stock badge */}
        {productData.isLowStock && !productData.isOutOfStock && (
          <span className="absolute top-1 right-1 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow animate-pulse">
            Low Stock ({productData.stockLevel})
          </span>
        )}
        {/* Discount badge */}
        {productData.discountPercentage > 0 && !productData.isOutOfStock && (
          <div className="absolute top-1 left-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md">
            {productData.discountPercentage}% OFF
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1"> {/* Added flex-1 to ensure consistent spacing */}
        <div className="text-xs text-orange-600 font-semibold uppercase mt-2 mb-1 tracking-wide">
          {product.category_name || product.categoryName || ''}
        </div>
        <h3 className={`font-bold text-base mb-1 line-clamp-2 ${productData.isOutOfStock ? 'text-gray-500' : 'text-gray-900'}`}>
          {product.name}
        </h3>
        <p className={`text-xs mb-2 line-clamp-1 ${productData.isOutOfStock ? 'text-gray-400' : 'text-gray-500'}`}>
          {product.description || 'Premium quality spice for your culinary needs'}
        </p>
        <div className="flex flex-col items-start gap-1 mb-2">
          {productData.retailPrice > 0 ? (
            <span className={`text-xl font-bold ${productData.isOutOfStock ? 'text-gray-400' : 'text-orange-600'}`}>
              {formatCurrency(productData.retailPrice)}
            </span>
          ) : (
            <span className="text-sm text-gray-400 font-medium italic">Price Coming Soon</span>
          )}
          {productData.marketPrice > 0 && (
            <span className="text-xs text-gray-400 font-medium line-through">
              {formatCurrency(productData.marketPrice)}/{productData.unit}
            </span>
          )}
          <span className="text-xs text-gray-500 font-medium">per {productData.unit}</span>
        </div>
      </div>

      {/* Full-page Custom Inputs Modal */}
      <Modal isOpen={showCustomInputs} onClose={closeCustomInputs} title={`Custom Order: ${product.name}`}>
        {!productData.isOutOfStock && productData.retailPrice > 0 && (
          <div className="space-y-6 p-2">
            {/* Custom Quantity Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Enter Quantity ({productData.unit})
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customQuantity}
                  onChange={e => setCustomQuantity(e.target.value)}
                  placeholder={`Max ${productData.stockLevel}`}
                  className={`flex-1 px-2 py-1 border rounded text-sm ${inputErrors.quantity ? 'border-red-300' : 'border-gray-300'} focus:outline-none`}
                  max={productData.stockLevel}
                  min="0.001"
                  step="0.001"
                />
                <button
                  onClick={handleAddCustomQuantity}
                  disabled={!customQuantity || !!inputErrors.quantity}
                  className="px-3 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {inputErrors.quantity && (
                <p className="text-red-500 text-xs mt-1">{inputErrors.quantity}</p>
              )}
              {customQuantity && !inputErrors.quantity && (
                <p className="text-green-600 text-xs mt-1">
                  Total: {formatCurrency(parseFloat(customQuantity) * productData.retailPrice)}
                </p>
              )}
            </div>
            {/* Custom Price Input */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Enter Budget (₹)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  placeholder="Enter amount"
                  className={`flex-1 px-2 py-1 border rounded text-sm ${inputErrors.price ? 'border-red-300' : 'border-gray-300'} focus:outline-none`}
                  min="1"
                  step="1"
                />
                <button
                  onClick={handleAddCustomPrice}
                  disabled={!customPrice || !!inputErrors.price}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {inputErrors.price && (
                <p className="text-red-500 text-xs mt-1">{inputErrors.price}</p>
              )}
              {customPrice && !inputErrors.price && productData.retailPrice > 0 && (
                <p className="text-green-600 text-xs mt-1">
                  You'll get: {((parseFloat(customPrice) / productData.retailPrice).toFixed(3))} {productData.unit}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-1.5">
        {productData.isOutOfStock ? (
          <div className="space-y-1.5">
            <button
              disabled
              className="w-full py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold text-sm cursor-not-allowed border border-red-200 opacity-75"
            >
              Out of Stock
            </button>
            <button
              onClick={() => alert("We'll notify you when this item is back in stock!")}
              className="w-full py-1.5 border border-gray-300 text-gray-600 rounded-lg font-medium text-xs hover:bg-gray-50 active:bg-gray-100 focus:ring-2 focus:ring-orange-500"
            >
              Notify When Available
            </button>
          </div>
        ) : productData.retailPrice <= 0 ? (
          <button
            disabled
            className="w-full py-1.5 bg-gray-200 text-gray-500 rounded-lg font-semibold text-sm cursor-not-allowed"
          >
            Price Not Available
          </button>
        ) : (
          <>
            {cartItem && !cartItem.isCustom && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleQuantityDecrease}
                  className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg font-medium min-w-[2.5rem] text-center border border-orange-200 text-sm">
                  {cartItem.quantity}
                </span>
                <button
                  onClick={handleQuantityIncrease}
                  disabled={cartItem.quantity >= productData.stockLevel}
                  className="w-7 h-7 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 active:bg-gray-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={openCustomInputs}
              className="w-full py-1.5 border-2 border-orange-400 text-orange-700 rounded-lg hover:bg-orange-50 active:bg-orange-100 focus:ring-2 focus:ring-orange-500 text-xs flex items-center justify-center gap-1 font-semibold"
              tabIndex={0}
            >
              📋 Custom Order
            </button>
            <button
              onClick={handleStandardAddToCart}
              className="w-full py-1.5 bg-orange-600 text-white rounded-lg font-semibold flex items-center justify-center gap-1 text-sm hover:bg-orange-700"
            >
              <Plus className="h-3 w-3" />
              Add to Cart (1 {productData.unit})
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// Custom comparison function for better memoization
const areEqual = (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.available_quantity === nextProps.product.available_quantity &&
    prevProps.product.retail_price === nextProps.product.retail_price &&
    prevProps.product.is_active === nextProps.product.is_active &&
    prevProps.cartItem?.quantity === nextProps.cartItem?.quantity &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.index === nextProps.index
  );
};

// Export with memo wrapper
export default memo(ProductCard, areEqual);
