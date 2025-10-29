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
  XMarkIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import PaymentDialog from '../suppliers/PaymentDialog';
import { useToast } from '../../contexts/ToastContext';

const CatererBillCard = ({ bill, onPaymentUpdate }) => {
  const { showError } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentReceiptImage, setCurrentReceiptImage] = useState(null);
  const [receiptTitle, setReceiptTitle] = useState('');
  const [expandedMixItems, setExpandedMixItems] = useState({});

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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
    }).format(amount || 0);
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
      case 'partial':
      case 'overdue':
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

  const toggleMixItem = (e, index) => {
    e.stopPropagation(); // Prevent parent card collapse
    setExpandedMixItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Check if an item is a mix product
  const isMixProduct = (item) => {
    if (item.is_mix === true || item.is_mix === 1) {
      return true;
    }
    if (item.mix_items && Array.isArray(item.mix_items) && item.mix_items.length > 0) {
      return true;
    }
    return false;
  };

  // Safety check for bill data
  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Invalid bill data</p>
      </div>
    );
  }

  // Calculate pending amount safely
  const grandTotal = parseFloat(bill.grand_total || 0);
  const totalPaid = parseFloat(bill.total_paid || 0);
  const pendingAmount = grandTotal - totalPaid;

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
                    {bill.bill_number || 'N/A'}
                  </h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(bill.payment_status)}`}>
                    {getStatusIcon(bill.payment_status)}
                    <span className="ml-1 capitalize">
                      {bill.payment_status === 'paid' ? 'Paid' : 
                       bill.payment_status === 'pending' ? 'Pending' :
                       bill.payment_status === 'partial' ? 'Partial' :
                       bill.payment_status === 'overdue' ? 'Overdue' : bill.payment_status}
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
                    {formatDate(bill.sell_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center justify-end space-x-2 mb-1">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(grandTotal)}
                </div>
              </div>
              {bill.payment_status !== 'paid' && pendingAmount > 0 && (
                <div className="text-sm text-red-600">
                  Pending: {formatCurrency(pendingAmount)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200">
            <div className="p-6 space-y-6">
              {/* Sale Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Sale Information
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Bill Number:</span>
                      <span className="ml-2 text-gray-900">{bill.bill_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Sale Date:</span>
                      <span className="ml-2 text-gray-900">{formatDate(bill.sell_date)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Payment Status:</span>
                      <span className="ml-2 text-gray-900 capitalize">{bill.payment_status || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Items Count:</span>
                      <span className="ml-2 text-gray-900">{bill.items_count || 0}</span>
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

              {/* Sale Items */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Sale Items
                </h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="space-y-3">
                    {(bill.items && Array.isArray(bill.items) && bill.items.length > 0) ? bill.items.map((item, index) => (
                      <div key={index} className="border-b border-gray-200 last:border-b-0 pb-3 last:pb-0">
                        {/* Main Item Row - Wrapped in div to prevent event bubbling */}
                        <div 
                          className="flex justify-between items-start text-sm"
                          onClick={(e) => {
                            // Only toggle if it's a mix product
                            if (isMixProduct(item)) {
                              toggleMixItem(e, index);
                            }
                          }}
                        >
                          <div className="flex-1 flex items-start">
                            {/* Expand/Collapse button for mix products */}
                            <div className="flex items-center min-w-[24px] pt-0.5">
                              {isMixProduct(item) ? (
                                <button
                                  onClick={(e) => toggleMixItem(e, index)}
                                  className="text-orange-500 hover:text-orange-700 transition-colors cursor-pointer"
                                  title="Click to view mix contents"
                                >
                                  {expandedMixItems[index] ? (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-4"></div>
                              )}
                            </div>

                            <div className="ml-2 flex-1">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-medium text-gray-900">
                                  {item.product_name || 'Unknown Product'}
                                </span>
                                {isMixProduct(item) && (
                                  <span className="inline-flex items-center text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                                    <CubeIcon className="h-3 w-3 mr-1" />
                                    Mix ({item.mix_items?.length || 0})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">
                                {item.quantity || 0} {item.unit || 'unit'} × ₹{parseFloat(item.rate || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          <div className="text-right ml-4">
                            <div className="font-semibold text-gray-900">
                              ₹{parseFloat(item.total_amount || 0).toFixed(2)}
                            </div>
                            {parseFloat(item.gst_amount || 0) > 0 && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                GST: ₹{parseFloat(item.gst_amount || 0).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Mix Items */}
                        {isMixProduct(item) && expandedMixItems[index] && (
                          <div 
                            className="ml-6 mt-3 bg-orange-50 rounded-lg p-3 border border-orange-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-xs font-semibold text-orange-900 mb-2 flex items-center">
                              <CubeIcon className="h-3.5 w-3.5 mr-1.5" />
                              Mix Contents ({item.mix_items?.length || 0} items)
                            </div>
                            <div className="space-y-2">
                              {item.mix_items && item.mix_items.length > 0 ? (
                                item.mix_items.map((mixItem, mixIndex) => (
                                  <div 
                                    key={mixIndex} 
                                    className="flex justify-between items-start text-xs bg-white rounded p-2.5 border border-orange-100"
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {mixItem.product_name || 'Unknown Product'}
                                      </div>
                                      <div className="text-orange-700 mt-0.5 space-x-2">
                                        <span>{parseFloat(mixItem.quantity || 0).toFixed(3)} {mixItem.unit || 'unit'}</span>
                                        {mixItem.batch_number && (
                                          <span className="text-orange-600">
                                            • Batch: {mixItem.batch_number}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right ml-3">
                                      <div className="font-semibold text-orange-700">
                                        ₹{parseFloat(mixItem.allocatedBudget || 0).toFixed(2)}
                                      </div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">
                                        @ ₹{parseFloat(mixItem.rate || 0).toFixed(2)}/{mixItem.unit || 'unit'}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-orange-600 text-center py-3 bg-white rounded">
                                  No mix items available
                                </div>
                              )}
                            </div>
                            {item.batch_number && (
                              <div className="mt-2 pt-2 border-t border-orange-200 text-xs text-orange-700">
                                <span className="font-medium">Mix Batch:</span> {item.batch_number}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500 text-center py-4">
                        No items found
                      </div>
                    )}
                  </div>
                  
                  {/* Bill Summary */}
                  <div className="border-t border-gray-200 mt-4 pt-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Items Total:</span>
                      <span>₹{parseFloat(bill.items_total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>GST:</span>
                      <span>₹{parseFloat(bill.total_gst || 0).toFixed(2)}</span>
                    </div>
                    {/* Other Charges */}
                    {(bill.other_charges && Array.isArray(bill.other_charges) && bill.other_charges.length > 0) ? (
                      <>
                        {bill.other_charges.map((charge, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{charge.charge_name || 'Charge'}:</span>
                            <span>
                              {charge.charge_type === 'percentage'
                                ? `${charge.charge_amount}% (₹${parseFloat((bill.items_total || 0) * charge.charge_amount / 100).toFixed(2)})`
                                : `₹${parseFloat(charge.charge_amount || 0).toFixed(2)}`
                              }
                            </span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-medium">
                          <span>Other Charges Total:</span>
                          <span>₹{parseFloat(bill.other_charges_total || 0).toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Other Charges:</span>
                        <span>₹0.00</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-300 pt-1">
                      <span>Grand Total:</span>
                      <span>₹{parseFloat(bill.grand_total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                  <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                  Payment Information
                </h4>
                
                {bill.payment_status === 'pending' && (!bill.payments || bill.payments.length === 0) ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-800">
                          No payments recorded yet
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Created on {formatDate(bill.created_at)}
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
                              {formatCurrency(parseFloat(payment.payment_amount || 0))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right text-sm text-gray-600">
                              <div className="flex items-center">
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                {formatDate(payment.payment_date)}
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
                                  `http://localhost:5000/api/caterer-sales/receipts/${payment.receipt_image}`,
                                  `Payment Receipt - ${formatCurrency(parseFloat(payment.payment_amount || 0))}`
                                )}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="View Payment Receipt"
                              >
                                <EyeIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
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

                    {bill.payment_status !== 'paid' && pendingAmount > 0 && (
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
