import { useState } from 'react';
import {
  XMarkIcon,
  CurrencyRupeeIcon,
  CalendarIcon,
  PhotoIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
  DocumentCheckIcon,
  CreditCardIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../common/Modal';

const PaymentDialog = ({ isOpen, onClose, bill, onPaymentSuccess }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    payment_amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    receipt_image: null
  });
  const [receiptPreview, setReceiptPreview] = useState(null);

  const paymentMethods = [
    { value: 'cash', label: 'Cash', icon: BanknotesIcon },
    { value: 'upi', label: 'UPI', icon: DevicePhoneMobileIcon },
    { value: 'bank', label: 'Bank Transfer', icon: BuildingLibraryIcon },
    { value: 'check', label: 'Cheque', icon: DocumentCheckIcon },
    { value: 'credit', label: 'Credit', icon: CreditCardIcon },
    { value: 'other', label: 'Other', icon: EllipsisHorizontalIcon }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // For payment_amount, ensure it's an integer
    if (name === 'payment_amount') {
      const intValue = value.replace(/[^\d]/g, ''); // Remove non-digits
      setFormData(prev => ({
        ...prev,
        [name]: intValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePayFullAmount = () => {
    const pendingAmount = Math.round(parseFloat(bill.amount_pending || 0));
    setFormData(prev => ({
      ...prev,
      payment_amount: pendingAmount.toString()
    }));
  };

  const handleReceiptChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        showError('File size must be less than 5MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        receipt_image: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptPreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeReceipt = () => {
    setFormData(prev => ({
      ...prev,
      receipt_image: null
    }));
    setReceiptPreview(null);
  };

  const validateForm = () => {
    const paymentAmount = parseInt(formData.payment_amount);
    const pendingAmount = Math.round(parseFloat(bill.amount_pending || 0));

    if (!formData.payment_amount || paymentAmount <= 0) {
      showError('Please enter a valid payment amount');
      return false;
    }

    if (paymentAmount > pendingAmount) {
      showError(`Payment amount cannot exceed pending amount (₹${pendingAmount.toLocaleString('en-IN')})`);
      return false;
    }

    if (!formData.payment_method) {
      showError('Please select a payment method');
      return false;
    }

    if (!formData.payment_date) {
      showError('Please select a payment date');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const submitData = new FormData();
      submitData.append('purchase_id', bill.id);
      submitData.append('payment_amount', formData.payment_amount);
      submitData.append('payment_method', formData.payment_method);
      submitData.append('payment_date', formData.payment_date);
      
      if (formData.notes.trim()) {
        submitData.append('notes', formData.notes.trim());
      }

      if (formData.receipt_image) {
        submitData.append('receipt_image', formData.receipt_image);
      }

      const response = await fetch('http://localhost:5000/api/payment-records', {
        method: 'POST',
        body: submitData
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Payment recorded successfully');
        
        // Reset form
        setFormData({
          payment_amount: '',
          payment_method: 'cash',
          payment_date: new Date().toISOString().split('T')[0],
          notes: '',
          receipt_image: null
        });
        setReceiptPreview(null);
        
        onPaymentSuccess();
      } else {
        showError(data.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      showError('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        payment_amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
        receipt_image: null
      });
      setReceiptPreview(null);
      onClose();
    }
  };

  if (!bill) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Collect Payment"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bill Information */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Bill Number:</span>
            <span className="text-sm font-semibold">{bill.bill_number}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Supplier:</span>
            <span className="text-sm">{bill.supplier_name}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Total Amount:</span>
            <span className="text-sm font-semibold">{formatCurrency(parseFloat(bill.grand_total || 0))}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Pending Amount:</span>
            <span className="text-sm font-semibold text-red-600">{formatCurrency(parseFloat(bill.amount_pending || 0))}</span>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Amount <span className="text-red-500">*</span>
          </label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <CurrencyRupeeIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="payment_amount"
                value={formData.payment_amount}
                onChange={handleInputChange}
                placeholder="0"
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={handlePayFullAmount}
              className="px-3 py-2 text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              Pay Full
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Maximum: ₹{Math.round(parseFloat(bill.amount_pending || 0)).toLocaleString('en-IN')} (integers only)
          </p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((method) => {
              const IconComponent = method.icon;
              return (
                <label
                  key={method.value}
                  className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                    formData.payment_method === method.value
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value={method.value}
                    checked={formData.payment_method === method.value}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <IconComponent className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">{method.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <CalendarIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleInputChange}
              required
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder="Add any notes about this payment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Receipt Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Receipt Image (Optional)
          </label>
          <div className="flex items-center justify-center w-full">
            <label className={`flex flex-col w-full h-32 border-2 border-dashed rounded-md cursor-pointer transition-all ${
              receiptPreview ? 'border-orange-300 bg-orange-50' : 'border-gray-300 hover:bg-gray-50'
            }`}>
              {receiptPreview ? (
                <div className="relative w-full h-full">
                  <img
                    src={receiptPreview}
                    alt="Receipt preview"
                    className="w-full h-full object-cover rounded-md"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        removeReceipt();
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
                    Click to upload receipt image
                  </p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleReceiptChange}
                className="opacity-0"
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PNG, JPG up to 5MB
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentDialog;
