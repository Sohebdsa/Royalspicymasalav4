import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CurrencyRupeeIcon,
  CalendarIcon,
  ClockIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
  DocumentCheckIcon,
  UserIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  PhotoIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import PaymentDialog from '../suppliers/PaymentDialog';

const CatererBillCard = ({ bill, onPaymentUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceiptImage, setCurrentReceiptImage] = useState(null);
  const [receiptTitle, setReceiptTitle] = useState('');

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partial':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'pending':
        return <ExclamationCircleIcon className="h-4 w-4" />;
      case 'partial':
        return <ExclamationCircleIcon className="h-4 w-4" />;
      case 'overdue':
        return <ExclamationCircleIcon className="h-4 w-4" />;
      case 'cancelled':
        return <ExclamationCircleIcon className="h-4 w-4" />;
      default:
        return <ExclamationCircleIcon className="h-4 w-4" />;
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'cash':
        return <BanknotesIcon className="h-4 w-4" />;
      case 'upi':
        return <DevicePhoneMobileIcon className="h-4 w-4" />;
      case 'bank_transfer':
        return <BuildingLibraryIcon className="h-4 w-4" />;
      case 'cheque':
        return <DocumentCheckIcon className="h-4 w-4" />;
      case 'card':
        return <CreditCardIcon className="h-4 w-4" />;
      default:
        return <EllipsisHorizontalIcon className="h-4 w-4" />;
    }
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      cash: 'Cash',
      upi: 'UPI',
      bank_transfer: 'Bank Transfer',
      cheque: 'Cheque',
      card: 'Card',
      other: 'Other'
    };
    return labels[method] || method;
  };

  const handleCollectPayment = () => {
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    onPaymentUpdate();
  };

  const handleViewReceipt = (imageUrl, title) => {
    setCurrentReceiptImage(imageUrl);
    setReceiptTitle(title);
    setShowReceiptModal(true);
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setCurrentReceiptImage(null);
    setReceiptTitle('');
  };

  // Safety check for bill data
  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Invalid bill data</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header - Always Visible */}
        <div 
          className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button className="text-gray-400 hover:text-gray-600">
                {isExpanded ? (
                  <ChevronDownIcon className="h-5 w-5" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5" />
                )}
              </button>
              
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {bill.bill_number}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(bill.status)}`}>
                    {getStatusIcon(bill.status)}
                    <span className="ml-1 capitalize">
                      {bill.status === 'paid' ? 'Paid' : 
                       bill.status === 'pending' ? 'Pending' :
                       bill.status === 'partial' ? 'Partial' :
                       bill.status === 'overdue' ? 'Overdue' : bill.status}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-1" />
                    {bill.caterer_name || 'Unknown Caterer'}
                  </span>
                  <span className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {bill.bill_date ? formatDate(bill.bill_date) : 'No Date'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end space-x-2 mb-1">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(parseFloat(bill.total_amount || 0))}
                </div>
                {bill.receipt_image && (
                  <button
                    onClick={() => handleViewReceipt(
                      `http://localhost:5000/api/caterer-orders/receipts/${bill.receipt_image}`,
                      `Bill Receipt - ${bill.bill_number}`
                    )}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View Bill Receipt"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
              {bill.status !== 'paid' && parseFloat(bill.pending_amount || 0) > 0 && (
                <div className="text-sm text-red-600">
                  Pending: {formatCurrency(parseFloat(bill.pending_amount || 0))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200">
            <div className="p-6 space-y-6">
              {/* Order Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Order Information
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Order Number:</span>
                      <span className="ml-2 text-gray-900">{bill.order_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Bill Date:</span>
                      <span className="ml-2 text-gray-900">{bill.bill_date ? formatDate(bill.bill_date) : 'N/A'}</span>
                    </div>
                    {bill.due_date && (
                      <div>
                        <span className="font-medium text-gray-700">Due Date:</span>
                        <span className="ml-2 text-gray-900">{formatDate(bill.due_date)}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className="ml-2 text-gray-900 capitalize">{bill.status}</span>
                    </div>
                  </div>
                  {bill.notes && (
                    <div className="mt-3">
                      <span className="font-medium text-gray-700">Notes:</span>
                      <p className="mt-1 text-gray-600 text-sm">{bill.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Summary */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                  Bill Summary
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(parseFloat(bill.subtotal || 0))}</span>
                    </div>
                    {bill.tax_amount && parseFloat(bill.tax_amount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Tax:</span>
                        <span>{formatCurrency(parseFloat(bill.tax_amount || 0))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium border-t border-gray-300 pt-2">
                      <span>Total Amount:</span>
                      <span>{formatCurrency(parseFloat(bill.total_amount || 0))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Paid Amount:</span>
                      <span className="text-green-600">{formatCurrency(parseFloat(bill.paid_amount || 0))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>Pending Amount:</span>
                      <span className={parseFloat(bill.pending_amount || 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(parseFloat(bill.pending_amount || 0))}
                      </span>
                    </div>
                    {bill.receipt_image && (
                      <div className="flex justify-between text-xs text-gray-500 pt-2">
                        <span className="flex items-center">
                          <PhotoIcon className="h-3 w-3 mr-1" />
                          Bill Receipt Available
                        </span>
                        <button
                          onClick={() => handleViewReceipt(
                            `http://localhost:5000/api/caterer-orders/receipts/${bill.receipt_image}`,
                            `Bill Receipt - ${bill.bill_number}`
                          )}
                          className="text-orange-600 hover:text-orange-700 font-medium"
                        >
                          View
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                  Payment Information
                </h4>
                
                {bill.status === 'pending' && (!bill.payments || bill.payments.length === 0) ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-800">
                          No payments recorded yet
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Created on {bill.created_at ? formatDate(bill.created_at) : 'Unknown date'}
                        </p>
                      </div>
                      <button
                        onClick={handleCollectPayment}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Collect Payment
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(bill.payments && Array.isArray(bill.payments) && bill.payments.length > 0) ? bill.payments.map((payment) => (
                      <div key={payment.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center text-gray-600">
                              {getPaymentMethodIcon(payment.payment_method)}
                              <span className="ml-2 text-sm font-medium">
                                {getPaymentMethodLabel(payment.payment_method)}
                              </span>
                            </div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatCurrency(parseFloat(payment.amount || 0))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right text-sm text-gray-600">
                              <div className="flex items-center">
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                {payment.payment_date ? formatDate(payment.payment_date) : 'No Date'}
                              </div>
                              {payment.payment_time && (
                                <div className="flex items-center mt-1">
                                  <ClockIcon className="h-4 w-4 mr-1" />
                                  {formatTime(payment.payment_time)}
                                </div>
                              )}
                            </div>
                            {payment.receipt_image && (
                              <button
                                onClick={() => handleViewReceipt(
                                  `http://localhost:5000/api/caterer-orders/receipts/${payment.receipt_image}`,
                                  `Payment Receipt - ${formatCurrency(parseFloat(payment.amount || 0))}`
                                )}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="View Payment Receipt"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        {payment.reference_number && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Reference:</span> {payment.reference_number}
                          </div>
                        )}
                        {payment.notes && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Note:</span> {payment.notes}
                          </div>
                        )}
                        {payment.receipt_image && (
                          <div className="mt-2 text-xs text-gray-500 flex items-center">
                            <PhotoIcon className="h-3 w-3 mr-1" />
                            <span>Receipt attached</span>
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No payment records found
                      </div>
                    )}

                    {bill.status !== 'paid' && parseFloat(bill.pending_amount || 0) > 0 && (
                      <div className="flex justify-end">
                        <button
                          onClick={handleCollectPayment}
                          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                          Collect Payment
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        bill={bill}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <PhotoIcon className="h-5 w-5 mr-2" />
                {receiptTitle}
              </h2>
              <button
                onClick={closeReceiptModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
              {currentReceiptImage ? (
                <div className="flex justify-center">
                  <img
                    src={currentReceiptImage}
                    alt={receiptTitle}
                    className="max-w-full h-auto rounded-lg shadow-sm border border-gray-200"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <div className="hidden text-center py-12">
                    <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Receipt image could not be loaded</p>
                    <p className="text-sm text-gray-500 mt-1">The image may have been moved or deleted</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No receipt image available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CatererBillCard;