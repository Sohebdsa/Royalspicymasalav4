import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  CreditCard, AlertCircle, IndianRupee,
  Calculator, CheckCircle, Loader2, Receipt, FileImage
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function OrderPaymentCollectionDialog({
  isOpen,
  onClose,
  onPaymentSubmit,
  order,
  customer,
  isLoading = false
}) {
  const { toast } = useToast();

  if (!order) {
    console.error('OrderPaymentCollectionDialog: Order prop is required');
    return null;
  }

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    receiptFile: null
  });
  const [errors, setErrors] = useState({});

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN')}`;

  // Reset form on open
  useEffect(() => {
    if (isOpen && order) {
      setPaymentData({
        amount: order.total_amount?.toString() || '',
        paymentMethod: 'cash',
        referenceNumber: '',
        notes: '',
        receiptFile: null
      });
      setErrors({});
    }
  }, [isOpen, order]);

  // Update amount
  const handleAmountChange = (value) => {
    setPaymentData(prev => ({ ...prev, amount: value }));
    setErrors(prev => ({ ...prev, amount: '' }));
    const amount = parseFloat(value || 0);
    const maxAmount = parseFloat(order.total_amount || 0);
    if (amount > maxAmount) {
      setErrors(prev => ({ ...prev, amount: `Amount cannot exceed ${formatCurrency(maxAmount)}` }));
    }
  };

  // File upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, receipt: 'Please upload an image file' }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, receipt: 'File size must be less than 5MB' }));
        return;
      }
      setPaymentData(prev => ({ ...prev, receiptFile: file }));
      setErrors(prev => ({ ...prev, receipt: '' }));
    }
  };

  // Validate payment
  const validatePayment = () => {
    const newErrors = {};
    const amount = parseFloat(paymentData.amount || 0);

    if (amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    const maxAmount = parseFloat(order.total_amount || 0);
    if (amount > maxAmount) {
      newErrors.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}`;
    }
    if (['upi', 'bank_transfer'].includes(paymentData.paymentMethod)) {
      if (!paymentData.referenceNumber.trim()) {
        newErrors.referenceNumber = 'Reference number is required';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit payment
  const handleSubmit = () => {
    if (!validatePayment()) return;

    if (!customer?.id) {
      setErrors(prev => ({ ...prev, customer: 'Customer is required' }));
      return;
    }

    const formData = new FormData();
    formData.append('customerId', customer.id);
    formData.append('amount', parseFloat(paymentData.amount));
    formData.append('paymentMethod', paymentData.paymentMethod);
    formData.append('notes', paymentData.notes || '');
    formData.append('orderId', order.id);

    if (paymentData.referenceNumber) {
      formData.append('referenceNumber', paymentData.referenceNumber);
    }
    if (paymentData.receiptFile) {
      formData.append('receipt_image', paymentData.receiptFile);
    }

    // This will now record payment AND mark order as delivered
    onPaymentSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="font-bold">Record Payment</div>
              <div className="text-sm font-normal text-gray-600">
                {customer?.name || 'Unknown Customer'} - Order #{order?.order_number || 'N/A'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Payment form content remains the same... */}
        <div className="space-y-6">
          {/* Amount Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <IndianRupee className="h-5 w-5 text-green-600" />
                Payment Amount
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentData.amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="Enter amount"
                    className={errors.amount ? 'border-red-300' : ''}
                  />
                  {errors.amount && (
                    <p className="text-red-500 text-xs mt-1">{errors.amount}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Total
                  </label>
                  <div className="flex items-center h-10 px-3 bg-gray-50 border border-gray-200 rounded-md">
                    <span className="text-gray-900 font-medium">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              {/* Reference Number for digital payments */}
              {['upi', 'bank_transfer'].includes(paymentData.paymentMethod) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number *
                  </label>
                  <Input
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                    placeholder="Enter transaction reference number"
                    className={errors.referenceNumber ? 'border-red-300' : ''}
                  />
                  {errors.referenceNumber && (
                    <p className="text-red-500 text-xs mt-1">{errors.referenceNumber}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
                Receipt Upload (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <FileImage className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="receipt-upload"
                />
                <label
                  htmlFor="receipt-upload"
                  className="cursor-pointer text-blue-600 hover:text-blue-800"
                >
                  Click to upload receipt image
                </label>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                {paymentData.receiptFile && (
                  <p className="text-green-600 text-sm mt-2">
                    ✓ {paymentData.receiptFile.name}
                  </p>
                )}
                {errors.receipt && (
                  <p className="text-red-500 text-xs mt-1">{errors.receipt}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about the payment..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-6">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="px-6">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !paymentData.amount || parseFloat(paymentData.amount) <= 0}
            className="px-6 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Payment & Mark Delivered
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
