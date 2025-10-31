import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  PhotoIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import { useSafety } from '../../contexts/SafetyContext';
import SafetyDialog from '../common/SafetyDialog';

const AddSupplierDialog = ({ isOpen, onClose, onSupplierAdded, editSupplier = null }) => {
  const { showSuccess, showError } = useToast();
  const { requiresSafetyCheck } = useSafety();
  const [loading, setLoading] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [productTags, setProductTags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');

  const [formData, setFormData] = useState({
    supplier_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    notes: '',
    supplier_image: null,
    products_supplied: []
  });

  useEffect(() => {
    if (isOpen) {
      if (editSupplier) {
        setFormData({
          supplier_name: editSupplier.supplier_name || '',
          contact_person: editSupplier.contact_person || '',
          phone_number: editSupplier.phone_number || '',
          email: editSupplier.email || '',
          address: editSupplier.address || '',
          notes: editSupplier.notes || '',
          supplier_image: null,
          products_supplied: editSupplier.products_supplied || []
        });
        
        setProductTags(editSupplier.products_supplied || []);
        
        // Set image preview if editing
        if (editSupplier.supplier_image) {
          setImagePreview(`http://localhost:5000/uploads/suppliers/${editSupplier.supplier_image}`);
        }
      } else {
        // Reset form for new supplier
        setFormData({
          supplier_name: '',
          contact_person: '',
          phone_number: '',
          email: '',
          address: '',
          notes: '',
          supplier_image: null,
          products_supplied: []
        });
        setImagePreview(null);
        setProductTags([]);
        setCurrentTag('');
      }
    }
  }, [isOpen, editSupplier]);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('Image size should be less than 5MB');
        return;
      }
      
      setFormData(prev => ({ ...prev, supplier_image: file }));
      
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      if (currentTag.trim() && !productTags.includes(currentTag.trim())) {
        const newTags = [...productTags, currentTag.trim()];
        setProductTags(newTags);
        setFormData(prev => ({ ...prev, products_supplied: newTags }));
        setCurrentTag('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const newTags = productTags.filter(tag => tag !== tagToRemove);
    setProductTags(newTags);
    setFormData(prev => ({ ...prev, products_supplied: newTags }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (requiresSafetyCheck(editSupplier ? 'edit' : 'add')) {
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
        if (key === 'products_supplied') {
          submitData.append(key, JSON.stringify(formData[key]));
        } else if (formData[key] !== null && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      const url = editSupplier 
        ? `http://localhost:5000/api/suppliers/${editSupplier.id}`
        : 'http://localhost:5000/api/suppliers';
      
      const method = editSupplier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        body: submitData
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(editSupplier ? 'Supplier updated successfully' : 'Supplier added successfully');
        onSupplierAdded();
        onClose();
      } else {
        showError(data.message || `Failed to ${editSupplier ? 'update' : 'add'} supplier`);
      }
    } catch (error) {
      console.error('Error submitting supplier:', error);
      showError(`Failed to ${editSupplier ? 'update' : 'add'} supplier`);
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyConfirm = () => {
    setShowSafetyDialog(false);
    performSubmit();
  };

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
                <UserIcon className="h-6 w-6 text-orange-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  {editSupplier ? 'Edit Supplier' : 'Add New Supplier'}
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
              {/* Supplier Image */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Supplier Image
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-center w-full">
                    <label className={`flex flex-col w-full h-40 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                      imagePreview ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}>
                      {imagePreview ? (
                        <div className="relative w-full h-full">
                          <img
                            src={imagePreview}
                            alt="Supplier preview"
                            className="w-full h-full object-cover rounded-md"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setImagePreview(null);
                                setFormData(prev => ({ ...prev, supplier_image: null }));
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
                            {formData.supplier_image ? formData.supplier_image.name : "Choose supplier image or drag and drop"}
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="opacity-0"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                </div>
              </div>

              {/* Supplier Name and Contact Person Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Supplier Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="supplier_name"
                    value={formData.supplier_name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter supplier name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter contact person name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Phone Number and Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter phone number"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <PhoneIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter email address (optional)"
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <EnvelopeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Address
                </label>
                <div className="relative">
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder="Enter supplier address (optional)"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  />
                  <MapPinIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              </div>

              {/* Products Supplied Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Products Supplied
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={handleAddTag}
                        placeholder="Enter product name and press Enter"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <TagIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    >
                      Add
                    </button>
                  </div>

                  {/* Display Tags */}
                  {productTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {productTags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-2 text-orange-600 hover:text-orange-800"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Additional notes about the supplier (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
                />
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
                      {editSupplier ? 'Updating...' : 'Adding...'}
                    </div>
                  ) : (
                    editSupplier ? 'Update Supplier' : 'Add Supplier'
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
              title={`${editSupplier ? 'Edit' : 'Add'} Supplier`}
              message={`Are you sure you want to ${editSupplier ? 'update' : 'add'} this supplier?`}
              actionType={editSupplier ? 'edit' : 'add'}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSupplierDialog;
