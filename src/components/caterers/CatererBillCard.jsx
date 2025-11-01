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
import PaymentDialog from '../suppliers/PaymentDialog';
import CatererBillCardModal from './CatererBillCardModal';
import { useToast } from '../../contexts/ToastContext';

// New: base constants and URL normalizer
const API_BASE = import.meta.env.VITE_API_URL || '';
const RECEIPTS_BASE = '/caterers/reciept';

const toReceiptUrl = (val) => {
  if (!val) return '';
  // absolute URL as-is
  if (/^https?:\/\//i.test(val)) return val;

  // already new-base path
  if (val.startsWith(RECEIPTS_BASE)) {
    return API_BASE ? `${API_BASE}${val}` : val;
  }

  // legacy uploads path
  if (val.startsWith('/uploads/receipts/')) {
    return API_BASE ? `${API_BASE}${val}` : val;
  }

  // bare filename -> mount under new base
  if (!val.startsWith('/')) {
    return API_BASE ? `${API_BASE}${RECEIPTS_BASE}/${val}` : `${RECEIPTS_BASE}/${val}`;
  }

  // any other leading-slash path -> prefix API base if present
  return API_BASE ? `${API_BASE}${val}` : val;
};

const rupee = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(parseFloat(v || 0));

const CatererBillCard = ({ bill, onPaymentUpdate }) => {
  const { showError } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMix, setExpandedMix] = useState({});
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receipts, setReceipts] = useState([]);

  // Derived totals
  const grandTotal = useMemo(() => parseFloat(bill?.grand_total || 0), [bill]);
  const totalPaid = useMemo(() => parseFloat(bill?.total_paid || 0), [bill]);
  const pendingAmount = useMemo(() => Math.max(grandTotal - totalPaid, 0), [grandTotal, totalPaid]);

  // Debug logging
  console.log('CatererBillCard Debug:', {
    billNumber: bill?.bill_number,
    grandTotal,
    totalPaid,
    pendingAmount,
    paymentStatus: bill?.payment_status,
    payments: bill?.payments,
    receiptImages: bill?.payments?.flatMap(p => p?.receipt_images || [])
  });

  const formatDate = useCallback((d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }, []);

  const formatTime = useCallback((t) => {
    if (!t) return '';
    return new Date(`2000-01-01T${t}`).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }, []);

  const getStatusPill = (status) => {
    let actualStatus = status;
    if (!status || status === 'unknown') {
      // If pending amount is 0 or negative, it's fully paid
      if (pendingAmount <= 0) actualStatus = 'paid';
      // If some amount has been paid but not full, it's partial
      else if (totalPaid > 0 && pendingAmount > 0) actualStatus = 'partial';
      // If no payments made yet, it's pending
      else actualStatus = 'pending';
    }

    const map = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      partial: 'bg-blue-100 text-blue-800 border-blue-200',
      overdue: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    const Icon = actualStatus === 'paid' ? CheckCircleIcon : ExclamationCircleIcon;
    const cls = map[actualStatus] || 'bg-gray-100 text-gray-800 border-gray-200';

    console.log('Status calculation:', {
      originalStatus: status,
      calculatedStatus: actualStatus,
      grandTotal,
      totalPaid,
      pendingAmount,
      isFullyPaid: pendingAmount <= 0,
      logicApplied: !status || status === 'unknown'
    });

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
        <Icon className="h-4 w-4" />
        <span className="ml-1 capitalize">{actualStatus || 'unknown'}</span>
      </span>
    );
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'cash': return <BanknotesIcon className="h-4 w-4" />;
      case 'upi': return <DevicePhoneMobileIcon className="h-4 w-4" />;
      case 'bank_transfer': return <BuildingLibraryIcon className="h-4 w-4" />;
      case 'cheque': return <DocumentCheckIcon className="h-4 w-4" />;
      case 'card': return <CreditCardIcon className="h-4 w-4" />;
      default: return <EllipsisHorizontalIcon className="h-4 w-4" />;
    }
  };

  const isMixProduct = (item) => {
    const hasFlag = item?.is_mix === true || item?.is_mix === 1;
    const hasChildren = Array.isArray(item?.mix_items) && item?.mix_items.length > 0;
    return hasFlag && hasChildren;
  };

  const toggleBill = () => {
    if (isExpanded) setExpandedMix({});
    setIsExpanded((p) => !p);
  };

  const toggleMix = (e, key) => {
    e?.stopPropagation();
    setExpandedMix((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCollectPayment = () => setShowPaymentDialog(true);
  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    onPaymentUpdate?.();
  };

  const openReceipts = (paymentReceipts) => {
    if (Array.isArray(paymentReceipts) && paymentReceipts.length > 0) {
      setReceipts(paymentReceipts);
      setShowReceiptModal(true);
    }
  };

  const openSingleReceipt = (url, title) => {
    setReceipts([{ url, title }]);
    setShowReceiptModal(true);
  };

  const copyBillNumber = async () => {
    try {
      await navigator.clipboard.writeText(bill?.bill_number || '');
    } catch {
      showError?.('Failed to copy bill number');
    }
  };

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
        {/* Header */}
        <button
          type="button"
          onClick={toggleBill}
          className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
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
                      onClick={(e) => { e.stopPropagation(); copyBillNumber(); }}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Copy bill number"
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
        </button>

        {/* Body */}
        {isExpanded && (
          <div className="border-t border-gray-200 p-5 space-y-6">
            {/* Sale Information */}
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

            {/* Items */}
            <section>
              <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                <DocumentTextIcon className="h-4 w-4 mr-2" />
                Sale Items
              </h4>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {Array.isArray(bill?.items) && bill.items.length > 0 ? (
                  bill.items.map((item, idx) => {
                    const key = item?.id ?? `item-${idx}`;
                    const mix = isMixProduct(item);
                    const open = !!expandedMix[key];

                    return (
                      <div key={key} className="rounded-md bg-white border border-gray-200 p-3">
                        <div className="flex justify-between">
                          <div className="flex-1 flex">
                            <div className="w-5 pt-1">
                              {mix && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleMix(e, key)}
                                  className="text-orange-600 hover:text-orange-700"
                                  aria-expanded={open}
                                  aria-controls={`mix-${key}`}
                                  title="Toggle mix contents"
                                >
                                  {open ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                </button>
                              )}
                            </div>

                            <div className="ml-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{item?.product_name || 'Unknown Product'}</span>
                                {mix && (
                                  <span className="inline-flex items-center text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                                    <CubeIcon className="h-3 w-3 mr-1" />
                                    Mix ({item?.mix_items?.length || 0})
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">
                                {parseFloat(item?.quantity || 0).toFixed(3)} {item?.unit || 'unit'} × {rupee(item?.rate || 0)}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-semibold text-gray-900">{rupee(item?.total_amount || 0)}</div>
                            {parseFloat(item?.gst_amount || 0) > 0 && (
                              <div className="text-xs text-gray-500">GST: {rupee(item?.gst_amount || 0)}</div>
                            )}
                          </div>
                        </div>

                        {mix && open && (
                          <div id={`mix-${key}`} className="mt-3 rounded-md border border-orange-200 bg-orange-50">
                            <div className="px-3 py-2 border-b border-orange-200 text-xs font-semibold text-orange-900 flex items-center">
                              <CubeIcon className="h-3.5 w-3.5 mr-1.5" />
                              Mix Contents ({item?.mix_items?.length || 0})
                            </div>

                            <div className="divide-y divide-orange-200">
                              {item?.mix_items?.map((m, mIdx) => (
                                <div key={`mix-${key}-${mIdx}`} className="px-3 py-2 flex items-start justify-between text-xs">
                                  <div className="pr-2">
                                    <div className="font-medium text-gray-900">{m?.product_name || 'Unknown'}</div>
                                    <div className="text-orange-700 mt-0.5">
                                      {parseFloat(m?.quantity || 0).toFixed(3)} {m?.unit || 'unit'}
                                      {m?.batch_number && <span className="ml-2 text-orange-600">• Batch: {m?.batch_number}</span>}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-semibold text-orange-700">{rupee(m?.allocatedBudget || 0)}</div>
                                    <div className="text-[10px] text-gray-500">
                                      @ {rupee(m?.rate || 0)}/{m?.unit || 'unit'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {item?.batch_number && (
                              <div className="px-3 py-2 border-t border-orange-200 text-xs text-orange-700">
                                <span className="font-medium">Mix Batch:</span> {item?.batch_number}
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

                {/* Summary */}
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
                        <div key={`oc-${i}`} className="flex justify-between text-sm">
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

            {/* Payments */}
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
                    className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Collect Payment
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(bill?.payments) && bill.payments.length > 0 ? (
                    bill.payments.map((p, index) => {
                      console.log(`Payment ${index}:`, {
                        id: p?.id,
                        payment_method: p?.payment_method,
                        payment_amount: p?.payment_amount,
                        receipt_image: p?.receipt_image,
                        receipt_images: p?.receipt_images,
                        hasSingleReceipt: !!p?.receipt_image,
                        hasMultipleReceipts: Array.isArray(p?.receipt_images) && p.receipt_images.length > 0
                      });

                      return (
                        <div key={p?.id} className="bg-gray-50 rounded-lg p-4">
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
                                  const hasSingleReceipt = p?.receipt_image || p?.receipt || p?.receiptUrl;
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
                                            const raw = p.receipt_image || p.receipt || p.receiptUrl;
                                            const normalized = toReceiptUrl(raw);
                                            openSingleReceipt(
                                              normalized,
                                              `Payment Receipt - ${rupee(p?.payment_amount || 0)}`
                                            );
                                          }}
                                          className="p-1.5 text-gray-500 hover:text-gray-700 rounded"
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
                                          className="p-1.5 text-blue-500 hover:text-blue-700 rounded"
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
                      );
                    })
                  ) : (
                    <div className="text-sm text-gray-500 text-center py-4">No payment records found</div>
                  )}

                  {bill?.payment_status !== 'paid' && pendingAmount > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowPaymentDialog(true); }}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-sm font-medium"
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

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        bill={bill}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Receipt Modal */}
      <CatererBillCardModal
        receipts={receipts}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />
    </>
  );
};

export default CatererBillCard;
