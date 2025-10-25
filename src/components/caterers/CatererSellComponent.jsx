import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { catererService, productService, catererSalesService, cacheService } from '../../services/apiService';
import CatererBatchSelectionDialog from './CatererBatchSelectionDialog';
import CatererMixCalculator from './CatererMixCalculator';
import MixProductSelectionDialog from './MixProductSelectionDialog';
import CatererBillActionDialog from './CatererBillActionDialog';
import {
  ArrowLeftIcon,
  PlusIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  CalendarIcon,
  CurrencyRupeeIcon,
  PhotoIcon,
  TrashIcon,
  UserIcon,
  CalculatorIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';

const CatererSellComponent = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { catererId } = useParams();

  const [caterers, setCaterers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [billNumber, setBillNumber] = useState('#0001');

  // Sell form state
  const [sellData, setSellData] = useState({
    caterer_id: '',
    caterer_name: '',
    sell_date: new Date().toISOString().split('T')[0],
    items: [],
    other_charges: [],
    payment_option: 'full',
    custom_amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    receipt_image: null
  });

  // Current other charge being added
  const [currentCharge, setCurrentCharge] = useState({
    name: '',
    type: 'fixed', // 'fixed', 'percentage', or 'discount'
    value: '',
    value_type: 'fixed' // for discount: 'fixed' or 'percentage'
  });

  // Current item being added
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    product_name: '',
    quantity: '',
    unit: 'kg',
    rate: '',
    gst: '0'
  });

  // Batch selection dialog state
  const [batchSelectionDialog, setBatchSelectionDialog] = useState({
    isOpen: false,
    product: null,
    availableBatches: []
  });

  // Mix calculator dialog state
  const [mixCalculatorDialog, setMixCalculatorDialog] = useState({
    isOpen: false
  });

  // Mix batch selection dialog state
  const [mixBatchSelectionDialog, setMixBatchSelectionDialog] = useState({
    isOpen: false,
    mixProducts: [],
    mixName: '',
    totalBudget: 0
  });

  // Mix product selection dialog state
  const [mixProductSelectionDialog, setMixProductSelectionDialog] = useState({
    isOpen: false,
    mixProducts: [],
    mixName: '',
    totalBudget: 0
  });

  // Bill action dialog state
  const [billActionDialog, setBillActionDialog] = useState({
    isOpen: false
  });

  const [receiptPreview, setReceiptPreview] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch caterers using cached API service
        const caterersData = await catererService.getCaterers();
        if (caterersData.success) {
          setCaterers(caterersData.caterers || []);
        } else {
          console.error('Failed to fetch caterers:', caterersData.message);
          setCaterers([]);
        }

        // Fetch products using cached API service
        const productsData = await productService.getProducts();

        if (productsData.success) {
          setProducts(productsData.data || []);
        } else {
          console.error('Failed to fetch products:', productsData.message);
          setProducts([]);
        }

        // Get next bill number using direct fetch (fallback if API service fails)
        try {
          const billResponse = await fetch('http://localhost:5000/api/caterer-sales/next-bill-number');
          if (billResponse.ok) {
            const billData = await billResponse.json();
            if (billData.success) {
              setBillNumber(billData.bill_number);
            } else {
              setBillNumber('#0001');
            }
          } else {
            setBillNumber('#0001');
          }
        } catch (billError) {
          console.warn('Could not fetch next bill number, using default:', billError);
          setBillNumber('#0001');
        }

        // If catererId is provided, pre-fill caterer details
        if (catererId) {
          const selectedCaterer = caterersData.caterers?.find(c => c.id === parseInt(catererId));
          if (selectedCaterer) {
            setSellData(prev => ({
              ...prev,
              caterer_id: catererId,
              caterer_name: selectedCaterer.caterer_name
            }));
          }
        }

      } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to load data');
        setCaterers([]);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [catererId]);

  const unitOptions = [
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'gram', label: 'Gram (g)' },
    { value: 'pound', label: 'Pound (lb)' },
    { value: 'pack', label: 'Pack' },
    { value: 'litre', label: 'Litre (L)' },
    { value: 'box', label: 'Box' },
    { value: 'bottle', label: 'Bottle' },
    { value: 'cane', label: 'Cane' },
    { value: 'packet', label: 'Packet' },
    { value: 'pouch', label: 'Pouch' },
    { value: 'bag', label: 'Bag' }
  ];

  const paymentOptions = [
    { value: 'full', label: 'Full Payment' },
    { value: 'half', label: 'Half Payment' },
    { value: 'custom', label: 'Custom Amount' },
    { value: 'later', label: 'Pay Later' }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank', label: 'Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'other', label: 'Other' }
  ];

  const handleCatererChange = (e) => {
    const catererId = e.target.value;
    const selectedCaterer = caterers.find(c => c.id === parseInt(catererId));

    setSellData(prev => ({
      ...prev,
      caterer_id: catererId,
      caterer_name: selectedCaterer ? selectedCaterer.caterer_name : ''
    }));
  };

  const handleCurrentItemChange = (e) => {
    const { name, value } = e.target;

    if (name === 'product_id') {
      const selectedProduct = products.find(p => p.id === parseInt(value));

      setCurrentItem(prev => ({
        ...prev,
        product_id: value,
        product_name: selectedProduct ? selectedProduct.name : '',
        rate: selectedProduct ? (selectedProduct.caterer_price).toString() : '',
        gst: selectedProduct ? (selectedProduct.gst || 0).toString() : '0',
        unit: selectedProduct ? (selectedProduct.unit || 'kg') : 'kg'
      }));
    } else {
      setCurrentItem(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleCurrentChargeChange = (e) => {
    const { name, value } = e.target;
    
    // When type changes to discount, set default value_type to percentage
    if (name === 'type' && value === 'discount') {
      setCurrentCharge(prev => ({
        ...prev,
        [name]: value,
        value_type: 'percentage'
      }));
    } else {
      setCurrentCharge(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSellDataChange = (e) => {
    const { name, value } = e.target;
    setSellData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleReceiptImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Image size should be less than 5MB');
        return;
      }

      setSellData(prev => ({ ...prev, receipt_image: file }));

      const reader = new FileReader();
      reader.onload = (e) => setReceiptPreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const openBatchSelection = async () => {
    // Validation
    if (!currentItem.product_id) {
      showError('Please select a product first');
      return;
    }

    const selectedProduct = products.find(p => p.id === parseInt(currentItem.product_id));
    if (!selectedProduct) {
      showError('Invalid product selected');
      return;
    }

    try {
      // Fetch available batches for the selected product
      const response = await productService.getProductBatches(currentItem.product_id);
      if (response.success && Array.isArray(response.data)) {
        const batches = response.data.map(b => ({
          batch: b.batch || b.batch_id,
          totalQuantity: parseFloat(b.total_quantity || b.quantity || 0),
          unit: b.unit || 'kg'
        })).filter(b => b.batch && b.totalQuantity > 0);

        setBatchSelectionDialog({
          isOpen: true,
          product: {
            product_id: currentItem.product_id,
            product_name: currentItem.product_name,
            rate: selectedProduct.caterer_price,
            gst: selectedProduct.gst || 0,
            unit: selectedProduct.unit || 'kg'
          },
          availableBatches: batches
        });
      } else {
        showError('No batches available for this product');
      }
    } catch (error) {
      console.error('Error fetching batches:', error);
      showError('Failed to fetch product batches');
    }
  };

  const handleBatchSelection = (selectedItem) => {
    // Add new item as a separate entry (no merging logic)
    setSellData(prev => ({
      ...prev,
      items: [...prev.items, selectedItem]
    }));

    showSuccess('Item added successfully');

    // Reset current item
    setCurrentItem({
      product_id: '',
      product_name: '',
      quantity: '',
      unit: 'kg',
      rate: '',
      gst: '0'
    });
  };

  const addCharge = () => {
    // Validation
    if (!currentCharge.name || !currentCharge.value) {
      showError('Please fill charge name and value');
      return;
    }

    const value = parseFloat(currentCharge.value);
    if (isNaN(value) || value <= 0) {
      showError('Please enter a valid charge value');
      return;
    }

    // Check if charge with same name already exists
    const existingChargeIndex = sellData.other_charges.findIndex(charge => charge.name === currentCharge.name);
    if (existingChargeIndex !== -1) {
      showError('Charge with this name already exists');
      return;
    }

    const newCharge = {
      ...currentCharge,
      value
    };

    setSellData(prev => ({
      ...prev,
      other_charges: [...prev.other_charges, newCharge]
    }));

    // Reset current charge
    setCurrentCharge({
      name: '',
      type: 'fixed',
      value: '',
      value_type: 'fixed'
    });

    showSuccess('Charge added successfully');
  };

  const removeCharge = (index) => {
    setSellData(prev => ({
      ...prev,
      other_charges: prev.other_charges.filter((_, i) => i !== index)
    }));
    showSuccess('Charge removed successfully');
  };

  const removeItem = (index) => {
    const item = sellData.items[index];
    
    if (item.isMixHeader) {
      // Remove the entire mix (header + all items)
      const mixNumber = item.mixNumber;
      setSellData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) =>
          !sellData.items[i].isMixHeader || sellData.items[i].mixNumber !== mixNumber
        )
      }));
      showSuccess(`${item.product_name} mix removed successfully`);
    } else if (item.isMixItem) {
      // Remove individual mix item
      setSellData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
      showSuccess(`${item.product_name} removed successfully`);
    } else {
      // Remove regular item
      setSellData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
      showSuccess('Item removed successfully');
    }
  };

  const calculateTotals = () => {
    // Calculate totals for each item if they don't have the properties
    const itemsWithTotals = sellData.items.map((item, index) => {
      if (item.subtotal !== undefined && item.gst_amount !== undefined && item.total !== undefined) {
        return item;
      }
      
      // For mix headers, use the existing values
      if (item.isMixHeader) {
        const subtotal = parseFloat(item.subtotal || item.total || 0);
        const total = parseFloat(item.total || 0);
        return {
          ...item,
          subtotal,
          gst_amount: parseFloat(item.gst_amount || 0),
          total
        };
      }
      
      // For mix items, use the allocated budget as the total but set to 0 for calculation
      if (item.isMixItem) {
        const subtotal = parseFloat(item.subtotal || item.total || 0);
        const total = parseFloat(item.total || 0);
        return {
          ...item,
          subtotal,
          gst_amount: parseFloat(item.gst_amount || 0),
          total
        };
      }
      
      // Calculate missing properties for regular items
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const gst = parseFloat(item.gst) || 0;
      
      const subtotal = quantity * rate;
      const gstAmount = (subtotal * gst) / 100;
      const total = subtotal + gstAmount;
      
      return {
        ...item,
        subtotal,
        gst_amount: gstAmount,
        total
      };
    });

    // Calculate totals - only include mix headers, not individual mix items
    const subtotal = itemsWithTotals.reduce((sum, item) => {
      // Skip mix items in the calculation (only include mix headers)
      if (item.isMixItem) {
        return sum;
      }
      const itemSubtotal = parseFloat(item.subtotal || 0);
      return sum + itemSubtotal;
    }, 0);
    
    const totalGst = itemsWithTotals.reduce((sum, item) => {
      // Skip mix items in the calculation (only include mix headers)
      if (item.isMixItem) {
        return sum;
      }
      return sum + (item.gst_amount || 0);
    }, 0);
    
    const itemsTotal = itemsWithTotals.reduce((sum, item) => {
      // Skip mix items in the calculation (only include mix headers)
      if (item.isMixItem) {
        return sum;
      }
      const itemTotal = parseFloat(item.total || 0);
      return sum + itemTotal;
    }, 0);

    // Calculate other charges and discounts
    let otherChargesTotal = 0;
    let discountTotal = 0;
    sellData.other_charges.forEach(charge => {
      if (charge.type === 'fixed') {
        otherChargesTotal += charge.value;
      } else if (charge.type === 'percentage') {
        otherChargesTotal += (itemsTotal * charge.value) / 100;
      } else if (charge.type === 'discount') {
        if (charge.value_type === 'fixed') {
          discountTotal += charge.value;
        } else if (charge.value_type === 'percentage') {
          discountTotal += (itemsTotal * charge.value) / 100;
        }
      }
    });

    const grandTotal = itemsTotal + otherChargesTotal - discountTotal;

    return { subtotal, totalGst, itemsTotal, otherChargesTotal, grandTotal };
  };

  const calculateDiscountTotal = () => {
    // Calculate items total, skipping mix items to avoid double-counting
    const itemsTotal = sellData.items.reduce((sum, item) => {
      // Skip mix items in the calculation (only include mix headers)
      if (item.isMixItem) {
        return sum;
      }
      return sum + (item.total || 0);
    }, 0);
    
    let discountTotal = 0;
    sellData.other_charges.forEach(charge => {
      if (charge.type === 'discount') {
        if (charge.value_type === 'fixed') {
          discountTotal += charge.value;
        } else if (charge.value_type === 'percentage') {
          discountTotal += (itemsTotal * charge.value) / 100;
        }
      }
    });
    return discountTotal;
  };

  const getPaymentAmount = () => {
    const { grandTotal } = calculateTotals();

    switch (sellData.payment_option) {
      case 'full':
        return grandTotal;
      case 'half':
        return grandTotal / 2;
      case 'custom':
        return parseFloat(sellData.custom_amount) || 0;
      case 'later':
        return 0;
      default:
        return 0;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Get the current items from the state
    const currentItems = sellData.items || [];

    if (!sellData.caterer_id) {
      showError('Please select a caterer');
      return;
    }

    if (currentItems.length === 0) {
      showError('Please add at least one item to continue');
      return;
    }

    try {
      setLoading(true);

      const { subtotal, totalGst, itemsTotal, otherChargesTotal, grandTotal } = calculateTotals();
      const paymentAmount = getPaymentAmount();

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('caterer_id', sellData.caterer_id);
      formData.append('bill_number', billNumber);
      formData.append('sell_date', sellData.sell_date);
      formData.append('items', JSON.stringify(currentItems));
      formData.append('other_charges', JSON.stringify(sellData.other_charges));
      formData.append('subtotal', subtotal.toString());
      formData.append('total_gst', totalGst.toString());
      formData.append('items_total', itemsTotal.toString());
      formData.append('other_charges_total', otherChargesTotal.toString());
      formData.append('grand_total', grandTotal.toString());
      formData.append('payment_option', sellData.payment_option);
      formData.append('payment_amount', paymentAmount.toString());
      formData.append('payment_method', sellData.payment_method);
      formData.append('payment_date', sellData.payment_date);

      if (sellData.receipt_image) {
        formData.append('receipt_image', sellData.receipt_image);
      }

      const data = await catererSalesService.createSale(sellData);

      if (data.success) {
        showSuccess('Sale completed successfully!');
        navigate('/caterers');
      } else {
        showError(data.message || 'Failed to complete sale');
      }

    } catch (error) {
      console.error('Error completing sale:', error);
      showError('Failed to complete sale');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mb-4"></div>
        <p className="text-gray-600">Loading data...</p>
      </div>
    );
  }

  const { subtotal, totalGst, itemsTotal, otherChargesTotal, grandTotal } = calculateTotals();
  const paymentAmount = getPaymentAmount();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/caterers')}
                className="mr-3 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ShoppingCartIcon className="h-8 w-8 text-orange-600 mr-3" />
                  Sell to Caterer
                </h1>
                <p className="text-gray-600 mt-1">Create a new sales order</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-600">Bill Number</p>
              <p className="text-xl font-bold text-orange-600">{billNumber}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sale Details */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <DocumentTextIcon className="h-5 w-5 text-orange-600 mr-2" />
              Sale Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Sale Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    name="sell_date"
                    value={sellData.sell_date}
                    onChange={handleSellDataChange}
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Caterer <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="caterer_id"
                    value={sellData.caterer_id}
                    onChange={handleCatererChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 appearance-none"
                  >
                    <option value="">
                      {caterers.length === 0 ? 'Loading caterers...' : 'Select Caterer'}
                    </option>
                    {caterers.length > 0 && caterers.map((caterer) => (
                      <option key={caterer.id} value={caterer.id}>
                        {caterer.caterer_name}
                      </option>
                    ))}
                  </select>
                  <UserIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Caterer Details */}
            {sellData.caterer_id && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Caterer Details
                </label>
                <div className="p-3 border border-gray-300 rounded-md bg-gray-50">
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{sellData.caterer_name}</p>
                    <p className="text-sm text-gray-600">Contact: {caterers.find(c => c.id === parseInt(sellData.caterer_id))?.contact_person || ''}</p>
                    <p className="text-sm text-gray-600">Phone: {caterers.find(c => c.id === parseInt(sellData.caterer_id))?.phone_number || ''}</p>
                    {caterers.find(c => c.id === parseInt(sellData.caterer_id))?.email && (
                      <p className="text-sm text-gray-600">Email: {caterers.find(c => c.id === parseInt(sellData.caterer_id))?.email}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Items Section */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <ShoppingCartIcon className="h-5 w-5 text-orange-600 mr-2" />
              Product Items
            </h2>

            {/* Add Item Form */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                {/* Product Dropdown */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="product_id"
                    value={currentItem.product_id}
                    onChange={handleCurrentItemChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">
                      {!products || products.length === 0 ? 'Loading products...' : 'Select Product'}
                    </option>
                    {products && products.length > 0 && products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={currentItem.quantity}
                    onChange={handleCurrentItemChange}
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={currentItem.unit}
                    onChange={handleCurrentItemChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  >
                    {unitOptions && unitOptions.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rate */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="rate"
                    value={currentItem.rate}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, ''); // Allow digits and decimal point
                      // Ensure only one decimal point and max 2 decimal places
                      if (value.includes('.')) {
                        const parts = value.split('.');
                        if (parts[1] && parts[1].length > 2) {
                          return;
                        }
                      }
                      handleCurrentItemChange({ target: { name: 'rate', value } });
                    }}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* GST */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    GST (%)
                  </label>
                  <input
                    type="number"
                    name="gst"
                    value={currentItem.gst}
                    onChange={handleCurrentItemChange}
                    min="0"
                    step="0.01"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Mix Calculator Button */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setMixCalculatorDialog({ isOpen: true })}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-center h-10"
                    title="Open Mix Calculator"
                  >
                    <CalculatorIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Add Button */}
                <div>
                  <button
                    type="button"
                    onClick={openBatchSelection}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500 flex items-center justify-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Items List */}
            {sellData.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GST (%)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GST Amount (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sellData.items.map((item, index) => (
                      item.isMixHeader ? (
                        // Mix header row
                        <tr key={index} className="bg-orange-50 hover:bg-orange-100">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-bold text-orange-800">{item.product_name}</span>
                                <span className="text-xs text-orange-600 ml-2">({item.mixNumber})</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-orange-800">₹{parseFloat(item.total).toFixed(2).toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : item.isMixItem ? (
                        // Mix item row (indented)
                        <tr key={index} className="hover:bg-gray-50 bg-orange-25">
                          <td className="px-8 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">└ {item.product_name}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">{item.quantity}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">₹{parseFloat(item.rate || 0).toFixed(2).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">{item.gst}%</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">₹{parseFloat(item.subtotal || 0).toFixed(2).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">₹{parseFloat(item.gst_amount || 0).toFixed(2).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-700">
                            <span className="text-xs text-gray-500 block ml-4">₹{parseFloat(item.total || 0).toFixed(2).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                              title="Remove item"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ) : (
                        // Regular item row
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {item.unit}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            ₹{parseFloat(item.rate).toFixed(2).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {item.gst}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            ₹{parseFloat(item.subtotal).toFixed(2).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            ₹{parseFloat(item.gst_amount).toFixed(2).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                            ₹{parseFloat(item.total).toFixed(2).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                              title="Remove item"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>

                {/* Totals Summary */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">₹{parseFloat(subtotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total GST:</span>
                        <span className="font-medium">₹{parseFloat(totalGst).toFixed(2).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Items Total:</span>
                        <span className="font-medium">₹{parseFloat(itemsTotal).toFixed(2).toLocaleString('en-IN')}</span>
                      </div>
                      {sellData.other_charges.length > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Other Charges:</span>
                            <span className="font-medium">₹{parseFloat(otherChargesTotal).toFixed(2).toLocaleString('en-IN')}</span>
                          </div>
                          {sellData.other_charges.some(charge => charge.type === 'discount') && (
                            <div className="flex justify-between text-sm text-green-600">
                              <span>Discount:</span>
                              <span>-₹{calculateDiscountTotal().toFixed(2).toLocaleString('en-IN')}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                        <span>Grand Total:</span>
                        <span className="text-orange-600">₹{parseFloat(grandTotal).toFixed(2).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {sellData.items.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCartIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No items added yet. Add products to continue.</p>
              </div>
            )}
          </div>

          {/* Other Charges Section */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <CurrencyRupeeIcon className="h-5 w-5 text-orange-600 mr-2" />
              Other Charges
            </h2>

            {/* Add Charge Form */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                {/* Charge Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Charge Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={currentCharge.name}
                    onChange={handleCurrentChargeChange}
                    placeholder="e.g., Delivery Fee"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Charge Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="type"
                    value={currentCharge.type}
                    onChange={handleCurrentChargeChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percentage">Percentage</option>
                    <option value="discount">Discount</option>
                  </select>
                </div>

                {/* Discount Value Type (only shown for discount type) */}
                {currentCharge.type === 'discount' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Discount Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="value_type"
                      value={currentCharge.value_type}
                      onChange={handleCurrentChargeChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="fixed">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                )}

                {/* Charge Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="value"
                    value={currentCharge.value}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^\d.]/g, ''); // Allow digits and decimal point
                      // Ensure only one decimal point and max 2 decimal places
                      if (value.includes('.')) {
                        const parts = value.split('.');
                        if (parts[1] && parts[1].length > 2) {
                          return;
                        }
                      }
                      handleCurrentChargeChange({ target: { name: 'value', value } });
                    }}
                    placeholder={
                      currentCharge.type === 'percentage' ? '0.00%' :
                      currentCharge.type === 'discount' ?
                        (currentCharge.value_type === 'percentage' ? '0.00%' : '0.00') :
                        '0.00'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Add Button */}
                <div>
                  <button
                    type="button"
                    onClick={addCharge}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500 flex items-center justify-center"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add Charge
                  </button>
                </div>
              </div>
            </div>

            {/* Charges List */}
            {sellData.other_charges.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Charge Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount (₹)
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sellData.other_charges.map((charge, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {charge.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {charge.type === 'fixed' ? 'Fixed Amount' :
                           charge.type === 'percentage' ? `${charge.value}%` :
                           charge.value_type === 'percentage' ? `${charge.value}% Discount` :
                           `₹${charge.value} Discount`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {charge.value}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {charge.type === 'discount' ?
                            `₹${charge.value_type === 'fixed' ?
                              parseFloat(charge.value).toFixed(2).toLocaleString('en-IN') :
                              parseFloat((itemsTotal * charge.value) / 100).toFixed(2).toLocaleString('en-IN')}` :
                            charge.type === 'fixed' ?
                              `₹${parseFloat(charge.value).toFixed(2).toLocaleString('en-IN')}` :
                              `₹${parseFloat((itemsTotal * charge.value) / 100).toFixed(2).toLocaleString('en-IN')}`
                          }
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => removeCharge(index)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Remove charge"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sellData.other_charges.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CurrencyRupeeIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No other charges added yet.</p>
              </div>
            )}
          </div>

          {/* Payment Section */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <CurrencyRupeeIcon className="h-5 w-5 text-orange-600 mr-2" />
              Payment Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Options */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Payment Option <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {paymentOptions && paymentOptions.map((option) => (
                    <label key={option.value} className="flex items-center">
                      <input
                        type="radio"
                        name="payment_option"
                        value={option.value}
                        checked={sellData.payment_option === option.value}
                        onChange={handleSellDataChange}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>

                {/* Custom Amount Input */}
                {sellData.payment_option === 'custom' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Custom Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="custom_amount"
                      value={sellData.custom_amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, ''); // Only allow digits
                        handleSellDataChange({ target: { name: 'custom_amount', value } });
                      }}
                      required
                      placeholder="Enter amount"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                )}

                {/* Payment Amount Display */}
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Grand Total:</span>
                    <span className="font-medium">₹{parseFloat(grandTotal).toFixed(2).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-orange-600 mt-1">
                    <span>Payment Amount:</span>
                    <span>₹{parseFloat(paymentAmount).toFixed(2).toLocaleString('en-IN')}</span>
                  </div>
                  {paymentAmount < grandTotal && (
                    <div className="flex justify-between text-sm text-red-600 mt-1">
                      <span>Remaining:</span>
                      <span>₹{parseFloat(grandTotal - paymentAmount).toFixed(2).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method and Details */}
              <div className="space-y-3">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="payment_method"
                    value={sellData.payment_method}
                    onChange={handleSellDataChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  >
                    {paymentMethods && paymentMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="payment_date"
                      value={sellData.payment_date}
                      onChange={handleSellDataChange}
                      required
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <CalendarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Receipt Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Receipt Image (Optional)
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col w-full h-32 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:bg-gray-50">
                        <div className="flex flex-col items-center justify-center pt-7">
                          <PhotoIcon className="w-8 h-8 text-gray-400" />
                          <p className="pt-1 text-sm text-gray-500">
                            {sellData.receipt_image ? sellData.receipt_image.name : "Upload receipt image"}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReceiptImageChange}
                          className="opacity-0"
                        />
                      </label>
                    </div>
                    {receiptPreview && (
                      <div className="mt-2">
                        <div className="relative inline-block">
                          <img
                            src={receiptPreview}
                            alt="Receipt preview"
                            className="w-32 h-32 object-cover rounded-md border border-gray-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptPreview(null);
                              setSellData(prev => ({ ...prev, receipt_image: null }));
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                          >
                            <TrashIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/caterers')}
                className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setBillActionDialog({ isOpen: true })}
                disabled={loading || sellData.items.length === 0 || !sellData.caterer_id}
                className="px-6 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
                  'Complete Selling'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

        {/* Batch Selection Dialog */}
        {batchSelectionDialog.isOpen && batchSelectionDialog.product && (
          <CatererBatchSelectionDialog
            isOpen={batchSelectionDialog.isOpen}
            onClose={() => setBatchSelectionDialog({ isOpen: false, product: null, availableBatches: [] })}
            product={batchSelectionDialog.product}
            availableBatches={batchSelectionDialog.availableBatches ?? []}
            onBatchSelection={handleBatchSelection}
            initialQuantity={currentItem.quantity}
          />
        )}

        {/* Mix Calculator Dialog */}
        {mixCalculatorDialog.isOpen && (
          <CatererMixCalculator
            isOpen={mixCalculatorDialog.isOpen}
            onClose={() => setMixCalculatorDialog({ isOpen: false })}
            products={products}
            onBatchSelectionComplete={(mixData) => {
              // For each product in the mix, fetch available batches
              const fetchBatchesForMixProducts = async () => {
                try {
                  const productsWithBatches = await Promise.all(
                    mixData.mixProducts.map(async (product) => {
                      const response = await productService.getProductBatches(product.id);
                      return {
                        ...product,
                        availableBatches: response.success && Array.isArray(response.data)
                          ? response.data.map(b => ({
                              batch: b.batch || b.batch_id,
                              totalQuantity: parseFloat(b.total_quantity || b.quantity || 0),
                              unit: b.unit || 'kg'
                            })).filter(b => b.batch && b.totalQuantity > 0)
                          : []
                      };
                    })
                  );

                  // Open mix product selection dialog
                  setMixProductSelectionDialog({
                    isOpen: true,
                    mixProducts: productsWithBatches,
                    mixName: mixData.mixName,
                    totalBudget: mixData.totalBudget
                  });
                } catch (error) {
                  console.error('Error fetching batches for mix products:', error);
                  showError('Failed to fetch batch information for mix products');
                }
              };

              fetchBatchesForMixProducts();
            }}
          />
        )}

        {/* Mix Product Selection Dialog */}
        {mixProductSelectionDialog.isOpen && (
          <MixProductSelectionDialog
            isOpen={mixProductSelectionDialog.isOpen}
            onClose={() => setMixProductSelectionDialog({ isOpen: false })}
            mixProducts={mixProductSelectionDialog.mixProducts}
            mixName={mixProductSelectionDialog.mixName}
            totalBudget={mixProductSelectionDialog.totalBudget}
            onBatchSelectionComplete={(selectedMixData) => {
              // Add mix items to the sell form with batch information
              const mixName = selectedMixData.mixName;
              const newItems = selectedMixData.mixProducts.map((product, index) => {
                // Calculate rate properly - should be the original product price, not allocatedBudget/quantity
                const originalProduct = products.find(p => p.id === product.id);
                const rate = parseFloat(originalProduct ? (originalProduct.caterer_price || originalProduct.price || '0') : '0');
                
                return {
                  product_id: product.id,
                  product_name: product.name,
                  quantity: product.calculatedQuantity,
                  unit: product.unit || 'kg',
                  rate: rate.toFixed(2),
                  gst: '0', // Mix items typically don't have GST
                  subtotal: parseFloat(product.allocatedBudget || 0).toFixed(2),
                  gst_amount: '0',
                  total: parseFloat(product.allocatedBudget || 0).toFixed(2),
                  isMix: true,
                  mixName: mixName,
                  mixIndex: index,
                  isMixItem: true,
                  batch: product.selectedBatch,
                  batchId: null,
                  batchQuantity: product.calculatedQuantity,
                  batchUnit: product.unit || 'kg'
                };
              });

              // Add a header item for the mix
              const mixHeaderItem = {
                product_id: `mix-${Date.now()}`,
                product_name: mixName,
                quantity: 1,
                unit: 'mix',
                rate: parseFloat(mixProductSelectionDialog.totalBudget || 0),
                gst: '0',
                subtotal: parseFloat(mixProductSelectionDialog.totalBudget || 0),
                gst_amount: '0',
                total: parseFloat(mixProductSelectionDialog.totalBudget || 0),
                isMix: true,
                mixName: mixName,
                isMixHeader: true,
                // Add calculated properties to match the structure expected by calculateTotals
                calculatedRate: parseFloat(mixProductSelectionDialog.totalBudget || 0)
              };

              setSellData(prev => ({
                ...prev,
                items: [...prev.items, mixHeaderItem, ...newItems]
              }));

              showSuccess(`${mixName} added successfully!`);
              setMixProductSelectionDialog({ isOpen: false });
            }}
          />
        )}

        {/* Bill Action Dialog */}
        {billActionDialog.isOpen && (
          <CatererBillActionDialog
            isOpen={billActionDialog.isOpen}
            onClose={() => setBillActionDialog({ isOpen: false })}
            onBillPreview={() => {
              // Handle bill preview action
              console.log('Bill preview clicked');
              setBillActionDialog({ isOpen: false });
              // You can implement bill preview functionality here
            }}
            onCreateBill={() => {
              // Handle create bill action - this will submit the form
              handleSubmit(new Event('submit'));
              setBillActionDialog({ isOpen: false });
            }}
            onWhatsAppBill={() => {
              // Handle WhatsApp bill action
              console.log('WhatsApp bill clicked');
              setBillActionDialog({ isOpen: false });
              // You can implement WhatsApp functionality here
            }}
          />
        )}
    </div>
  );
};

export default CatererSellComponent;
