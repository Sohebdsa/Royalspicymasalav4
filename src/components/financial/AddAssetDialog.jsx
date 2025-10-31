import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  PhotoIcon,
  CalendarIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import { useSafety } from '../../contexts/SafetyContext';
import SafetyDialog from '../common/SafetyDialog';

const AddAssetDialog = ({ isOpen, onClose, onAssetAdded, editAsset = null }) => {
  const { showSuccess, showError } = useToast();
  const { requiresSafetyCheck } = useSafety();
  const [loading, setLoading] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [categories, setCategories] = useState([]);
  const [assetImagePreview, setAssetImagePreview] = useState(null);
  const [receiptImagePreview, setReceiptImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    asset_title: '',
    description: '',
    category: '',
    location: '',
    warranty: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_amount: '',
    current_value: '',
    warranty_expiry_date: '',
    asset_image: null,
    receipt_image: null
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (editAsset) {
        setFormData({
          asset_title: editAsset.asset_title || '',
          description: editAsset.description || '',
          category: editAsset.category || '',
          location: editAsset.location || '',
          warranty: editAsset.warranty || '',
          purchase_date: editAsset.purchase_date || new Date().toISOString().split('T')[0],
          purchase_amount: editAsset.purchase_amount || '',
          current_value: editAsset.current_value || '',
          warranty_expiry_date: editAsset.warranty_expiry_date || '',
          asset_image: null,
          receipt_image: null
        });
        
        // Set image previews if editing
        if (editAsset.asset_image) {
          setAssetImagePreview(`http://localhost:5000/uploads/assets/${editAsset.asset_image}`);
        }
        if (editAsset.receipt_image) {
          setReceiptImagePreview(`http://localhost:5000/uploads/assets/receipts/${editAsset.receipt_image}`);
        }
      } else {
        // Reset form for new asset
        setFormData({
          asset_title: '',
          description: '',
          category: '',
          location: '',
          warranty: '',
          purchase_date: new Date().toISOString().split('T')[0],
          purchase_amount: '',
          current_value: '',
          warranty_expiry_date: '',
          asset_image: null,
          receipt_image: null
        });
        setAssetImagePreview(null);
        setReceiptImagePreview(null);
      }
    }
  }, [isOpen, editAsset]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/assets/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAssetImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Asset image size should be less than 5MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, asset_image: file }));
      
      const reader = new FileReader();
      reader.onload = (e) => setAssetImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleReceiptImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Receipt image size should be less than 5MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, receipt_image: file }));
      
      const reader = new FileReader();
      reader.onload = (e) => setReceiptImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (requiresSafetyCheck(editAsset ? 'edit' : 'add')) {
      setShowSafetyDialog(true);
      return;
    }
    
    await performSubmit();
  };

  const performSubmit = async () => {
    try {
      setLoading(true);
      
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      const url = editAsset 
        ? `http://localhost:5000/api/assets/${editAsset.id}`
        : 'http://localhost:5000/api/assets';
      
      const method = editAsset ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        body: submitData
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(editAsset ? 'Asset updated successfully' : 'Asset added successfully');
        onAssetAdded();
        onClose();
      } else {
        showError(data.message || `Failed to ${editAsset ? 'update' : 'add'} asset`);
      }
    } catch (error) {
      console.error('Error submitting asset:', error);
      showError(`Failed to ${editAsset ? 'update' : 'add'} asset`);
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyConfirm = () => {
    setShowSafetyDialog(false);
    performSubmit();
  };

  // Disable body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop with blur */}
      <div 
        className="fixed inset-0 transition-opacity" 
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.4)', 
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      ></div>
      
      {/* Dialog container */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        {/* Dialog content */}
        <div 
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative z-10" 
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BuildingOfficeIcon className="h-6 w-6 text-orange-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  {editAsset ? 'Edit Asset' : 'Add New Asset'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-6">
              {/* Asset Image */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Asset Image <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label className={`flex flex-col w-full h-40 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                      assetImagePreview ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}>
                      {assetImagePreview ? (
                        <div className="relative w-full h-full">
                          <img
                            src={assetImagePreview}
                            alt="Asset preview"
                            className="w-full h-full object-cover rounded-md"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setAssetImagePreview(null);
                                setFormData(prev => ({ ...prev, asset_image: null }));
                              }}
                              className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-md flex items-center"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-7">
                          <PhotoIcon className="w-12 h-12 text-gray-400" />
                          <p className="pt-1 text-sm text-gray-500 text-center px-4">
                            {formData.asset_image ? formData.asset_image.name : "Choose asset image or drag and drop"}
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAssetImageChange}
                        className="opacity-0"
                        required={!editAsset}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                </div>
              </div>

              {/* Asset Title and Category Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Asset Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Asset Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="asset_title"
                    value={formData.asset_title}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter asset title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 appearance-none"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.category_name} value={cat.category_name}>
                          {cat.category_name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Asset description (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
                />
              </div>

              {/* Location and Warranty Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Asset location (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Warranty */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Warranty
                  </label>
                  <input
                    type="text"
                    name="warranty"
                    value={formData.warranty}
                    onChange={handleInputChange}
                    placeholder="Warranty details (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Purchase Date and Purchase Amount Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Purchase Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Purchase Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="purchase_date"
                      value={formData.purchase_date}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Purchase Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Purchase Amount <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="purchase_amount"
                      value={formData.purchase_amount}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <span className="text-gray-500">₹</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Value and Warranty Expiry Date Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Current Value
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="current_value"
                      value={formData.current_value}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      placeholder="0.00 (optional)"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                      <span className="text-gray-500">₹</span>
                    </div>
                  </div>
                </div>

                {/* Warranty Expiry Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Warranty Expiry Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="warranty_expiry_date"
                      value={formData.warranty_expiry_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Receipt Image */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Receipt Image
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label className={`flex flex-col w-full h-32 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                      receiptImagePreview ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}>
                      {receiptImagePreview ? (
                        <div className="relative w-full h-full">
                          <img
                            src={receiptImagePreview}
                            alt="Receipt preview"
                            className="w-full h-full object-cover rounded-md"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setReceiptImagePreview(null);
                                setFormData(prev => ({ ...prev, receipt_image: null }));
                              }}
                              className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-md flex items-center"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-7">
                          <PhotoIcon className="w-10 h-10 text-gray-400" />
                          <p className="pt-1 text-sm text-gray-500 text-center px-4">
                            {formData.receipt_image ? formData.receipt_image.name : "Choose receipt image or drag and drop"}
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptImageChange}
                        className="opacity-0"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editAsset ? 'Updating...' : 'Adding...'}
                    </div>
                  ) : (
                    editAsset ? 'Update Asset' : 'Add Asset'
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Safety Dialog */}
          {showSafetyDialog && (
            <SafetyDialog
              isOpen={showSafetyDialog}
              onClose={() => setShowSafetyDialog(false)}
              onConfirm={handleSafetyConfirm}
              title={`${editAsset ? 'Edit' : 'Add'} Asset`}
              message={`Are you sure you want to ${editAsset ? 'update' : 'add'} this asset?`}
              actionType={editAsset ? 'edit' : 'add'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AddAssetDialog;
