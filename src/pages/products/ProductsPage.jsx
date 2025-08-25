import { useState, useEffect, useRef } from 'react';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
  Squares2X2Icon,
  TagIcon,
  ArrowPathIcon,
  PrinterIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import Modal from '../../components/common/Modal';
import SafetyDialog from '../../components/common/SafetyDialog';
import { useToast } from '../../contexts/ToastContext';
import { useSafety } from '../../contexts/SafetyContext';
import ViewProductDialog from './ViewProductDialog';

const ProductsPage = () => {
  const { showSuccess, showError } = useToast();
  const { requiresSafetyCheck, safetyPassword } = useSafety();
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  const [showAddProductDialog, setShowAddProductDialog] = useState(false);
  const [showViewProductDialog, setShowViewProductDialog] = useState(false);
  const [showEditProductDialog, setShowEditProductDialog] = useState(false);
  const [showPriceUpdateDialog, setShowPriceUpdateDialog] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [priceEditData, setPriceEditData] = useState({ product: null, priceType: null });
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cost visibility state
  const [showCosts, setShowCosts] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Ref for search input
  const searchInputRef = useRef(null);

  // Password verification for cost visibility
  const handleCostVisibilityToggle = () => {
    if (showCosts) {
      setShowCosts(false);
    } else {
      setPasswordInput(''); // Clear any existing password
      setShowPasswordModal(true);
    }
  };

  const verifyPassword = () => {
    if (passwordInput === safetyPassword) { // Use the current safety password
      setShowCosts(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      showSuccess('Cost information is now visible');

      // Prevent focus from going to search field and clear any password text
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.blur();
          // Clear search if it contains the password
          if (searchTerm === passwordInput) {
            setSearchTerm('');
          }
        }
      }, 100);
    } else {
      showError('Incorrect password');
      setPasswordInput('');
    }
  };

  // Helper function to safely parse product images
  const getProductImages = (product) => {
    try {
      if (!product.product_images) return [];
      if (typeof product.product_images === 'string') {
        // Handle malformed JSON strings
        const cleanedString = product.product_images.trim();
        if (cleanedString.startsWith('[') && cleanedString.endsWith(']')) {
          return JSON.parse(cleanedString);
        } else if (cleanedString.startsWith('/api/')) {
          // Single image URL as string
          return [cleanedString];
        }
        return [];
      }
      if (Array.isArray(product.product_images)) {
        return product.product_images;
      }
      return [];
    } catch (error) {
      console.error('Error parsing product images:', error);
      console.error('Product images value:', product.product_images);
      return [];
    }
  };

  // Filter products based on search term
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // API functions
  const fetchCategories = async () => {
    try {
      setLoading(true);
      console.log('Fetching categories from: http://localhost:5000/api/products/categories');

      const response = await fetch('http://localhost:5000/api/products/categories');
      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        setCategories(data.data);
      } else {
        showError(data.message || 'Failed to fetch categories');
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      showError('Failed to connect to server. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (categoryData) => {
    try {
      setLoading(true);
      console.log('Creating category:', categoryData);

      const response = await fetch('http://localhost:5000/api/products/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: categoryData.name,
          subCategory: categoryData.subCategory,
          description: categoryData.description
        }),
      });

      console.log('Create response status:', response.status);

      const data = await response.json();
      console.log('Create response data:', data);

      if (response.ok && data.success) {
        // Add the new category to the existing list
        setCategories(prevCategories => [data.data, ...prevCategories]);
        setShowAddCategoryDialog(false);
        showSuccess('Category created successfully!');
      } else {
        // Handle specific error messages from server
        const errorMessage = data.message || `Server error: ${response.status}`;
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error creating category:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showError('Cannot connect to server. Please check if the server is running on port 5000.');
      } else {
        showError('Failed to create category. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // API functions for products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products from: http://localhost:5000/api/products');

      // Fetch products and cost data in parallel
      const [productsResponse, costsResponse] = await Promise.all([
        fetch('http://localhost:5000/api/products'),
        fetch('http://localhost:5000/api/inventory/average-costs')
      ]);

      console.log('Products response status:', productsResponse.status);
      console.log('Costs response status:', costsResponse.status);

      if (!productsResponse.ok) {
        throw new Error(`HTTP error! status: ${productsResponse.status}`);
      }

      const productsData = await productsResponse.json();
      console.log('Products response data:', productsData);

      let costsData = { success: false, data: [] };
      if (costsResponse.ok) {
        costsData = await costsResponse.json();
        console.log('Costs data:', costsData);
      }

      if (productsData.success) {
        let products = productsData.data || [];

        // Merge cost data with products if available
        if (costsData.success && costsData.data.length > 0) {
          const costMap = new Map();
          costsData.data.forEach(cost => {
            costMap.set(cost.product_id, cost.average_cost_per_kg);
          });

          products = products.map(product => ({
            ...product,
            average_cost_per_kg: costMap.get(product.id) || null
          }));
        }

        setProducts(products);
      } else {
        showError(productsData.message || 'Failed to fetch products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      showError('Failed to connect to server. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (productData) => {
    try {
      setLoading(true);
      console.log('Creating product:', productData);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('name', productData.name);
      formData.append('categoryId', productData.categoryId);
      formData.append('subCategory', productData.subCategory || '');
      formData.append('unit', productData.unit);
      formData.append('marketPrice', productData.marketPrice || '');
      formData.append('retailPrice', productData.retailPrice || '');
      formData.append('catererPrice', productData.catererPrice || '');
      formData.append('description', productData.description || '');
      formData.append('isActive', productData.isActive ? '1' : '0');

      // Append image files
      productData.productImages.forEach((file) => {
        formData.append('productImages', file);
      });

      const response = await fetch('http://localhost:5000/api/products', {
        method: 'POST',
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      });

      console.log('Create product response status:', response.status);

      const data = await response.json();
      console.log('Create product response data:', data);

      if (response.ok && data.success) {
        // Add the new product to the existing list
        setProducts(prevProducts => [data.data, ...prevProducts]);
        setShowAddProductDialog(false);
        showSuccess('Product created successfully!');
      } else {
        // Handle specific error messages from server
        const errorMessage = data.message || `Server error: ${response.status}`;
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error creating product:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        showError('Cannot connect to server. Please check if the server is running on port 5000.');
      } else {
        showError('Failed to create product. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Safety mechanism handlers
  const checkSafetyAndProceed = (action, product = null, actionType = 'perform this action') => {
    if (requiresSafetyCheck(actionType)) {
      setSelectedProduct(product);
      setPendingAction({
        type: actionType,
        callback: action,
        itemName: product ? product.name : ''
      });
      setShowSafetyDialog(true);
      return false;
    }

    // If safety check not required, proceed immediately
    action();
    return true;
  };

  const handleSafetyConfirm = () => {
    setShowSafetyDialog(false);
    if (pendingAction && pendingAction.callback) {
      pendingAction.callback();
    }
    setPendingAction(null);
  };

  // Product action handlers
  const handleViewProduct = (product) => {
    // View doesn't need safety check
    setSelectedProduct(product);
    setShowViewProductDialog(true);
  };

  const handleEditProduct = (product) => {
    checkSafetyAndProceed(
      () => {
        setSelectedProduct(product);
        setShowEditProductDialog(true);
      },
      product,
      'edit'
    );
  };

  const handleDeleteProduct = (product) => {
    
    if (window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      // Then check safety mechanism
      checkSafetyAndProceed(
        async () => {
          try {
            setLoading(true);
            const response = await fetch(`http://localhost:5000/api/products/${product.id}`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
              showSuccess('Product deleted successfully');
              fetchProducts(); // Refresh the products list
            } else {
              showError(data.message || 'Failed to delete product');
            }
          } catch (error) {
            console.error('Error deleting product:', error);
            showError('Failed to delete product. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        product,
        'delete'
      );
    }
  };

  // Price editing handlers
  const handleEditPrice = (product, priceType) => {
    checkSafetyAndProceed(
      () => {
        setPriceEditData({ product, priceType });
        setShowPriceUpdateDialog(true);
      },
      product,
      'edit'
    );
  };

  const handleUpdatePrice = async (productId, priceType, newPrice) => {
    try {
      setLoading(true);

      // Find the product to get current data
      const product = products.find(p => p.id === productId);
      if (!product) {
        showError('Product not found');
        return;
      }

      // Create FormData for the update - preserving all existing data including images
      const formData = new FormData();
      formData.append('name', product.name);
      formData.append('categoryId', product.category_id);
      formData.append('subCategory', product.sub_category || '');
      formData.append('unit', product.unit);
      formData.append('description', product.description || '');
      formData.append('isActive', product.is_active);

      // Update only the specific price field, preserve others
      formData.append('marketPrice', priceType === 'marketPrice' ? newPrice : (product.market_price || ''));
      formData.append('retailPrice', priceType === 'retailPrice' ? newPrice : (product.retail_price || ''));
      formData.append('catererPrice', priceType === 'catererPrice' ? newPrice : (product.caterer_price || ''));

      // Important: Don't append any productImages to FormData when just updating price
      // This tells the backend to keep existing images unchanged

      const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        const priceTypeLabels = {
          marketPrice: 'Market Price',
          retailPrice: 'Retail Price',
          catererPrice: 'Caterer Price'
        };
        showSuccess(`${priceTypeLabels[priceType]} updated successfully`);
        setShowPriceUpdateDialog(false);
        setPriceEditData({ product: null, priceType: null });
        fetchProducts(); // Refresh the products list
      } else {
        showError(data.message || 'Failed to update price');
      }
    } catch (error) {
      console.error('Error updating price:', error);
      showError('Failed to update price. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (productData) => {
    try {
      setLoading(true);

      // Check if data has actually changed
      const hasChanges = (
        productData.name !== selectedProduct.name ||
        productData.categoryId !== selectedProduct.category_id ||
        productData.subCategory !== selectedProduct.sub_category ||
        productData.unit !== selectedProduct.unit ||
        productData.marketPrice !== selectedProduct.market_price ||
        productData.retailPrice !== selectedProduct.retail_price ||
        productData.catererPrice !== selectedProduct.caterer_price ||
        productData.description !== selectedProduct.description ||
        productData.isActive !== selectedProduct.is_active ||
        productData.productImages.length > 0 // New images uploaded
      );

      if (!hasChanges) {
        showError('No changes detected. Please modify the product data before updating.');
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('name', productData.name);
      formData.append('categoryId', productData.categoryId);
      formData.append('subCategory', productData.subCategory || '');
      formData.append('unit', productData.unit);
      formData.append('marketPrice', productData.marketPrice || '');
      formData.append('retailPrice', productData.retailPrice || '');
      formData.append('catererPrice', productData.catererPrice || '');
      formData.append('description', productData.description || '');
      formData.append('isActive', productData.isActive ? '1' : '0');

      // Append image files if any
      productData.productImages.forEach((file) => {
        formData.append('productImages', file);
      });

      const response = await fetch(`http://localhost:5000/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        showSuccess('Product updated successfully');
        setShowEditProductDialog(false);
        setSelectedProduct(null);
        fetchProducts(); // Refresh the products list
      } else {
        showError(data.message || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      showError('Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories and products on component mount
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  // Clear password input when modal opens to prevent autofill
  useEffect(() => {
    if (showPasswordModal) {
      setPasswordInput('');
      // Small delay to ensure the input is cleared after autofill attempts
      setTimeout(() => {
        setPasswordInput('');
      }, 100);
    }
  }, [showPasswordModal]);

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

  // Price Update Dialog Component
  const PriceUpdateDialog = ({ product, priceType, onSave, onClose }) => {
    const priceTypeLabels = {
      marketPrice: 'Market Price',
      retailPrice: 'Retail Price',
      catererPrice: 'Caterer Price'
    };

    const currentPrice = product[priceType === 'marketPrice' ? 'market_price' :
                               priceType === 'retailPrice' ? 'retail_price' :
                               'caterer_price'] || 0;

    const [price, setPrice] = useState(currentPrice.toString());

    const handleQuickAdjustment = (amount) => {
      const currentValue = parseFloat(price) || 0;
      const newValue = Math.max(0, currentValue + amount);
      setPrice(newValue.toString());
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      const numericPrice = parseFloat(price);
      if (!isNaN(numericPrice) && numericPrice >= 0) {
        onSave(product.id, priceType, numericPrice);
      }
    };

    const resetToCurrentPrice = () => {
      setPrice(currentPrice.toString());
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Update {priceTypeLabels[priceType]} for {product.name}
          </h3>
          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 mr-2">
              {priceTypeLabels[priceType]} (₹ per {product.unit})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Quick Adjustments</p>
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={() => handleQuickAdjustment(1)}
              className="px-3 py-2 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100"
            >
              +₹1
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdjustment(5)}
              className="px-3 py-2 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100"
            >
              +₹5
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdjustment(10)}
              className="px-3 py-2 bg-green-50 text-green-700 rounded border border-green-200 hover:bg-green-100"
            >
              +₹10
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdjustment(-10)}
              className="px-3 py-2 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100"
            >
              -₹10
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdjustment(-20)}
              className="px-3 py-2 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100"
            >
              -₹20
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-gray-600">
            Current price: ₹{currentPrice} per {product.unit}
          </div>
          <button
            type="button"
            onClick={resetToCurrentPrice}
            className="text-sm text-orange-600 hover:text-orange-700"
          >
            Reset to Current
          </button>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
          >
            Update Price
          </button>
        </div>
      </form>
    );
  };

  const AddCategoryForm = ({ onSave, onClose }) => {
    const [formData, setFormData] = useState({
      name: '',
      subCategory: '',
      description: ''
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      if (formData.name.trim()) {
        onSave(formData);
        setFormData({ name: '', subCategory: '', description: '' });
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter category name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sub Category Name
          </label>
          <input
            type="text"
            value={formData.subCategory}
            onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter sub category name (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Enter category description (optional)"
            rows="3"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
          >
            Save Category
          </button>
        </div>
      </form>
    );
  };

  const AddProductForm = ({ onSave, onClose, editMode = false, productData = null, categories = [] }) => {
    const [formData, setFormData] = useState(() => {
      if (editMode && productData) {
        return {
          name: productData.name || '',
          categoryId: productData.category_id || '',
          subCategory: productData.sub_category || '',
          unit: productData.unit || 'kg',
          marketPrice: productData.market_price || '',
          retailPrice: productData.retail_price || '',
          catererPrice: productData.caterer_price || '',
          description: productData.description || '',
          productImages: [],
          isActive: productData.is_active !== undefined ? productData.is_active : true
        };
      }
      return {
        name: '',
        categoryId: '',
        subCategory: '',
        unit: 'kg',
        marketPrice: '',
        retailPrice: '',
        catererPrice: '',
        description: '',
        productImages: [],
        isActive: true
      };
    });

    const handleSubmit = (e) => {
      e.preventDefault();
      // For edit mode, images are optional. For create mode, images are required.
      const isValid = formData.name.trim() && formData.categoryId && (editMode || formData.productImages.length > 0);

      if (isValid) {
        onSave({
          ...formData,
          marketPrice: formData.marketPrice ? parseFloat(formData.marketPrice) : null,
          retailPrice: formData.retailPrice ? parseFloat(formData.retailPrice) : null,
          catererPrice: formData.catererPrice ? parseFloat(formData.catererPrice) : null,
        });

        // Only reset form if not in edit mode
        if (!editMode) {
          setFormData({
            name: '',
            categoryId: '',
            subCategory: '',
            unit: 'kg',
            marketPrice: '',
            retailPrice: '',
            catererPrice: '',
            description: '',
            productImages: [],
            isActive: true
          });
        }
      }
    };

    const handleImageUpload = (e) => {
      const files = Array.from(e.target.files);
      setFormData({ ...formData, productImages: [...formData.productImages, ...files] });
    };

    const removeImage = (index) => {
      const newImages = formData.productImages.filter((_, i) => i !== index);
      setFormData({ ...formData, productImages: newImages });
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter product name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sub Category
              </label>
              <input
                type="text"
                value={formData.subCategory}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter sub category (optional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="gram">Gram (g)</option>
                <option value="pound">Pound (lb)</option>
                <option value="box">Box</option>
                <option value="pack">Pack</option>
                <option value="litre">Litre (L)</option>
                <option value="bottle">Bottle</option>
                <option value="cane">Cane</option>
                <option value="packet">Packet</option>
                <option value="pouch">Pouch</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                Active Status
              </label>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Information</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Market Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.marketPrice}
                onChange={(e) => setFormData({ ...formData, marketPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Not set if empty"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Retail Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.retailPrice}
                onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Not set if empty"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Caterer Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.catererPrice}
                onChange={(e) => setFormData({ ...formData, catererPrice: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Not set if empty"
              />
            </div>
          </div>
        </div>

        {/* Description and Images Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter product description (optional)"
                rows="4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Images {!editMode && <span className="text-red-500">*</span>}
              </label>

              {/* Show existing images in edit mode */}
              {editMode && productData && (() => {
                const existingImages = getProductImages(productData);
                return existingImages.length > 0 && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-600 mb-2">Current Images:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {existingImages.map((imageUrl, index) => (
                        <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={`http://localhost:5000${imageUrl}`}
                            alt={`Current ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgMTAwTDEwMCAxMDBaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOUNBM0FGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPHN2Zz4K';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {formData.productImages.length > 0 && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {formData.productImages.map((image, index) => (
                    <div key={index} className="flex items-center justify-between bg-white px-2 py-1 rounded border">
                      <span className="text-sm text-gray-600 truncate">{image.name}</span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="text-red-500 hover:text-red-700 text-sm ml-2 flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                {editMode
                  ? 'Upload new images to replace existing ones (max 5MB each, 10 files max)'
                  : 'Upload multiple images (max 5MB each, 10 files max)'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 transition-colors"
          >
            {editMode ? 'Update Product' : 'Save Product'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
            <p className="text-gray-600 text-sm">Manage your product catalog and categories</p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
              <PrinterIcon className="h-4 w-4 mr-2" />
              Print Catalogue
            </button>
            <button
              onClick={() => {
                if (activeTab === 'categories') {
                  checkSafetyAndProceed(
                    () => setShowAddCategoryDialog(true),
                    null,
                    'add'
                  );
                } else {
                  checkSafetyAndProceed(
                    () => setShowAddProductDialog(true),
                    null,
                    'add'
                  );
                }
              }}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              {activeTab === 'categories' ? 'Add Category' : 'Add Product'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center space-x-1 mb-6">
          <TabButton
            id="list"
            label="Product List"
            icon={ListBulletIcon}
            isActive={activeTab === 'list'}
            onClick={setActiveTab}
          />
          <TabButton
            id="grid"
            label="Grid View"
            icon={Squares2X2Icon}
            isActive={activeTab === 'grid'}
            onClick={setActiveTab}
          />
          <TabButton
            id="categories"
            label="Categories"
            icon={TagIcon}
            isActive={activeTab === 'categories'}
            onClick={setActiveTab}
          />
        </div>

        {/* Products Section */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-lg shadow">
            {/* Products Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Products</h2>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCostVisibilityToggle}
                    className={`flex items-center text-sm px-3 py-1 rounded-md transition-colors ${
                      showCosts
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <EyeIcon className="h-4 w-4 mr-1" />
                    {showCosts ? 'Hide Costs' : 'Show Costs'}
                  </button>
                  <button className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Products Table */}
            <div className="w-full">
              <table className="w-full divide-y divide-gray-200 table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[20%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Status
                    </th>
                    <th className="w-[6%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Market ₹
                    </th>
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Retail ₹
                    </th>
                    {showCosts && (
                      <th className="w-[10%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Cost ₹
                      </th>
                    )}
                    <th className="w-[12%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Caterer ₹
                    </th>
                    <th className="w-[8%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="w-[8%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading products...</p>
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-8 text-center">
                        <div className="text-gray-500">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
                          <p className="text-gray-600">
                            {searchTerm ? 'No products match your search criteria.' : 'Create your first product to get started.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="w-[25%] px-3 py-3">
                          <div className="flex items-center">
                            <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center mr-2 overflow-hidden flex-shrink-0">
                              {(() => {
                                const images = getProductImages(product);
                                return images.length > 0 ? (
                                  <img
                                    src={`http://localhost:5000${images[0]}`}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm">📦</span>
                                );
                              })()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">{product.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {product.sub_category || 'No subcategory'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="w-[10%] px-3 py-3 text-sm text-gray-900">
                          <div className="truncate">{product.category_name || 'N/A'}</div>
                        </td>
                        <td className="w-[12%] px-3 py-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-semibold ${
                              parseFloat(product.available_quantity || 0) <= 0 ? 'text-red-600' :
                              parseFloat(product.available_quantity || 0) < 5 ? 'text-red-600' :
                              parseFloat(product.available_quantity || 0) < 10 ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {parseFloat(product.available_quantity || 0).toFixed(1)}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              parseFloat(product.available_quantity || 0) <= 0 ? 'bg-red-100 text-red-800' :
                              parseFloat(product.available_quantity || 0) < 5 ? 'bg-red-100 text-red-800' :
                              parseFloat(product.available_quantity || 0) < 10 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {parseFloat(product.available_quantity || 0) <= 0 ? 'Empty' :
                               parseFloat(product.available_quantity || 0) < 5 ? 'Critical' :
                               parseFloat(product.available_quantity || 0) < 10 ? 'Low' :
                               'Stock'}
                            </span>
                          </div>
                        </td>
                        <td className="w-[6%] px-3 py-3 text-sm text-gray-900">
                          {product.unit}
                        </td>
                        <td className="w-[12%] px-3 py-3 text-sm text-gray-900">
                          <div className="flex items-center">
                            <span className="font-medium">{product.market_price ? `₹${Math.round(product.market_price)}` : '-'}</span>
                            <button
                              onClick={() => handleEditPrice(product, 'marketPrice')}
                              className="text-gray-400 hover:text-orange-600 ml-1"
                              title="Edit Market Price"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="w-[12%] px-2 py-2 text-sm text-gray-900">
                          <div className="flex items-center ml-1">
                            <span className="font-medium">{product.retail_price ? `₹${Math.round(product.retail_price)}` : '-'}</span>
                            <button
                              onClick={() => handleEditPrice(product, 'retailPrice')}
                              className="text-gray-400 hover:text-orange-600"
                              title="Edit Retail Price"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        {showCosts && (
                          <td className="w-[10%] px-3 py-3 text-sm text-gray-900">
                            <div className="text-center">
                              <span className="text-blue-600 font-medium">
                                {product.average_cost_per_kg ? `₹${parseFloat(product.average_cost_per_kg).toFixed(2)}` : '-'}
                              </span>
                              {product.average_cost_per_kg && (
                                <div className="text-xs text-gray-500">per kg</div>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="w-[12%] px-3 py-3 text-sm text-gray-900">
                          <div className="flex items-center ml-1">
                            <span className="font-medium">{product.caterer_price ? `₹${Math.round(product.caterer_price)}` : '-'}</span>
                            <button
                              onClick={() => handleEditPrice(product, 'catererPrice')}
                              className="text-gray-400 hover:text-orange-600"
                              title="Edit Caterer Price"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="w-[6%] px-3 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            product.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="w-[5%] px-3 py-3 text-sm font-medium">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleViewProduct(product)}
                              className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md hover:bg-blue-50 transition-colors"
                              title="View Details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="text-gray-400 hover:text-orange-600 p-1.5 rounded-md hover:bg-orange-50 transition-colors"
                              title="Edit Product"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product)}
                              className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete Product"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid View */}
        {activeTab === 'grid' && (
          <div className="bg-white rounded-lg shadow">
            {/* Grid Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Products Grid</h2>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Grid Content */}
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center">
                <Squares2X2Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'No products match your search criteria.' : 'Create your first product to get started.'}
                </p>
              </div>
            ) : (
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => {
                    const images = getProductImages(product);
                    return (
                      <div key={product.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200">
                        {/* Product Image */}
                        <div className="aspect-w-1 aspect-h-1 w-full h-48 bg-gray-200 overflow-hidden">
                          {images.length > 0 ? (
                            <img
                              src={`http://localhost:5000${images[0]}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgMTAwTDEwMCAxMDBaIiBzdHJva2U9IiM5Q0EzQUYiIHN0cm9rZS13aWR0aD0iMiIvPgo8dGV4dCB4PSIxMDAiIHk9IjEwNSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOUNBM0FGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5ObyBJbWFnZTwvdGV4dD4KPHN2Zz4K';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <span className="text-4xl">📦</span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-gray-900 truncate">{product.name}</h3>
                              <p className="text-xs text-gray-500 mt-1">{product.category_name || 'N/A'}</p>
                              {product.sub_category && (
                                <p className="text-xs text-orange-600 font-medium">Sub: {product.sub_category}</p>
                              )}
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>

                          {/* Pricing */}
                          <div className="mt-3 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Market:</span>
                              <span className="font-medium">{product.market_price ? `₹${product.market_price}` : 'Not set'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Retail:</span>
                              <span className="font-medium">{product.retail_price ? `₹${product.retail_price}` : 'Not set'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Caterer:</span>
                              <span className="font-medium">{product.caterer_price ? `₹${product.caterer_price}` : 'Not set'}</span>
                            </div>
                          </div>

                          {/* Unit */}
                          <div className="mt-2">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                              {product.unit}
                            </span>
                          </div>

                          {/* Description */}
                          {product.description && (
                            <p className="text-xs text-gray-600 mt-2 line-clamp-2">{product.description}</p>
                          )}

                          {/* Actions */}
                          <div className="mt-4 flex justify-end">
                            <div className="relative group">
                              <button className="text-gray-400 hover:text-gray-600 p-1">
                                <EllipsisHorizontalIcon className="h-5 w-5" />
                              </button>
                              <div className="absolute right-0 bottom-8 w-48 bg-white rounded-md shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleViewProduct(product)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <EyeIcon className="h-4 w-4 mr-3" />
                                    View Details
                                  </button>
                                  <button
                                    onClick={() => handleEditProduct(product)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    <PencilIcon className="h-4 w-4 mr-3" />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(product)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <TrashIcon className="h-4 w-4 mr-3" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Categories Section */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-lg shadow">
            {/* Categories Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Product Categories</h2>
                <button
                  onClick={() => setShowAddCategoryDialog(true)}
                  className="flex items-center text-sm text-orange-600 hover:text-orange-700"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Category
                </button>
              </div>
            </div>

            {/* Categories List */}
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center">
                <TagIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Categories Found</h3>
                <p className="text-gray-600">Create your first category to organize your products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                {categories.map((category) => (
                  <div key={category.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center mr-3">
                            <TagIcon className="h-4 w-4 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{category.name}</h3>
                            {category.sub_category && (
                              <p className="text-xs text-orange-600 font-medium">Sub: {category.sub_category}</p>
                            )}
                          </div>
                        </div>
                        {category.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{category.description}</p>
                        )}
                        <div className="mt-3 text-xs text-gray-400">
                          Created: {new Date(category.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                          title="Edit category"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                          title="More options"
                        >
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={showAddCategoryDialog}
        onClose={() => setShowAddCategoryDialog(false)}
        title="Add New Category"
        maxWidth="max-w-md"
      >
        <AddCategoryForm
          onSave={handleAddCategory}
          onClose={() => setShowAddCategoryDialog(false)}
        />
      </Modal>

      {/* Add Product Modal */}
      <Modal
        isOpen={showAddProductDialog}
        onClose={() => setShowAddProductDialog(false)}
        title="Add New Product"
        maxWidth="max-w-6xl"
      >
        <AddProductForm
          categories={categories}
          onSave={handleAddProduct}
          onClose={() => setShowAddProductDialog(false)}
        />
      </Modal>

      {/* View Product Dialog */}
      <Modal
        isOpen={showViewProductDialog}
        onClose={() => setShowViewProductDialog(false)}
        title="Product Details"
        maxWidth="max-w-4xl"
      >
        <ViewProductDialog
          product={selectedProduct}
          categories={categories}
          onClose={() => setShowViewProductDialog(false)}
        />
      </Modal>

      {/* Edit Product Dialog */}
      <Modal
        isOpen={showEditProductDialog}
        onClose={() => setShowEditProductDialog(false)}
        title="Edit Product"
        maxWidth="max-w-6xl"
      >
        <AddProductForm
          categories={categories}
          onSave={handleUpdateProduct}
          onClose={() => setShowEditProductDialog(false)}
          editMode={true}
          productData={selectedProduct}
        />
      </Modal>

      {/* Price Update Dialog */}
      <Modal
        isOpen={showPriceUpdateDialog}
        onClose={() => setShowPriceUpdateDialog(false)}
        title={priceEditData.priceType === 'marketPrice' ? 'Update Market Price' :
               priceEditData.priceType === 'retailPrice' ? 'Update Retail Price' :
               'Update Caterer Price'}
        maxWidth="max-w-md"
      >
        {priceEditData.product && (
          <PriceUpdateDialog
            product={priceEditData.product}
            priceType={priceEditData.priceType}
            onSave={handleUpdatePrice}
            onClose={() => setShowPriceUpdateDialog(false)}
          />
        )}
      </Modal>

      {/* Password Modal for Cost Visibility */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordInput('');
        }}
        title="Enter Password to View Costs"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the admin password to view cost information.
          </p>
          <input
            type="password"
            id="cost-visibility-password"
            name="cost-visibility-password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
            placeholder="Enter password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-form-type="other"
            data-lpignore="true"
            autoFocus
          />
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setPasswordInput('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={verifyPassword}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
            >
              Verify
            </button>
          </div>
        </div>
      </Modal>

      {/* Safety Verification Dialog */}
      <SafetyDialog
        isOpen={showSafetyDialog}
        onClose={() => setShowSafetyDialog(false)}
        onConfirm={handleSafetyConfirm}
        operation={pendingAction?.type || 'perform this action'}
        itemName={pendingAction?.itemName || ''}
      />
    </div>
  );
};

export default ProductsPage;
