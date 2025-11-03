import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  CreditCard, AlertCircle, IndianRupee,
  Calculator, CheckCircle, Loader2, Receipt, FileImage,
  Building, FileText, X
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export default function CatererBillPaymentCollectionDialog({
  isOpen,
  onClose,
  onSubmit,
  caterer,
  bills = [],
  selectedBill: initialSelectedBill = null,
  isLoading = false
}) {
  const { showSuccess, showError } = useToast();

  const [selectedBill, setSelectedBill] = useState(initialSelectedBill);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    receiptFile: null
  });
  const [errors, setErrors] = useState({});
  const [allBills, setAllBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Calculate totals
  const totalOutstanding = allBills.reduce(
    (sum, bill) => {
      const grand = parseFloat(bill.grand_total || 0);
      const paid = parseFloat(bill.total_paid || 0);
      return sum + Math.max(0, grand - paid);
    },
    0
  );

  const pendingBills = allBills.filter(b => {
    const grand = parseFloat(b.grand_total || 0);
    const paid = parseFloat(b.total_paid || 0);
    const pending = Math.max(0, grand - paid);
    return pending > 0;
  });

  const pendingAmount = selectedBill ? 
    Math.max(0, parseFloat(selectedBill.grand_total || 0) - parseFloat(selectedBill.total_paid || 0)) : 
    0;

  // ✅ FIX: Use bills prop directly instead of fetching
  useEffect(() => {
    if (isOpen && bills && Array.isArray(bills) && bills.length > 0) {
      const processedBills = bills.map(bill => ({
        ...bill,
        id: bill.id,
        bill_number: bill.bill_number,
        grand_total: parseFloat(bill.grand_total || 0),
        total_paid: parseFloat(bill.total_paid || 0),
        sell_date: bill.sell_date,
        items_count: bill.items_count || 0,
        caterer_name: bill.caterer_name || caterer?.caterer_name,
        caterer_phone: bill.caterer_phone || caterer?.phone_number || caterer?.caterer_phone || caterer?.phone || caterer?.contact_person
      })).filter(bill => {
        const pending = bill.grand_total - bill.total_paid;
        return pending > 0;
      });

      setAllBills(processedBills);

      // Auto-select first bill if none selected
      if (!initialSelectedBill && processedBills.length > 0) {
        const firstBill = processedBills[0];
        setSelectedBill(firstBill);
        const pending = firstBill.grand_total - firstBill.total_paid;
        setPaymentData({
          amount: pending.toString(),
          paymentMethod: 'cash',
          referenceNumber: '',
          notes: `Payment for bill ${firstBill.bill_number}`,
          receiptFile: null
        });
      }
    }
  }, [isOpen, bills, caterer, initialSelectedBill]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedBill(initialSelectedBill);
      if (initialSelectedBill) {
        const pending = parseFloat(initialSelectedBill.grand_total || 0) - parseFloat(initialSelectedBill.total_paid || 0);
        setPaymentData({
          amount: pending.toString(),
          paymentMethod: 'cash',
          referenceNumber: '',
          notes: `Payment for bill ${initialSelectedBill.bill_number}`,
          receiptFile: null
        });
      }
      setErrors({});
    }
  }, [isOpen, initialSelectedBill]);

  // Auto-fill amount when bill is selected
  useEffect(() => {
    if (selectedBill) {
      const pending = parseFloat(selectedBill.grand_total || 0) - parseFloat(selectedBill.total_paid || 0);
      setPaymentData(pd => ({
        ...pd,
        amount: pending.toString(),
        notes: `Payment for bill ${selectedBill.bill_number}`
      }));
    }
  }, [selectedBill]);

  const handleAmountChange = (value) => {
    setPaymentData(prev => ({ ...prev, amount: value }));
    setErrors(prev => ({ ...prev, amount: '' }));

    if (selectedBill && pendingAmount > 0) {
      const amount = parseFloat(value || 0);
      if (amount > pendingAmount) {
        setErrors(prev => ({ ...prev, amount: `Amount cannot exceed ${formatCurrency(pendingAmount)}` }));
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const validTypes = ["image/svg+xml", "image/png", "image/jpeg", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      showError("Invalid file type. Please upload an SVG, PNG, JPEG, or PDF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, receipt: 'File size must be less than 5MB' }));
      return;
    }
    setPaymentData(prev => ({ ...prev, receiptFile: file }));
    setErrors(prev => ({ ...prev, receipt: '' }));
  };

  const validatePayment = () => {
    const newErrors = {};
    const amount = parseFloat(paymentData.amount || 0);

    if (!selectedBill) {
      newErrors.bill = 'Please select a bill to pay';
    }
    if (amount <= 0) {
      newErrors.amount = 'Please enter a valid payment amount';
    }
    if (selectedBill && amount > pendingAmount) {
      newErrors.amount = `Amount cannot exceed ${formatCurrency(pendingAmount)}`;
    }
    if (paymentData.paymentMethod === 'upi' || paymentData.paymentMethod === 'bank_transfer') {
      if (!paymentData.referenceNumber.trim()) {
        newErrors.referenceNumber = 'Reference number is required for this payment method';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validatePayment()) return;

    try {
      const formData = new FormData();
      
      // ✅ FIX: Ensure valid caterer_phone (not 'undefined' string)
      const catererPhone = caterer?.phone_number || caterer?.caterer_phone || caterer?.phone || caterer?.contact_person || selectedBill?.caterer_phone;
      if (!catererPhone || catererPhone === 'undefined' || catererPhone === 'null') {
        showError('Caterer phone number is missing');
        return;
      }

      // ✅ FIX: Ensure valid caterer_id
      const catererId = caterer?.id || caterer?.caterer_id || selectedBill?.caterer_id;
      if (!catererId) {
        showError('Caterer ID is missing');
        return;
      }

      formData.append('caterer_phone', catererPhone);
      formData.append('caterer_name', caterer?.caterer_name || selectedBill?.caterer_name || 'Unknown');
      formData.append('caterer_id', catererId);
      formData.append('bill_id', selectedBill.id);
      formData.append('amount', paymentData.amount);
      formData.append('paymentMethod', paymentData.paymentMethod);
      formData.append('notes', paymentData.notes || '');

      if (paymentData.referenceNumber) {
        formData.append('referenceNumber', paymentData.referenceNumber);
      }

      if (paymentData.receiptFile) {
        formData.append('receipt_image', paymentData.receiptFile);
      }

      console.log('✅ Submitting payment:', {
        caterer_phone: catererPhone,
        caterer_id: catererId,
        bill_id: selectedBill.id,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod
      });

      if (typeof onSubmit === 'function') {
        await onSubmit(formData);
      } else {
        console.error('onSubmit is not a function:', typeof onSubmit);
        throw new Error('Payment submission handler not provided');
      }
    } catch (error) {
      console.error('Error preparing payment data:', error);
      showError(error.message || 'Failed to prepare payment data');
    }
  };

  if (!caterer) {
    console.error('No caterer data provided to payment dialog');
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Building className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Collect Caterer Payment</h2>
                <p className="text-green-100 mt-1">
                  {caterer.caterer_name} • {caterer.phone_number || caterer.caterer_phone || caterer.phone || caterer.contact_person || 'No phone number'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="p-6 grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-700">
              <Calculator className="h-5 w-5" />
              <span className="text-sm font-medium">Total Outstanding</span>
            </div>
            <div className="text-2xl font-bold text-green-800 mt-2">
              {formatCurrency(totalOutstanding)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <FileText className="h-5 w-5" />
              <span className="text-sm font-medium">Pending Bills</span>
            </div>
            <div className="text-2xl font-bold text-blue-800 mt-2">
              {pendingBills.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-purple-700">
              <CreditCard className="h-5 w-5" />
              <span className="text-sm font-medium">Payment Methods</span>
            </div>
            <div className="text-2xl font-bold text-purple-800 mt-2">5</div>
          </div>
        </div>

        {/* Bill Selection */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Select Bill to Pay</h3>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Bill *
              </label>
              
              <Select
                value={selectedBill?.id || ''}
                onValueChange={(value) => {
                  const selected = pendingBills.find(bill => String(bill.id) === String(value));
                  if (selected) {
                    setSelectedBill(selected);
                    const pending = selected.grand_total - selected.total_paid;
                    setPaymentData(prev => ({
                      ...prev,
                      amount: pending.toString(),
                      notes: `Payment for bill ${selected.bill_number}`
                    }));
                  }
                }}
                disabled={pendingBills.length === 0}
              >
                <SelectTrigger className="h-12 border-2 border-gray-200 focus:border-green-500 focus:ring-2 focus:ring-green-200">
                  <SelectValue placeholder={pendingBills.length === 0 ? "No pending bills available" : "Select a bill to pay"} />
                </SelectTrigger>
                <SelectContent>
                  {pendingBills.map(bill => {
                    const displayPending = bill.grand_total - bill.total_paid;
                    return (
                      <SelectItem key={bill.id} value={String(bill.id)}>
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-medium">{bill.bill_number}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(bill.sell_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold text-green-600">
                              {formatCurrency(displayPending)}
                            </div>
                            <div className="text-xs text-gray-500">
                              of {formatCurrency(bill.grand_total)}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })}</SelectContent>
              </Select>
            </div>

            {selectedBill && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Bill Details</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Bill Number:</span>
                    <span className="ml-2 font-medium">{selectedBill.bill_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Bill Date:</span>
                    <span className="ml-2">{new Date(selectedBill.sell_date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="ml-2 font-medium">{formatCurrency(selectedBill.grand_total)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Already Paid:</span>
                    <span className="ml-2 font-medium text-blue-600">{formatCurrency(selectedBill.total_paid)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Pending Amount:</span>
                    <span className="ml-2 font-bold text-green-600 text-lg">{formatCurrency(pendingAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {errors.bill && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{errors.bill}</span>
              </div>
            </div>
          )}
        </div>

        {/* Amount & Receipt - Two Column Grid */}
        <div className="px-6 grid md:grid-cols-2 gap-6 mb-6">
          {/* Payment Amount */}
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
                  onChange={(e) => handleAmountChange(e.target.value)}
                  disabled={!selectedBill}
                />
              </div>
              {errors.amount && (
                <div className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> {errors.amount}
                </div>
              )}
              {selectedBill && (
                <div className="text-sm text-gray-600">
                  Max: {formatCurrency(pendingAmount)}
                </div>
              )}
              {selectedBill && (
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAmountChange(pendingAmount.toString())}
                  >
                    Full Amount
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAmountChange((pendingAmount / 2).toString())}
                  >
                    Half Amount
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Receipt Upload */}
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
                  id="receipt-upload"
                />
                <label htmlFor="receipt-upload" className="cursor-pointer">
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
                {errors.receipt && (
                  <div className="text-red-500 text-sm mt-2">{errors.receipt}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method & Notes */}
        <div className="px-6 grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <select
                value={paymentData.paymentMethod}
                onChange={(e) => setPaymentData(pd => ({
                  ...pd,
                  paymentMethod: e.target.value
                }))}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="cash">💵 Cash</option>
                <option value="upi">📱 UPI</option>
                <option value="card">💳 Card</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="cheque">📄 Cheque</option>
              </select>
              
              {(paymentData.paymentMethod === 'upi' || paymentData.paymentMethod === 'bank_transfer') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Number
                  </label>
                  <Input
                    placeholder="Enter transaction reference number"
                    value={paymentData.referenceNumber}
                    onChange={(e) => setPaymentData(pd => ({
                      ...pd,
                      referenceNumber: e.target.value
                    }))}
                    className={errors.referenceNumber ? 'border-red-300' : ''}
                  />
                  {errors.referenceNumber && (
                    <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.referenceNumber}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Payment Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                placeholder="Add any notes about this payment..."
                value={paymentData.notes}
                onChange={(e) => setPaymentData(pd => ({
                  ...pd, notes: e.target.value
                }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
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
              disabled={
                isLoading ||
                !selectedBill ||
                !paymentData.amount ||
                parseFloat(paymentData.amount) <= 0
              }
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
