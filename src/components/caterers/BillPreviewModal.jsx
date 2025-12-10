import { Fragment } from 'react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';

const BillPreviewModal = ({ isOpen, onClose, billData }) => {
    if (!isOpen || !billData) return null;

    const handlePrint = () => {
        window.print();
    };

    const {
        billNumber,
        sellDate,
        caterer,
        items = [],
        otherCharges = [],
        subtotal,
        totalGst,
        itemsTotal,
        otherChargesTotal,
        grandTotal,
        paymentOption,
        paymentAmount,
        paymentMethod,
        paymentDate,
        paymentStatus
    } = billData;

    // Calculate remaining amount
    const remaining = grandTotal - (paymentAmount || 0);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Format amount
    const formatAmount = (amount) => {
        if (amount === null || amount === undefined) return '0.00';
        return parseFloat(amount).toFixed(2);
    };

    // Format payment method
    const formatPaymentMethod = (method) => {
        const methodMap = {
            'cash': 'Cash',
            'upi': 'UPI',
            'card': 'Card',
            'bank_transfer': 'Bank Transfer',
            'cheque': 'Cheque',
            'credit': 'Credit'
        };
        return methodMap[method] || method;
    };

    return (
        <>
            {/* Modal Overlay */}
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 no-print">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">Bill Preview</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 flex items-center gap-2"
                            >
                                <PrinterIcon className="h-5 w-5" />
                                Print
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    {/* Modal Body - Scrollable */}
                    <div className="overflow-y-auto flex-1 p-6">
                        <div id="bill-content" className="bill-preview-content">
                            {/* Bill Content */}
                            <div className="max-w-3xl mx-auto bg-white">

                                {/* Business Header */}
                                <div className="text-center border-b-2 border-gray-800 pb-4 mb-4">
                                    <h1 className="text-3xl font-bold text-gray-900">ROYAL SPICY MASALA</h1>
                                    <p className="text-sm text-gray-600 mt-1">Spices & Masala Wholesaler</p>
                                </div>

                                {/* Bill Info */}
                                <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-300">
                                    <div>
                                        <p className="text-sm text-gray-600">Bill Number</p>
                                        <p className="text-lg font-bold text-gray-900">{billNumber}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-600">Date</p>
                                        <p className="text-lg font-bold text-gray-900">{formatDate(sellDate)}</p>
                                    </div>
                                </div>

                                {/* Caterer Details */}
                                <div className="mb-6 pb-4 border-b border-gray-300">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">BILLED TO</h3>
                                    <div className="space-y-1">
                                        <p className="text-base font-semibold text-gray-900">{caterer?.caterer_name || caterer?.name || 'N/A'}</p>
                                        {caterer?.contact_person && (
                                            <p className="text-sm text-gray-700">Contact: {caterer.contact_person}</p>
                                        )}
                                        {caterer?.phone_number && (
                                            <p className="text-sm text-gray-700">Phone: {caterer.phone_number}</p>
                                        )}
                                        {caterer?.address && (
                                            <p className="text-sm text-gray-700">Address: {caterer.address}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">ITEMS</h3>
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100 border-y-2 border-gray-800">
                                                <th className="text-left py-2 px-3 text-sm font-bold text-gray-900">Product</th>
                                                <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">Qty</th>
                                                <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">Rate</th>
                                                <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">GST</th>
                                                <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item, index) => {
                                                // Skip mix items (they're shown under their parent)
                                                if (item.isMixItem) return null;

                                                return (
                                                    <Fragment key={index}>
                                                        {/* Main item row */}
                                                        <tr className={`border-b border-gray-200 ${item.isMixHeader ? 'bg-orange-50' : ''}`}>
                                                            <td className="py-2 px-3 text-sm text-gray-900">
                                                                {item.product_name}
                                                                {item.isMixHeader && (
                                                                    <span className="ml-2 text-xs text-orange-600 font-semibold">(MIX)</span>
                                                                )}
                                                            </td>
                                                            <td className="py-2 px-3 text-sm text-right text-gray-900">
                                                                {item.quantity} {item.unit}
                                                            </td>
                                                            <td className="py-2 px-3 text-sm text-right text-gray-900">
                                                                ₹{formatAmount(item.rate)}
                                                            </td>
                                                            <td className="py-2 px-3 text-sm text-right text-gray-900">
                                                                {item.gst || item.gst_percentage || 0}%
                                                            </td>
                                                            <td className="py-2 px-3 text-sm text-right font-semibold text-gray-900">
                                                                ₹{formatAmount(item.total)}
                                                            </td>
                                                        </tr>

                                                        {/* Mix components - show if this is a mix header */}
                                                        {item.isMixHeader && items.filter(i => i.isMixItem && i.mixName === item.mixName).map((mixItem, mixIndex) => (
                                                            <tr key={`mix-${index}-${mixIndex}`} className="bg-orange-25 border-b border-gray-100">
                                                                <td className="py-1 px-3 pl-8 text-xs text-gray-600">
                                                                    └─ {mixItem.product_name}
                                                                </td>
                                                                <td className="py-1 px-3 text-xs text-right text-gray-600">
                                                                    {mixItem.quantity} {mixItem.unit}
                                                                </td>
                                                                <td className="py-1 px-3 text-xs text-right text-gray-600">
                                                                    ₹{formatAmount(mixItem.rate)}
                                                                </td>
                                                                <td className="py-1 px-3 text-xs text-right text-gray-600">
                                                                    {mixItem.gst || 0}%
                                                                </td>
                                                                <td className="py-1 px-3 text-xs text-right text-gray-600">
                                                                    ₹{formatAmount(mixItem.total)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {otherCharges && otherCharges.length > 0 && (
                                    <div className="mb-6 pb-4 border-b border-gray-300">
                                        <h3 className="text-lg font-bold text-gray-900 mb-3">OTHER CHARGES</h3>
                                        <div className="space-y-2">
                                            {otherCharges.map((charge, index) => {
                                                const isDiscount = charge.type === 'discount' || charge.name?.toLowerCase().includes('discount');

                                                // Calculate the actual charge amount
                                                let chargeAmount;
                                                if (charge.type === 'discount') {
                                                    // For discount, check value_type
                                                    if (charge.value_type === 'percentage') {
                                                        chargeAmount = (itemsTotal * parseFloat(charge.value)) / 100;
                                                    } else {
                                                        // Fixed discount
                                                        chargeAmount = parseFloat(charge.value);
                                                    }
                                                } else if (charge.type === 'percentage') {
                                                    // Regular percentage charge
                                                    chargeAmount = (itemsTotal * parseFloat(charge.value)) / 100;
                                                } else {
                                                    // Fixed charge
                                                    chargeAmount = parseFloat(charge.value);
                                                }

                                                return (
                                                    <div key={index} className="flex justify-between text-sm">
                                                        <span className="text-gray-700">{charge.name}</span>
                                                        <span className={`font-semibold ${isDiscount ? 'text-green-600' : 'text-gray-900'}`}>
                                                            {isDiscount ? '-' : '+'}₹{formatAmount(chargeAmount)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Bill Summary */}
                                <div className="mb-6 pb-4 border-b-2 border-gray-800">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">SUMMARY</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Subtotal</span>
                                            <span className="font-semibold text-gray-900">₹{formatAmount(subtotal)}</span>
                                        </div>
                                        {totalGst > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Total GST</span>
                                                <span className="font-semibold text-gray-900">₹{formatAmount(totalGst)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Items Total</span>
                                            <span className="font-semibold text-gray-900">₹{formatAmount(itemsTotal)}</span>
                                        </div>
                                        {otherChargesTotal > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Other Charges</span>
                                                <span className="font-semibold text-gray-900">₹{formatAmount(otherChargesTotal)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-300">
                                            <span className="text-gray-900">GRAND TOTAL</span>
                                            <span className="text-orange-600">₹{formatAmount(grandTotal)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Details */}
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">PAYMENT DETAILS</h3>
                                    <div className="space-y-2">
                                        {paymentDate && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Payment Date</span>
                                                <span className="font-semibold text-gray-900">{formatDate(paymentDate)}</span>
                                            </div>
                                        )}
                                        {paymentMethod && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Payment Method</span>
                                                <span className="font-semibold text-gray-900">{formatPaymentMethod(paymentMethod)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Amount Paid</span>
                                            <span className="font-semibold text-gray-900">₹{formatAmount(paymentAmount || 0)}</span>
                                        </div>
                                        {remaining > 0.01 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Remaining</span>
                                                <span className="font-semibold text-red-600">₹{formatAmount(remaining)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                            <span className="text-gray-900">Payment Status</span>
                                            <span className={`${remaining <= 0.01 ? 'text-green-600' :
                                                paymentAmount > 0 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                {remaining <= 0.01 ? '✓ PAID IN FULL' :
                                                    paymentAmount > 0 ? '⚠ PARTIAL PAYMENT' :
                                                        '⏳ PENDING'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="text-center pt-4 border-t-2 border-gray-800">
                                    <p className="text-lg font-semibold text-gray-900">Thank you for your business!</p>
                                    <p className="text-sm text-gray-600 mt-2">For any queries, please contact us</p>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style jsx>{`
        @media print {
          /* Hide everything on the page */
          body > *:not(.fixed) {
            display: none !important;
          }
          
          /* Hide modal overlay background but keep content */
          .fixed {
            position: static !important;
            background: white !important;
          }
          
          .fixed > div {
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          
          /* Hide modal overlay and buttons */
          .no-print {
            display: none !important;
          }
          
          /* Show only bill content */
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          
          #bill-content {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          
          /* Remove page breaks - continuous print */
          * {
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          
          /* Optimize for receipt printer */
          @page {
            size: auto;
            margin: 10mm;
          }
          
          /* Ensure content flows continuously */
          .bill-preview-content {
            max-height: none !important;
            overflow: visible !important;
          }
          
          /* Remove any max-width constraints */
          .max-w-3xl {
            max-width: 100% !important;
          }
          
          /* Ensure tables print properly */
          table {
            width: 100% !important;
          }
          
          /* Adjust font sizes for print */
          body {
            font-size: 12pt;
          }
          
          h1 {
            font-size: 24pt;
          }
          
          h3 {
            font-size: 14pt;
          }
        }
      `}</style>
        </>
    );
};

export default BillPreviewModal;
