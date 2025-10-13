import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  CreditCard, AlertCircle, IndianRupee,
  Calculator, CheckCircle, Loader2, Receipt, FileImage, User
} from 'lucide-react';

export default function PaymentCollectionDialog({
  isOpen,
  onClose,
  onPaymentSubmit,
  customer,
  bills = [],
  selectedBill: initialSelectedBill = null,
  isLoading = false
}) {

  // Internal state
  const [step, setStep] = useState(1);
  const [paymentType, setPaymentType] = useState(initialSelectedBill ? 'bill-specific' : 'general');
  const [selectedBill, setSelectedBill] = useState(initialSelectedBill);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    receiptFile: null
  });
  const [errors, setErrors] = useState({});

  // Calculate totals
  const totalOutstanding = bills.reduce(
    (sum, bill) => sum + parseFloat(bill.pending_amount || 0),
    0
  );
  const pendingBills = bills.filter(b => parseFloat(b.pending_amount || 0) > 0);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPaymentType(initialSelectedBill ? 'bill-specific' : 'general');
      setSelectedBill(initialSelectedBill);
      setPaymentData({
        amount: initialSelectedBill
          ? initialSelectedBill.pending_amount.toString()
          : '',
        paymentMethod: 'cash',
        referenceNumber: '',
        notes: '',
        receiptFile: null
      });
      setErrors({});
    }
  }, [isOpen, initialSelectedBill]);

  // Auto-fill amount for bill-specific
  useEffect(() => {
    if (paymentType === 'bill-specific' && selectedBill) {
      setPaymentData(pd => ({
        ...pd,
        amount: selectedBill.pending_amount.toString()
      }));
    }
  }, [paymentType, selectedBill]);

  const formatCurrency = amount =>
    `₹${parseFloat(amount || 0).toLocaleString('en-IN')}`;

  // Validation
  const validateForm = () => {
    const newErrors = {};
    const amt = parseFloat(paymentData.amount || 0);

    if (!amt || amt <= 0) {
      newErrors.amount = 'Please enter a valid payment amount';
    }
    if (paymentType === 'bill-specific' && !selectedBill) {
      newErrors.bill = 'Please select a bill to pay';
    }
    if (paymentType === 'general' && !bills.length) {
      newErrors.bills = 'No bills available for general payment';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // File upload
  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const maxSize = 5 * 1024 * 1024;
    const allowed = ['image/jpeg','image/png','application/pdf'];
    if (file.size > maxSize) {
      setErrors(err => ({ ...err, file: 'File must be under 5MB' }));
      return;
    }
    if (!allowed.includes(file.type)) {
      setErrors(err => ({ ...err, file: 'Only JPG, PNG, PDF allowed' }));
      return;
    }
    setPaymentData(pd => ({ ...pd, receiptFile: file }));
    setErrors(err => ({ ...err, file: null }));
  };

  // Submit
  const handleSubmit = () => {
    if (!validateForm()) return;
    const submission = {
      ...paymentData,
      amount: parseFloat(paymentData.amount),
      paymentType,
      selectedBill: paymentType === 'bill-specific' ? selectedBill : null,
      customerId: customer.id
    };
    onPaymentSubmit(submission);
  };

  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="space-y-3 pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="font-bold">Collect Payment</div>
              <div className="text-sm text-gray-600">
                {customer.name} – {customer.phone}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Outstanding Summary */}
        <Card className="border-green-200 bg-green-50 mb-6">
          <CardContent className="p-5 flex justify-between items-center">
            <div>
              <div className="text-sm text-gray-700">Total bill Amount</div>
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(selectedBill.pending_amount)}
              </div>
            </div>
            {selectedBill && (
              <div className="text-right">
                <div className="text-sm text-gray-700">Bill Pending</div>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(selectedBill.pending_amount)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Type Selection */}
        <div className="mb-4 flex gap-4">
          <Button
            variant={paymentType === 'bill-specific' ? 'solid' : 'outline'}
            onClick={() => setPaymentType('bill-specific')}
          >
            Bill-Specific
          </Button>
          <Button
            variant={paymentType === 'general' ? 'solid' : 'outline'}
            onClick={() => setPaymentType('general')}
          >
            General
          </Button>
        </div>

        {/* Bill Selection */}
        {paymentType === 'bill-specific' && (
          <Card className="border-blue-200 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
                Select Bill
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingBills.length ? pendingBills.map(b => (
                <div key={b.id} className="flex items-center gap-4 mb-2">
                  <input
                    type="radio"
                    checked={selectedBill?.id === b.id}
                    onChange={() => setSelectedBill(b)}
                  />
                  <div>
                    <div className="font-medium">{b.bill_number}</div>
                    <div className="text-sm text-gray-500">
                      Pending: {formatCurrency(b.pending_amount)}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-gray-500">No pending bills</div>
              )}
              {errors.bill && (
                <p className="text-red-500 text-xs mt-1">{errors.bill}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Amount & Receipt */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <IndianRupee className="h-5 w-5 text-green-600" />
                Payment Amount *
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
                  onChange={e => setPaymentData(pd => ({ ...pd, amount: e.target.value }))}
                />
              </div>
              {errors.amount && (
                <div className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {errors.amount}
                </div>
              )}
              <div className="text-sm text-gray-600">
                Max: {paymentType === 'bill-specific'
                  ? formatCurrency(selectedBill?.pending_amount)
                  : formatCurrency(totalOutstanding)}
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPaymentData(pd => ({
                    ...pd,
                    amount: (paymentType === 'bill-specific'
                      ? selectedBill?.pending_amount
                      : totalOutstanding
                    )?.toString() || ''
                  }))}
                >
                  Full Amount
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileImage className="h-5 w-5 text-purple-600" />
                Receipt (Optional)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center w-full">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="rcpt-upload"
                />
                <label htmlFor="rcpt-upload" className="cursor-pointer">
                  {paymentData.receiptFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <span className="text-green-600">{paymentData.receiptFile.name}</span>
                      <span className="text-xs text-gray-500">Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-gray-400" />
                      <span>Upload receipt</span>
                      <span className="text-xs text-gray-500">JPG/PNG/PDF &lt; 5MB</span>
                    </div>
                  )}
                </label>
                {errors.file && (
                  <div className="text-red-500 text-sm mt-2">{errors.file}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-600">
            {paymentData.amount && (
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                <span>Payment: {formatCurrency(paymentData.amount)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !paymentData.amount || parseFloat(paymentData.amount) <= 0}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
