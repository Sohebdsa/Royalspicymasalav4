import { useMemo, useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
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
  CubeIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline';
import CatererBillPaymentCollectionDialog from './CatererBillPaymentCollectionDialog';
import CatererBillCardModal from './CatererBillCardModal';
import { useToast } from '../../contexts/ToastContext';

// Constants
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const RECEIPTS_BASE = '/caterers/assets/receipts';

// Utility Functions
const toReceiptUrl = (val) => {
  if (!val) return '';
  if (/^https?:\/\//i.test(val)) return val;

  if (val.startsWith(RECEIPTS_BASE)) {
    return API_BASE ? `${API_BASE}${val}` : val;
  }

  if (val.startsWith('/caterers/assets/reciepts') || val.startsWith('/caterers/assets/receipts') || val.startsWith('/uploads/receipts/')) {
    return API_BASE ? `${API_BASE}${val}` : val;
  }

  if (!val.startsWith('/')) {
    return API_BASE ? `${API_BASE}${RECEIPTS_BASE}/${val}` : `${RECEIPTS_BASE}/${val}`;
  }

  return API_BASE ? `${API_BASE}${val}` : val;
};

const rupee = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(parseFloat(v || 0));

const CatererBillCard = ({ bill, onPaymentUpdate }) => {
  const { showSuccess, showError, showInfo } = useToast();

  // State Management
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMix, setExpandedMix] = useState({});
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedBillForPayment, setSelectedBillForPayment] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Computed Values
  const grandTotal = useMemo(() => parseFloat(bill?.grand_total || 0), [bill]);
  const totalPaid = useMemo(() => parseFloat(bill?.total_paid || 0), [bill]);
  const pendingAmount = useMemo(() => Math.max(grandTotal - totalPaid, 0), [grandTotal, totalPaid]);

  // Date/Time Formatting
  const formatDate = useCallback((d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const formatTime = useCallback((t) => {
    if (!t) return '';
    return new Date(`2000-01-01T${t}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  // Status Badge Component
  const getStatusPill = (status) => {
    let actualStatus = status;

    if (pendingAmount <= 0) {
      actualStatus = 'paid';
    } else if (totalPaid <= 0) {
      actualStatus = 'pending';
    } else if (totalPaid > 0 && pendingAmount > 0) {
      actualStatus = 'partial';
    }

    const statusConfig = {
      paid: { class: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircleIcon },
      pending: { class: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: ExclamationCircleIcon },
      partial: { class: 'bg-blue-100 text-blue-800 border-blue-200', icon: ExclamationCircleIcon },
      overdue: { class: 'bg-red-100 text-red-800 border-red-200', icon: ExclamationCircleIcon },
      cancelled: { class: 'bg-red-100 text-red-800 border-red-200', icon: ExclamationCircleIcon }
    };

    const config = statusConfig[actualStatus] || { class: 'bg-gray-100 text-gray-800 border-gray-200', icon: ExclamationCircleIcon };
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.class}`}>
        <Icon className="h-4 w-4" />
        <span className="ml-1 capitalize">{actualStatus || 'unknown'}</span>
      </span>
    );
  };

  // Payment Method Icons
  const getPaymentIcon = (method) => {
    const icons = {
      cash: BanknotesIcon,
      upi: DevicePhoneMobileIcon,
      bank_transfer: BuildingLibraryIcon,
      cheque: DocumentCheckIcon,
      card: CreditCardIcon
    };
    const Icon = icons[method] || EllipsisHorizontalIcon;
    return <Icon className="h-4 w-4" />;
  };

  // Mix Product Detection
  const isMixProduct = (item) => {
    const hasFlag = item?.is_mix === true || item?.is_mix === 1;
    const hasChildren = Array.isArray(item?.mix_items) && item?.mix_items.length > 0;
    const result = hasFlag && hasChildren;

    // Debug logging
    if (item?.product_name?.toLowerCase().includes('mix')) {
      console.log('🔍 Mix Product Detection:', {
        product_name: item?.product_name,
        is_mix: item?.is_mix,
        hasFlag,
        mix_items_length: item?.mix_items?.length,
        hasChildren,
        result,
        full_item: item
      });
    }

    return result;
  };

  // Event Handlers
  const toggleBill = () => {
    if (isExpanded) setExpandedMix({});
    setIsExpanded((p) => !p);
  };

  const toggleMix = (e, key) => {
    e?.stopPropagation();
    e?.preventDefault();
    console.log('🔄 Toggling mix:', key, 'Current state:', expandedMix[key]);
    setExpandedMix((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCollectPayment = () => {
    setSelectedBillForPayment(bill);
    setShowPaymentDialog(true);
  };

  const openReceipts = (paymentReceipts) => {
    if (Array.isArray(paymentReceipts) && paymentReceipts.length > 0) {
      setReceipts(paymentReceipts);
      setShowReceiptModal(true);
    }
  };

  const handlePaymentSubmit = async (formData) => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch(`${API_BASE}/api/caterer-payments/create`, {
        method: 'POST',
        body: formData
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || `Server error: ${response.status}`);
      }

      if (result.success) {
        showSuccess('Payment recorded successfully');
        setShowPaymentDialog(false);
        setSelectedBillForPayment(null);
        onPaymentUpdate?.();
      } else {
        throw new Error(result.error || result.message || 'Failed to record payment');
      }
    } catch (error) {
      showError(error.message || 'Failed to record payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const openSingleReceipt = (url, title) => {
    const normalizedUrl = toReceiptUrl(url);
    setReceipts([{ url: normalizedUrl, title }]);
    setShowReceiptModal(true);
  };

  const copyBillNumber = async () => {
    try {
      await navigator.clipboard.writeText(bill?.bill_number || '');
      showSuccess('Bill number copied to clipboard');
    } catch (error) {
      showError('Failed to copy bill number');
    }
  };

  // Early Return for Invalid Data
  if (!bill) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-500">Invalid bill data</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
        {/* Header - Collapsible */}
        <div
          role="button"
          tabIndex={0}
          onClick={toggleBill}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleBill();
            }
          }}
          className="w-full text-left p-5 hover:bg-gray-50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-expanded={isExpanded}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isExpanded ? (
                <ChevronDownIcon className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronRightIcon className="h-5 w-5 text-gray-500" />
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{bill?.bill_number || 'N/A'}</h3>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyBillNumber();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      title="Copy bill number"
                      aria-label={`Copy bill number ${bill?.bill_number}`}
                    >
                      <DocumentDuplicateIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {getStatusPill(bill?.payment_status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center">
                    <UserIcon className="h-4 w-4 mr-1" />
                    {bill?.caterer_name || 'Unknown Caterer'}
                  </span>
                  <span className="flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1" />
                    {formatDate(bill?.sell_date)}
                  </span>
                  <span className="hidden md:flex items-center">
                    <DocumentTextIcon className="h-4 w-4 mr-1" />
                    {bill?.items_count || 0} items
                  </span>
                  {bill?.caterer_phone && (
                    <span className="flex items-center">
                      <DevicePhoneMobileIcon className="h-4 w-4 mr-1" />
                      {bill.caterer_phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">{rupee(grandTotal)}</div>
              {bill?.payment_status !== 'paid' && pendingAmount > 0 && (
                <div className="text-sm text-red-600">Pending: {rupee(pendingAmount)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-5 space-y-6">
            {/* Sale Information Section */}
            <section>
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Sale Information
              </h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex">
                    <dt className="text-gray-600 w-36">Bill Number</dt>
                    <dd className="text-gray-900">{bill?.bill_number || 'N/A'}</dd>
                  </div>
                  <div className="flex">
                    <dt className="text-gray-600 w-36">Sale Date</dt>
                    <dd className="text-gray-900">{formatDate(bill?.sell_date)}</dd>
                  </div>
                  <div className="flex">
                    <dt className="text-gray-600 w-36">Payment</dt>
                    <dd className="text-gray-900 capitalize">{bill?.payment_status || 'unknown'}</dd>
                  </div>
                  <div className="flex">
                    <dt className="text-gray-600 w-36">Items Count</dt>
                    <dd className="text-gray-900">{bill?.items_count || 0}</dd>
                  </div>
                </dl>
                {bill?.notes && (
                  <p className="mt-3 text-sm text-gray-700">{bill?.notes}</p>
                )}
              </div>
            </section>

            {/* Sale Items Section */}
            <section>
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Sale Items
              </h4>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                {Array.isArray(bill?.items) && bill.items.length > 0 ? (
                  bill.items.map((item, idx) => {
                    const key = item?.id ?? `item-${bill.id}-${idx}`;
                    const mix = isMixProduct(item);
                    const open = !!expandedMix[key];

                    return (
                      <div
                        key={key}
                        className={`rounded-lg bg-white border-2 transition-all duration-200 ${mix
                          ? open
                            ? 'border-orange-300 shadow-md'
                            : 'border-orange-200 hover:border-orange-300 hover:shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 flex items-start gap-2">
                              {/* Mix Toggle Button - More Prominent */}
                              {mix ? (
                                <button
                                  type="button"
                                  onClick={(e) => toggleMix(e, key)}
                                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md bg-orange-100 text-orange-600 hover:bg-orange-200 hover:text-orange-700 transition-colors"
                                  aria-expanded={open}
                                  aria-controls={`mix-${key}`}
                                  title={open ? "Collapse mix contents" : "Expand mix contents"}
                                >
                                  {open ? (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-6" />
                              )}

                              {/* Product Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-gray-900">{item?.product_name || 'Unknown Product'}</span>
                                  {mix && (
                                    <span className="inline-flex items-center text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium border border-orange-200">
                                      <CubeIcon className="h-3 w-3 mr-1" />
                                      Mix ({item?.mix_items?.length} items)
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">
                                  {parseFloat(item?.quantity || 0).toFixed(3)} {item?.unit || 'unit'} × {rupee(item?.rate || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-right flex-shrink-0 ml-3">
                              <div className="font-semibold text-gray-900">{rupee(item?.total_amount || 0)}</div>
                              {parseFloat(item?.gst_amount || 0) > 0 && (
                                <div className="text-xs text-gray-500">GST: {rupee(item?.gst_amount || 0)}</div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mix Items Expansion - Enhanced with Animation */}
                        {mix && open && (
                          <div
                            id={`mix-${key}`}
                            className="border-t-2 border-orange-200 bg-gradient-to-b from-orange-50 to-orange-50/50 animate-in slide-in-from-top-2 duration-200"
                          >
                            <div className="px-4 py-2.5 border-b border-orange-200 bg-orange-100/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center text-xs font-semibold text-orange-900">
                                  <CubeIcon className="h-4 w-4 mr-1.5" />
                                  Mix Contents
                                </div>
                                <span className="text-xs text-orange-700 font-medium">
                                  {item?.mix_items?.length || 0} component{item?.mix_items?.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>

                            <div className="divide-y divide-orange-200/50">
                              {Array.isArray(item?.mix_items) && item.mix_items.length > 0 ? (
                                item.mix_items.map((m, mIdx) => (
                                  <div
                                    key={`mix-${key}-${mIdx}`}
                                    className="px-4 py-3 flex items-start justify-between hover:bg-orange-100/30 transition-colors"
                                  >
                                    <div className="pr-3 flex items-start flex-1 gap-2.5">
                                      {/* Numbered badge for mix items */}
                                      <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-semibold shadow-sm">
                                        {mIdx + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 text-sm">{m?.product_name || 'Unknown'}</div>
                                        <div className="text-xs text-orange-700 mt-1 flex flex-wrap items-center gap-2">
                                          <span className="font-medium">
                                            {parseFloat(m?.quantity || 0).toFixed(3)} {m?.unit || 'unit'}
                                          </span>
                                          {m?.batch_number && (
                                            <span className="text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                                              Batch: {m?.batch_number}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                      <div className="font-semibold text-orange-700 text-sm">{rupee(m?.allocatedBudget || 0)}</div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">
                                        @ {rupee(m?.rate || 0)}/{m?.unit || 'unit'}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-xs text-gray-500 text-center">
                                  No mix items available
                                </div>
                              )}
                            </div>

                            {item?.batch_number && (
                              <div className="px-4 py-2.5 border-t border-orange-200 bg-orange-100/30">
                                <div className="text-xs text-orange-800">
                                  <span className="font-semibold">Mix Batch:</span>
                                  <span className="ml-1.5 font-mono">{item?.batch_number}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-gray-500 text-center py-6">No items found</div>
                )}

                {/* Summary Section */}
                <div className="mt-3 border-t border-gray-200 pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Items Total:</span>
                    <span>{rupee(bill?.items_total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>GST:</span>
                    <span>{rupee(bill?.total_gst || 0)}</span>
                  </div>

                  {Array.isArray(bill?.other_charges) && bill?.other_charges.length > 0 ? (
                    <>
                      {bill.other_charges.map((c, i) => (
                        <div key={`oc-${bill.id}-${i}`} className="flex justify-between text-sm">
                          <span>{c?.charge_name || 'Charge'}:</span>
                          <span>
                            {c?.charge_type === 'percentage'
                              ? `${parseFloat(c?.charge_amount || 0).toFixed(2)}% (${rupee(((bill?.items_total || 0) * (c?.charge_amount || 0)) / 100)})`
                              : rupee(c?.charge_amount || 0)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-medium">
                        <span>Other Charges Total:</span>
                        <span>{rupee(bill?.other_charges_total || 0)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Other Charges:</span>
                      <span>{rupee(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm font-semibold border-t border-gray-300 pt-2">
                    <span>Grand Total:</span>
                    <span>{rupee(bill?.grand_total || 0)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Payment Information Section */}
            <section>
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <CurrencyRupeeIcon className="h-4 w-4 mr-2" />
                Payment Information
              </h4>

              {bill?.payment_status === 'pending' && (!bill?.payments || bill.payments.length === 0) ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-800">No payments recorded yet</p>
                    <p className="text-xs text-yellow-600 mt-1">Created on {formatDate(bill?.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowPaymentDialog(true); }}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Collect Payment
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(bill?.payments) && bill.payments.length > 0 ? (
                    bill.payments.map((p) => (
                      <div key={`p-${bill.id}-${p?.id || 'no-id'}`} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center text-gray-600">
                              {getPaymentIcon(p?.payment_method)}
                              <span className="ml-2 text-sm font-medium capitalize">
                                {p?.payment_method || 'other'}
                              </span>
                            </div>
                            <div className="text-lg font-semibold text-green-600">
                              {rupee(p?.payment_amount || 0)}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right text-sm text-gray-600">
                              <div className="flex items-center">
                                <CalendarIcon className="h-4 w-4 mr-1" />
                                {formatDate(p?.payment_date)}
                              </div>
                              {p?.payment_time && (
                                <div className="flex items-center mt-1">
                                  <ClockIcon className="h-4 w-4 mr-1" />
                                  {formatTime(p?.payment_time)}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {(() => {
                                const hasSingleReceipt = p?.receipt_image || p?.receipt || p?.receiptUrl || p?.receipt_image_url;
                                const hasMultipleReceipts =
                                  (Array.isArray(p?.receipt_images) && p.receipt_images.length > 0) ||
                                  (Array.isArray(p?.receipts) && p.receipts.length > 0);

                                return (
                                  <>
                                    {hasSingleReceipt && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const raw = p.receipt_image || p.receipt || p.receiptUrl || p?.receipt_image_url;
                                          const normalized = toReceiptUrl(raw);
                                          openSingleReceipt(
                                            normalized,
                                            `Payment Receipt - ${rupee(p?.payment_amount || 0)}`
                                          );
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-gray-700 rounded transition-colors"
                                        title="View Payment Receipt"
                                      >
                                        <EyeIcon className="h-4 w-4" />
                                      </button>
                                    )}

                                    {hasMultipleReceipts && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const receiptArray = p.receipt_images || p.receipts;
                                          const mapped = receiptArray.map((receipt, i) => ({
                                            url: toReceiptUrl(receipt),
                                            title: `Payment Receipt ${i + 1} - ${rupee(p?.payment_amount || 0)}`
                                          }));
                                          openReceipts(mapped);
                                        }}
                                        className="p-1.5 text-blue-500 hover:text-blue-700 rounded transition-colors"
                                        title={`View all ${(p.receipt_images || p.receipts).length} receipts`}
                                      >
                                        <DocumentDuplicateIcon className="h-4 w-4" />
                                      </button>
                                    )}

                                    {!hasSingleReceipt && !hasMultipleReceipts && (
                                      <div className="text-xs text-gray-400" title="No receipt found">
                                        No receipt
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {p?.notes && (
                          <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Note:</span> {p?.notes}
                          </div>
                        )}

                        {Array.isArray(p?.receipt_images) && p.receipt_images.length > 1 && (
                          <div className="mt-2 text-xs text-blue-600 flex items-center">
                            <DocumentDuplicateIcon className="h-3 w-3 mr-1" />
                            {p.receipt_images.length} receipt(s) available
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">No payment records found</div>
                  )}

                  {bill?.payment_status !== 'paid' && pendingAmount > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowPaymentDialog(true); }}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Collect Payment
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Payment Collection Dialog */}
      <CatererBillPaymentCollectionDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onSubmit={handlePaymentSubmit}
        caterer={{
          caterer_name: bill.caterer_name,
          caterer_phone: bill.caterer_phone,
          phone_number: bill.caterer_phone,
          phone: bill.caterer_phone,
          id: bill.caterer_id,
          contact_person: bill.contact_person
        }}
        bills={[bill]}
        selectedBill={selectedBillForPayment}
        isLoading={isProcessingPayment}
      />

      {/* Receipt Viewer Modal */}
      <CatererBillCardModal
        receipts={receipts}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />
    </>
  );
};

export default CatererBillCard;
