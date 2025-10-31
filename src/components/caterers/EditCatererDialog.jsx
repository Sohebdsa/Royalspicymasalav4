import React, { useState, useEffect } from 'react';
import { UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useSafety } from '../../contexts/SafetyContext';
import { useToast } from '../../contexts/ToastContext';
import SafetyDialog from '../common/SafetyDialog';

const EditCatererDialog = ({ isOpen, onClose, caterer, onCatererUpdated }) => {
  const { requiresSafetyCheck } = useSafety();
  const { showSuccess, showError } = useToast();
  const [form, setForm] = useState({
    caterer_name: '',
    contact_person: '',
    phone_number: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gst_number: '',
    card_image: null,
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);

  // Pre-populate form when caterer data is available
  useEffect(() => {
    if (caterer && isOpen) {
      setForm({
        caterer_name: caterer.caterer_name || '',
        contact_person: caterer.contact_person || '',
        phone_number: caterer.phone_number || '',
        email: caterer.email || '',
        address: caterer.address || '',
        city: caterer.city || '',
        state: caterer.state || '',
        pincode: caterer.pincode || '',
        gst_number: caterer.gst_number || '',
        card_image: null,
        description: caterer.description || '',
      });
      
      setExistingImageUrl(caterer.card_image_url || null);
      setImagePreview(null);
      setErrors({});
    }
  }, [caterer, isOpen]);

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

  if (!isOpen || !caterer) return null;

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'card_image') {
      const file = files[0];
      setForm(f => ({ ...f, card_image: file }));
      if (file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          setErrors(prev => ({ ...prev, card_image: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' }));
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({ ...prev, card_image: 'File size too large. Maximum 5MB allowed.' }));
          return;
        }
        
        setErrors(prev => ({ ...prev, card_image: null }));
        
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
      if (errors[name]) {
        setErrors(prev => ({ ...prev, [name]: null }));
      }
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.caterer_name.trim()) errs.caterer_name = 'Caterer name is required';
    if (!form.contact_person.trim()) errs.contact_person = 'Contact person is required';
    if (!form.phone_number.trim()) errs.phone_number = 'Phone number is required';
    
    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) {
        errs.email = 'Invalid email format';
      }
    }
    
    if (form.phone_number && form.phone_number.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(form.phone_number.trim())) {
        errs.phone_number = 'Invalid phone number format';
      }
    }
    
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    
    if (requiresSafetyCheck('edit')) {
      setShowSafetyDialog(true);
      return;
    }
    performSubmit();
  };

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const performSubmit = async () => {
    setSubmitting(true);
    setErrors({});
    
    try {
      const formData = new FormData();
      
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'card_image') {
          if (value) {
            formData.append(key, value);
          }
        } else if (value !== null && value !== undefined) {
          const processedValue = typeof value === 'string' ? value.trim() : value;
          formData.append(key, processedValue);
        }
      });

      const response = await fetch(`${API_BASE_URL}/caterers/${caterer.id}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.errors?.join(', ') || 'Failed to update caterer');
      }

      showSuccess('Caterer updated successfully');
      onCatererUpdated && onCatererUpdated(data.caterer);
      onClose();
      setImagePreview(null);
      
    } catch (error) {
      console.error('Update error:', error);
      showError(error.message || 'Failed to update caterer');
      setErrors({ submit: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSafetyConfirm = () => {
    setShowSafetyDialog(false);
    performSubmit();
  };

  const handleClose = () => {
    if (!submitting) {
      setImagePreview(null);
      setErrors({});
      onClose();
    }
  };

  const removeNewImage = () => {
    setForm(f => ({ ...f, card_image: null }));
    setImagePreview(null);
    setErrors(prev => ({ ...prev, card_image: null }));
  };

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
        onClick={handleClose}
      ></div>
      
      {/* Dialog container */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full relative z-10"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserIcon className="h-6 w-6 text-orange-600 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Edit Caterer - {caterer.caterer_name}
                </h3>
              </div>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:opacity-50"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            <div className="space-y-6">
              {/* Caterer Card Image */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Caterer Card Image
                </label>
                <div className="space-y-2">
                  {/* File Upload Area */}
                  <div className="flex items-center justify-center w-full">
                    <label className={`flex flex-col w-full h-40 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                      imagePreview ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}>
                      {imagePreview ? (
                        <div className="relative w-full h-full">
                          <img
                            src={imagePreview}
                            alt="New caterer preview"
                            className="w-full h-full object-cover rounded-md"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                removeNewImage();
                              }}
                              disabled={submitting}
                              className="bg-red-500 text-white rounded-full p-2 hover:bg-red-600 shadow-md disabled:opacity-50 flex items-center"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-7">
                          {existingImageUrl ? (
                            <div className="relative w-16 h-16 mb-2">
                              <img
                                src={existingImageUrl}
                                alt="Current caterer"
                                className="w-full h-full object-cover rounded-md border border-gray-300"
                              />
                              <div className="absolute -top-1 -right-1 bg-orange-500 text-white rounded-full p-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <UserIcon className="w-12 h-12 text-gray-400" />
                          )}
                          <p className="pt-1 text-sm text-gray-500 text-center px-4">
                            {form.card_image
                              ? form.card_image.name
                              : existingImageUrl
                                ? "Choose new image to replace current one"
                                : "Choose caterer image or drag and drop"
                            }
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleChange}
                        className="opacity-0"
                        name="card_image"
                        disabled={submitting}
                      />
                    </label>
                  </div>
                  
                  {errors.card_image && (
                    <p className="text-red-500 text-xs mt-1">{errors.card_image}</p>
                  )}
                  
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                </div>
              </div>

              {/* Caterer Name and Contact Person Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Caterer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="caterer_name"
                    value={form.caterer_name}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    placeholder="Enter caterer name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                  {errors.caterer_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.caterer_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contact_person"
                    value={form.contact_person}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    placeholder="Enter contact person name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                  {errors.contact_person && (
                    <p className="text-red-500 text-xs mt-1">{errors.contact_person}</p>
                  )}
                </div>
              </div>

              {/* Phone Number and Email Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleChange}
                    required
                    disabled={submitting}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                  {errors.phone_number && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone_number}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter email address (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Address and Location Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter address (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter city (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter state (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter pincode (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    GST Number
                  </label>
                  <input
                    type="text"
                    name="gst_number"
                    value={form.gst_number}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter GST number (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    disabled={submitting}
                    placeholder="Enter description (optional)"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 disabled:bg-gray-100"
                  />
                </div>
              </div>

              {/* Submit Error Display */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-600 text-sm">{errors.submit}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Caterer'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Safety Dialog */}
      <SafetyDialog
        isOpen={showSafetyDialog}
        onClose={() => setShowSafetyDialog(false)}
        onConfirm={handleSafetyConfirm}
        title="Edit Caterer"
        message={`Are you sure you want to update ${caterer.caterer_name}?`}
        actionType="edit"
      />
    </div>
  );
};

export default EditCatererDialog;
