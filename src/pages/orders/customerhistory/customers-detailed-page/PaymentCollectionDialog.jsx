import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import {
  CreditCard, AlertCircle, IndianRupee,
  Calculator, CheckCircle, Loader2, Receipt, FileImage
} from 'lucide-react';

export default function PaymentCollectionDialog({
  isOpen,
  onClose,
  onPaymentSubmit,
  customer,
  bills = [],
  selectedBill = null,
  isLoading = false
}) {
  // State management
  const [step, setStep] = useState(1); // 1: Payment Type, 2: Bill Selection, 3: Amount Distribution
  const [paymentType, setPaymentType] = useState(selectedBill ? 'bill-specific' : 'general');
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    receiptFile: null
  });
  const [selectedBillForPayment, setSelectedBillForPayment] = useState(selectedBill);
  const [selectedBillsForDistribution, setSelectedBillsForDistribution] = useState([]);
  const [errors, setErrors] = useState({});
  const [amountDistribution, setAmountDistribution] = useState({});

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN')}`;
  
  console.log('DEBUG selectedBill:', selectedBill);
  // Reset form when dialog opens/closes
  // useEffect(() => {
  //   if (isOpen) {
  //     console.log('DEBUG: PaymentCollectionDialog opened with:', {
  //       customer,
  //       bills: bills.length,
  //       selectedBill,
  //       billsData: bills,
  //       isTemporaryBill: selectedBill && selectedBill.id?.toString().startsWith('temp-')
  //     });
  //     setStep(1);
  //     setPaymentType(selectedBill ? 'bill-specific' : 'general');
  //     setPaymentData({
  //       amount: '',
  //       paymentMethod: 'cash',
  //       referenceNumber: '',
  //       notes: '',
  //       receiptFile: null
  //     });
  //     setSelectedBillForPayment(selectedBill);
  //     setSelectedBillsForDistribution([]);
  //     setAmountDistribution({});
  //     setErrors({});
  //   }
  // }, [isOpen, selectedBill]);

  // Calculate totals
  const totalOutstanding = bills.reduce((sum, bill) => sum + parseFloat(bill.pending_amount || 0), 0);
  const pendingBills = bills.filter(bill => parseFloat(bill.pending_amount || 0) > 0);

  const primaryAmount = parseFloat(selectedBill.pending_amount || 0);

  // Calculate remaining amount after payment
  const getRemainingAmount = () => {
    if (selectedBill) {
      const amount = parseFloat(paymentData.amount || 0);
      const pending = parseFloat(selectedBill.pending_amount || 0);
      return Math.max(0, pending - amount);
    }
    return 0;
  };

  // Handle amount changes with validation
  const handleAmountChange = (value) => {
    setPaymentData(prev => ({ ...prev, amount: value }));
    setErrors(prev => ({ ...prev, amount: '' }));

    // Real-time validation
    if (selectedBill) {
      const amount = parseFloat(value || 0);
      const maxAmount = parseFloat(selectedBill.pending_amount || 0);
      if (amount > maxAmount) {
        setErrors(prev => ({ ...prev, amount: `Amount cannot exceed ${formatCurrency(maxAmount)}` }));
      }
    }
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, receipt: 'Please upload an image file' }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, receipt: 'File size must be less than 5MB' }));
        return;
      }
      setPaymentData(prev => ({ ...prev, receiptFile: file }));
      setErrors(prev => ({ ...prev, receipt: '' }));
    }
  };

  // Validation function
  const validatePayment = () => {
    const newErrors = {};
    const amount = parseFloat(paymentData.amount || 0);

    if (amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (selectedBill) {
      const maxAmount = parseFloat(selectedBill.pending_amount || 0);
      if (amount > maxAmount) {
        newErrors.amount = `Amount cannot exceed ${formatCurrency(maxAmount)}`;
      }
    } else if (amount > primaryAmount) {
      newErrors.amount = `Amount cannot exceed ${formatCurrency(primaryAmount)}`;
    }

    if (paymentData.paymentMethod === 'upi' || paymentData.paymentMethod === 'bank_transfer') {
      if (!paymentData.referenceNumber.trim()) {
        newErrors.referenceNumber = 'Reference number is required for this payment method';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit payment
  const handleSubmit = async () => {
    if (!validatePayment()) return;

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('customerId', customer.id);
      formData.append('amount', parseFloat(paymentData.amount));
      formData.append('paymentMethod', paymentData.paymentMethod);
      formData.append('notes', paymentData.notes || '');

      if (paymentData.referenceNumber) {
        formData.append('referenceNumber', paymentData.referenceNumber);
      }

      if (selectedBill) {
        formData.append('billId', selectedBill.id);
      }

      if (paymentData.receiptFile) {
        formData.append('receipt_image', paymentData.receiptFile);
      }

      onPaymentSubmit(formData);
    } catch (error) {
      console.error('Error preparing payment data:', error);
    }
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
              <div className="font-bold">Collecttt Payment</div>
              <div className="text-sm font-normal text-gray-600">{customer?.name}</div>
            </div>
          </DialogTitle>
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div>
              <div className="text-sm text-gray-600">
                {selectedBill ? 'Bill Amount' : 'Total Outstanding'}
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(primaryAmount)}
              </div>
              {selectedBill && (
                <div className="text-xs text-gray-500 mt-1">
                  Payment for this order only
                </div>
              )}
            </div>
            {/* Debug info */}
            <div className="text-xs text-gray-400">
              Debug: {selectedBill ? 'Selected' : 'No'} bill | {primaryAmount === totalOutstanding ? 'Total' : 'Bill'} amount
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 ">
          {/* Top Row: Bill Details & Payment Method */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Bill Details */}
            {selectedBill && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-blue-600" />
                    Bill Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Bill Number</div>
                      <div className="font-semibold">{selectedBill.bill_number}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Bill Date</div>
                      <div className="font-semibold">{new Date(selectedBill.bill_date).toLocaleDateString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Amount</div>
                      <div className="font-semibold">{formatCurrency(selectedBill.total_amount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Pending Amount</div>
                      <div className="font-semibold text-red-600">{formatCurrency(selectedBill.pending_amount)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Right: Payment Method */}
            <Card className={selectedBill ? '' : 'lg:col-span-2'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={paymentData.paymentMethod}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm"
                >
                  <option value="cash">💵 Cash</option>
                  <option value="upi">📱 UPI</option>
                  <option value="card">💳 Card</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                  <option value="cheque">📄 Cheque</option>
                </select>

                {/* Reference Number (if needed) */}
                {(paymentData.paymentMethod === 'upi' || paymentData.paymentMethod === 'bank_transfer') && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reference Number</label>
                    <Input
                      placeholder="Enter transaction reference number"
                      value={paymentData.referenceNumber}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, referenceNumber: e.target.value }))}
                      className="h-10 border-2 focus:border-green-500"
                    />
                    {errors.referenceNumber && (
                      <div className="flex items-center gap-2 mt-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">{errors.referenceNumber}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Second Row: Payment Amount & Receipt Upload */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left: Payment Amount */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-green-600" />
                  Payment Amount *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type="number"
                      placeholder="Enter payment amount"
                      value={paymentData.amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      className="pl-12 h-12 text-lg font-semibold border-2 focus:border-green-500 bg-white"
                      step="0.01"
                      max={primaryAmount}
                      required
                    />
                  </div>
                  {errors.amount && (
                    <div className="flex items-center gap-2 mt-2 text-red-600">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{errors.amount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-gray-600">
                      Maximum: {formatCurrency(primaryAmount)} {selectedBill ? '(order amount)' : '(total outstanding)'}
                    </span>
                    {selectedBill && paymentData.amount && (
                      <span className="text-green-600 font-medium">
                        Remaining: {formatCurrency(getRemainingAmount())}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAmountChange(primaryAmount.toString())}
                    className="h-10"
                  >
                    Full Amount
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAmountChange((primaryAmount / 2).toString())}
                    className="h-10"
                  >
                    Half Amount
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Right: Receipt Upload */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-purple-600" />
                  Receipt Upload (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors h-32 flex items-center justify-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label htmlFor="receipt-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center gap-2">
                      {paymentData.receiptFile ? (
                        <>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                          <div className="text-sm font-medium text-green-600">
                            {paymentData.receiptFile.name}
                          </div>
                          <div className="text-xs text-gray-500">Click to change</div>
                        </>
                      ) : (
                        <>
                          <FileImage className="h-8 w-8 text-gray-400" />
                          <div className="text-sm font-medium text-gray-600">
                            Click to upload receipt
                          </div>
                          <div className="text-xs text-gray-500">PNG, JPG up to 5MB</div>
                        </>
                      )}
                    </div>
                  </label>
                </div>
                {errors.receipt && (
                  <div className="flex items-center gap-2 mt-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{errors.receipt}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Third Row: Notes (Full Width) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder="Add any notes about this payment..."
                value={paymentData.notes}
                onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none text-sm resize-none"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-6">
          <div className="text-sm text-gray-600">
            {paymentData.amount && (
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                <span>Payment: {formatCurrency(paymentData.amount)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
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
