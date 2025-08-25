import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  CreditCard, AlertCircle, IndianRupee,
  CheckCircle, Loader2, FileImage
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function OrderPaymentCollectionDialog({
  isOpen,
  onClose,
  onPaymentSubmit,
  order,
  customer = {},
  outstanding = 0,
  isLoading = false
}) {
  const { toast } = useToast();

  if (!order) {
    console.error('OrderPaymentCollectionDialog: Order prop is required');
    return null;
  }

  // Ensure customer is an object, not null or undefined
  const safeCustomer = customer || {};

  // Compute combined max
  const orderAmount = parseFloat(order.total_amount || 0);
  const custOutstanding = parseFloat(outstanding || 0);
  const maxAmountTotal = orderAmount + custOutstanding;

  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    receiptFile: null
  });
  const [errors, setErrors] = useState({});

  const formatCurrency = amt => `₹${parseFloat(amt || 0).toLocaleString('en-IN')}`;

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

  // Handlers
  const handleAmountChange = value => {
    setPaymentData(pd => ({ ...pd, amount: value }));
    setErrors(err => ({ ...err, amount: '' }));
    const val = parseFloat(value || 0);
    if (val > maxAmountTotal) {
      setErrors(err => ({
        ...err,
        amount: `Cannot exceed ₹${maxAmountTotal.toFixed(2)} (order + outstanding)`
      }));
    }
  };

  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      return setErrors(err => ({ ...err, receipt: 'Please upload an image file' }));
    }
    if (file.size > 5 * 1024 * 1024) {
      return setErrors(err => ({ ...err, receipt: 'File size must be under 5MB' }));
    }
    setPaymentData(pd => ({ ...pd, receiptFile: file }));
    setErrors(err => ({ ...err, receipt: null }));
  };

  const validatePayment = () => {
    const newErr = {};
    const amt = parseFloat(paymentData.amount || 0);
    if (amt <= 0) newErr.amount = 'Amount must be > 0';
    if (amt > maxAmountTotal) newErr.amount = `Cannot exceed ₹${maxAmountTotal.toFixed(2)}`;
    if (['upi','bank_transfer'].includes(paymentData.paymentMethod)) {
      if (!paymentData.referenceNumber?.trim()) {
        newErr.referenceNumber = 'Reference required';
      }
    }
    setErrors(newErr);
    return !Object.keys(newErr).length;
  };

  const handleSubmit = () => {
    if (!validatePayment()) return;
    if (!safeCustomer.id) {
      setErrors(err => ({ ...err, customer: 'Customer missing' }));
      return;
    }
    const fd = new FormData();
    fd.append('customerId', safeCustomer.id);
    fd.append('amount', parseFloat(paymentData.amount));
    fd.append('paymentMethod', paymentData.paymentMethod);
    fd.append('notes', paymentData.notes || '');
    fd.append('orderId', order.id);
    if (paymentData.referenceNumber) fd.append('referenceNumber', paymentData.referenceNumber);
    if (paymentData.receiptFile) fd.append('receipt_image', paymentData.receiptFile);
    onPaymentSubmit(fd);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-3 pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="font-bold">Record Payment</div>
              <div className="text-sm text-gray-600">
                {safeCustomer.name || safeCustomer.customer_name || 'Unknown'} – Order #{order.order_number}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Order Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(orderAmount)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Customer Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(custOutstanding)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Amount input */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <IndianRupee className="h-5 w-5 text-green-600" />
              Payment Amount <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-2">
              <IndianRupee className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="number"
                step="0.01"
                className="pl-10 h-12 text-lg"
                value={paymentData.amount}
                onChange={e => handleAmountChange(e.target.value)}
              />
            </div>
            {errors.amount && (
              <div className="text-red-500 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {errors.amount}
              </div>
            )}
            <div className="text-sm text-gray-600">
              Max: {formatCurrency(maxAmountTotal)}
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleAmountChange(maxAmountTotal.toString())
                }
              >
                Full Amount
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment method & reference */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              value={paymentData.paymentMethod}
              onChange={e => setPaymentData(pd => ({
                ...pd,
                paymentMethod: e.target.value
              }))}
              className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
            {['upi','bank_transfer'].includes(paymentData.paymentMethod) && (
              <>
                <Input
                  placeholder="Reference Number"
                  value={paymentData.referenceNumber}
                  onChange={e => setPaymentData(pd => ({
                    ...pd,
                    referenceNumber: e.target.value
                  }))}
                  className={errors.referenceNumber ? 'border-red-300' : ''}
                />
                {errors.referenceNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.referenceNumber}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Receipt upload */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Upload Receipt (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center p-6">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="receipt-upload"
            />
            <label htmlFor="receipt-upload" className="cursor-pointer">
              <FileImage className="h-8 w-8 text-gray-400 mb-2" />
              <div className="text-sm text-gray-600">
                {paymentData.receiptFile
                  ? paymentData.receiptFile.name
                  : 'Click to upload receipt'}
              </div>
            </label>
            {errors.receipt && (
              <p className="text-red-500 text-xs mt-1">{errors.receipt}</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              rows={3}
              placeholder="Any notes..."
              value={paymentData.notes}
              onChange={e => setPaymentData(pd => ({
                ...pd, notes: e.target.value
              }))}
              className="w-full p-3 border rounded focus:ring-2 focus:ring-green-500"
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isLoading ||
              !paymentData.amount ||
              parseFloat(paymentData.amount) <= 0
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Record Payment
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
