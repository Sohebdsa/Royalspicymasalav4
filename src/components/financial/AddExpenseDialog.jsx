import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  CurrencyDollarIcon,
  PhotoIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';

const AddExpenseDialog = ({ isOpen, onClose, onExpenseAdded, editExpense = null }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    category: '',
    expense_name: '',
    expense_amount: '',
    notes: '',
    expense_date: new Date().toISOString().split('T')[0],
    receipt_image: null
  });
  const [previewImage, setPreviewImage] = useState(null);

  // Load categories on component mount and handle body scroll
  useEffect(() => {
    if (isOpen) {
      // Disable body scroll
      document.body.style.overflow = 'hidden';

      fetchCategories();
      if (editExpense) {
        setFormData({
          category: editExpense.category || '',
          expense_name: editExpense.expense_name || '',
          expense_amount: editExpense.expense_amount || '',
          notes: editExpense.notes || '',
          expense_date: editExpense.expense_date || new Date().toISOString().split('T')[0],
          receipt_image: null
        });
        if (editExpense.receipt_image) {
          setPreviewImage(`http://localhost:5000/api/expenses/receipts/${editExpense.receipt_image}`);
        }
      } else {
        resetForm();
      }
    } else {
      // Re-enable body scroll
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to re-enable scroll when component unmounts
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, editExpense]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/expenses/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      showError('Failed to load expense categories');
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      expense_name: '',
      expense_amount: '',
      notes: '',
      expense_date: new Date().toISOString().split('T')[0],
      receipt_image: null
    });
    setPreviewImage(null);
  };

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
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        showError('Image size must be less than 5MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        receipt_image: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.category || !formData.expense_name || !formData.expense_amount || !formData.expense_date) {
        showError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Validate amount
      const amount = parseFloat(formData.expense_amount);
      if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid expense amount');
        setLoading(false);
        return;
      }

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('category', formData.category);
      submitData.append('expense_name', formData.expense_name);
      submitData.append('expense_amount', formData.expense_amount);
      submitData.append('notes', formData.notes);
      submitData.append('expense_date', formData.expense_date);
      
      if (formData.receipt_image) {
        submitData.append('receipt_image', formData.receipt_image);
      }

      const url = editExpense 
        ? `http://localhost:5000/api/expenses/${editExpense.id}`
        : 'http://localhost:5000/api/expenses';
      
      const method = editExpense ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        body: submitData
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(data.message);
        onExpenseAdded();
        onClose();
        resetForm();
      } else {
        showError(data.message || 'Failed to save expense');
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      showError('Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
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
          className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full relative z-10"
          style={{ maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-6 w-6 text-orange-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                {editExpense ? 'Edit Expense' : 'Add New Expense'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* Expense Name */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Expense Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="expense_name"
              value={formData.expense_name}
              onChange={handleInputChange}
              required
              placeholder="Enter expense name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Amount and Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expense Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="expense_amount"
                  value={formData.expense_amount}
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

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="expense_date"
                  value={formData.expense_date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                />
                <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
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
              placeholder="Additional notes about this expense (optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          {/* Receipt Image */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Receipt Image
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-center w-full">
                <label className={`flex flex-col w-full h-32 border-2 border-dashed rounded-md cursor-pointer transition-all ${
                  previewImage ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
                }`}>
                  {previewImage ? (
                    <div className="relative w-full h-full">
                      <img
                        src={previewImage}
                        alt="Receipt preview"
                        className="w-full h-full object-cover rounded-md"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPreviewImage(null);
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
                        {formData.receipt_image ? formData.receipt_image.name : "Choose a file or drag and drop"}
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
                  {editExpense ? 'Updating...' : 'Adding...'}
                </div>
              ) : (
                editExpense ? 'Update Expense' : 'Add Expense'
              )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddExpenseDialog;
