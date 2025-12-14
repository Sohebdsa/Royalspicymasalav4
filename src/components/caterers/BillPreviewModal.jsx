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
            cash: 'Cash',
            upi: 'UPI',
            card: 'Card',
            bank_transfer: 'Bank Transfer',
            cheque: 'Cheque',
            credit: 'Credit'
        };
        return methodMap[method] || method;
    };

    return (
        <>
            {/* Modal Overlay */}
            <div className="fixed inset-0  bg-opacity-50 z-50 backdrop-blur-md flex items-center justify-center p-4">
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
                        {/* Bill content wrapper for printing */}
                        <div className="bill-print-area max-w-3xl mx-auto bg-white">
                            {/* Business Header */}
                            <div className="flex flex-col items-center border-b-2 border-gray-800 pb-4 mb-4">
                                {/* Logo and Title */}
                                <div className="flex flex-col items-center justify-center mb-2">
                                    <img
                                        src="/logo.png"
                                        alt="Royal Spicy Masala Logo"
                                        className="h-35 w-auto mb-2 object-contain"
                                    />
                                    <h1 className="text-3xl font-bold text-gray-900 text-center uppercase tracking-wide">
                                        ROYAL SPICY MASALA
                                    </h1>
                                    <p className="text-base font-semibold text-orange-600 tracking-wider">
                                        GRAINS AND DRY FRUITS
                                    </p>
                                </div>

                                {/* Details */}
                                <div className="text-center space-y-1 text-sm text-gray-700 w-full">
                                    <div className="flex flex-wrap justify-center gap-x-4 font-medium">
                                        <p>Prop: Barkat Ali Kallan Shaikh</p>
                                        <span className="text-gray-400">|</span>
                                        <p>Mob: 91+ 97699 90055</p>
                                    </div>

                                    <p className="max-w-xl mx-auto">
                                        Shop no 1, Ashiyana SRA Society, Near DCB Bank, Opp Subway,
                                        Andheri West, Mumbai - 400053
                                    </p>

                                    <div className="flex flex-wrap justify-center gap-x-4 pt-1">
                                        <p>
                                            <span className="font-semibold">Email:</span> rsmgadf@gmail.com
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-x-6 pt-2 font-bold text-gray-800">
                                        <p>FSSAI: 21525006000639</p>
                                        <p>GST: 27QAUPS5898Q1ZK</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bill Info */}
                            <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-300">
                                <div>
                                    <p className="text-sm text-gray-600">Bill Number</p>
                                    <p className="text-lg font-bold text-gray-900">{billNumber}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-600">Date</p>
                                    <p className="text-lg font-bold text-gray-900">
                                        {formatDate(sellDate)}
                                    </p>
                                </div>
                            </div>

                            {/* Caterer Details */}
                            <div className="mb-6 pb-4 border-b border-gray-300">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">BILLED TO</h3>
                                <div className="space-y-1">
                                    <p className="text-base font-semibold text-gray-900">
                                        {caterer?.caterer_name || caterer?.name || 'N/A'}
                                    </p>
                                    {caterer?.contact_person && (
                                        <p className="text-sm text-gray-700">
                                            Contact: {caterer.contact_person}
                                        </p>
                                    )}
                                    {caterer?.phone_number && (
                                        <p className="text-sm text-gray-700">
                                            Phone: {caterer.phone_number}
                                        </p>
                                    )}
                                    {caterer?.address && (
                                        <p className="text-sm text-gray-700">
                                            Address: {caterer.address}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">ITEMS</h3>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 border-y-2 border-gray-800">
                                            <th className="text-left py-2 px-3 text-sm font-bold text-gray-900">
                                                Product
                                            </th>
                                            <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">
                                                Qty
                                            </th>
                                            <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">
                                                Rate
                                            </th>
                                            <th className="text-right py-2 px-3 text-sm font-bold text-gray-900">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => {
                                            // Skip mix items (they're shown under their parent)
                                            if (item.isMixItem) return null;

                                            return (
                                                <Fragment key={index}>
                                                    {/* Main item row */}
                                                    <tr
                                                        className={`border-b border-gray-200 ${item.isMixHeader ? 'bg-orange-50' : ''
                                                            }`}
                                                    >
                                                        <td className="py-2 px-3 text-sm text-gray-900">
                                                            {item.product_name}
                                                            {item.isMixHeader && (
                                                                <span className="ml-2 text-xs text-orange-600 font-semibold">
                                                                    (MIX)
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 px-3 text-sm text-right text-gray-900">
                                                            {item.quantity} {item.unit}
                                                        </td>
                                                        <td className="py-2 px-3 text-sm text-right text-gray-900">
                                                            ₹{formatAmount(item.rate)}
                                                        </td>
                                                        <td className="py-2 px-3 text-sm text-right font-semibold text-gray-900">
                                                            ₹{formatAmount(item.total)}
                                                        </td>
                                                    </tr>

                                                    {/* Mix components - show if this is a mix header */}
                                                    {item.isMixHeader &&
                                                        items
                                                            .filter(
                                                                (i) =>
                                                                    i.isMixItem &&
                                                                    i.mixName === item.mixName
                                                            )
                                                            .map((mixItem, mixIndex) => (
                                                                <tr
                                                                    key={`mix-${index}-${mixIndex}`}
                                                                    className="bg-orange-25 border-b border-gray-100"
                                                                >
                                                                    <td
                                                                        className="py-1 px-3 pl-8 text-xs text-gray-600"
                                                                        colSpan={2}
                                                                    >
                                                                        └─ {mixItem.product_name} (
                                                                        {mixItem.quantity} {mixItem.unit})
                                                                    </td>
                                                                    <td className="py-1 px-3 text-xs text-right text-gray-600">
                                                                        ₹{formatAmount(mixItem.rate)}
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

                            {/* Other Charges */}
                            {otherCharges && otherCharges.length > 0 && (
                                <div className="mb-6 pb-4 border-b border-gray-300">
                                    <h3 className="text-lg font-bold text-gray-900 mb-3">
                                        OTHER CHARGES
                                    </h3>
                                    <div className="space-y-2">
                                        {otherCharges.map((charge, index) => {
                                            const isDiscount =
                                                charge.type === 'discount' ||
                                                charge.name?.toLowerCase().includes('discount');

                                            // Calculate the actual charge amount
                                            let chargeAmount;
                                            if (charge.type === 'discount') {
                                                if (charge.value_type === 'percentage') {
                                                    chargeAmount =
                                                        (itemsTotal * parseFloat(charge.value)) / 100;
                                                } else {
                                                    chargeAmount = parseFloat(charge.value);
                                                }
                                            } else if (charge.type === 'percentage') {
                                                chargeAmount =
                                                    (itemsTotal * parseFloat(charge.value)) / 100;
                                            } else {
                                                chargeAmount = parseFloat(charge.value);
                                            }

                                            return (
                                                <div
                                                    key={index}
                                                    className="flex justify-between text-sm"
                                                >
                                                    <span className="text-gray-700">
                                                        {charge.name}
                                                    </span>
                                                    <span
                                                        className={`font-semibold ${isDiscount
                                                            ? 'text-green-600'
                                                            : 'text-gray-900'
                                                            }`}
                                                    >
                                                        {isDiscount ? '-' : '+'}₹
                                                        {formatAmount(chargeAmount)}
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
                                        <span className="font-semibold text-gray-900">
                                            ₹{formatAmount(subtotal)}
                                        </span>
                                    </div>
                                    {totalGst > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Total GST</span>
                                            <span className="font-semibold text-gray-900">
                                                ₹{formatAmount(totalGst)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-700">Items Total</span>
                                        <span className="font-semibold text-gray-900">
                                            ₹{formatAmount(itemsTotal)}
                                        </span>
                                    </div>
                                    {otherChargesTotal > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Other Charges</span>
                                            <span className="font-semibold text-gray-900">
                                                ₹{formatAmount(otherChargesTotal)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-gray-300">
                                        <span className="text-gray-900">GRAND TOTAL</span>
                                        <span className="text-orange-600">
                                            ₹{formatAmount(grandTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Details */}
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">
                                    PAYMENT DETAILS
                                </h3>
                                <div className="flex gap-6">
                                    <div className="flex-1 space-y-2">
                                        {paymentDate && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Payment Date</span>
                                                <span className="font-semibold text-gray-900">
                                                    {formatDate(paymentDate)}
                                                </span>
                                            </div>
                                        )}
                                        {paymentMethod && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Payment Method</span>
                                                <span className="font-semibold text-gray-900">
                                                    {formatPaymentMethod(paymentMethod)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">Amount Paid</span>
                                            <span className="font-semibold text-gray-900">
                                                ₹{formatAmount(paymentAmount || 0)}
                                            </span>
                                        </div>
                                        {remaining > 0.01 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-700">Remaining</span>
                                                <span className="font-semibold text-red-600">
                                                    ₹{formatAmount(remaining)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-300">
                                            <span className="text-gray-900">Payment Status</span>
                                            <span
                                                className={`${remaining <= 0.01
                                                    ? 'text-green-600'
                                                    : paymentAmount > 0
                                                        ? 'text-yellow-600'
                                                        : 'text-red-600'
                                                    }`}
                                            >
                                                {remaining <= 0.01
                                                    ? '✓ PAID IN FULL'
                                                    : paymentAmount > 0
                                                        ? '⚠ PARTIAL PAYMENT'
                                                        : '⏳ PENDING'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* QR Code */}
                                    <div className="w-32 flex flex-col items-center">
                                        <img
                                            src="/qr.jpeg"
                                            alt="Payment QR Code"
                                            className="w-24 h-24 object-contain border border-gray-200 rounded-lg"
                                        />
                                        <p className="text-[10px] text-gray-500 mt-1 text-center">
                                            Scan to Pay
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="text-center pt-4 border-t-2 border-gray-800">
                                <p className="text-lg font-semibold text-gray-900">
                                    Thank you for your business!
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    For any queries, please contact us
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
  @media print {
    /* Hide everything except print area */
    body * {
      visibility: hidden;
    }
    
    /* Hide modal completely */
    .no-print {
      display: none !important;
    }

    /* Show only bill content */
    .bill-print-area,
    .bill-print-area * {
      visibility: visible !important;
    }

    .bill-print-area {
      position: fixed !important;
      left: 50% !important;
      top: 0 !important;
      transform: translateX(-50%) !important;
      width: 80mm !important;
      max-width: 80mm !important;
      margin: 0 !important;
      padding: 5mm !important;
    }

    /* Reset html and body */
    html, body {
      width: 100% !important;
      height: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: white !important;
    }

    /* Layout preservations */
    .bill-print-area .flex {
      display: flex !important;
    }
    
    .bill-print-area .grid {
      display: grid !important;
    }
    
    .bill-print-area .space-y-1 > * + * {
      margin-top: 0.25rem !important;
    }
    
    .bill-print-area .space-y-2 > * + * {
      margin-top: 0.5rem !important;
    }

    /* Table styles */
    .bill-print-area table {
      display: table !important;
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 6px 0 !important;
    }
    
    .bill-print-area thead {
      display: table-header-group !important;
    }
    
    .bill-print-area tbody {
      display: table-row-group !important;
    }
    
    .bill-print-area tr {
      display: table-row !important;
      page-break-inside: avoid !important;
    }
    
    .bill-print-area td,
    .bill-print-area th {
      display: table-cell !important;
      padding: 3px 4px !important;
    }

    /* Typography */
    .bill-print-area {
      font-family: 'Arial', sans-serif !important;
      font-size: 11px !important;
      line-height: 1.3 !important;
      color: #000 !important;
    }

    .bill-print-area h1 {
      font-size: 16px !important;
      margin: 6px 0 4px 0 !important;
      line-height: 1.2 !important;
    }

    .bill-print-area h3 {
      font-size: 11px !important;
      font-weight: bold !important;
      margin: 8px 0 4px 0 !important;
      padding-bottom: 2px !important;
      border-bottom: 1px dashed #000 !important;
    }

    .bill-print-area p {
      margin: 2px 0 !important;
    }

    .bill-print-area table {
      font-size: 10px !important;
    }

    /* Spacing */
    .bill-print-area .mb-6 {
      margin-bottom: 10px !important;
    }
    
    .bill-print-area .pb-4 {
      padding-bottom: 6px !important;
    }
    
    .bill-print-area .pt-4 {
      padding-top: 6px !important;
    }

    /* Images */
    .bill-print-area img {
      max-width: 45mm !important;
      max-height: 18mm !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
    }

    /* Borders */
    .bill-print-area .border-b-2,
    .bill-print-area .border-b {
      border-bottom: 1px dashed #333 !important;
    }
    
    .bill-print-area .border-t-2,
    .bill-print-area .border-t {
      border-top: 1px dashed #333 !important;
    }
    
    .bill-print-area .border-y-2 {
      border-top: 1px solid #000 !important;
      border-bottom: 1px solid #000 !important;
    }

    /* Color to black for print */
    .bill-print-area .text-orange-600,
    .bill-print-area .text-gray-900,
    .bill-print-area .text-gray-700 {
      color: #000 !important;
    }
    
    .bill-print-area .text-gray-600 {
      color: #444 !important;
    }

    .bill-print-area .text-green-600 {
      color: #000 !important;
    }

    .bill-print-area .text-red-600 {
      color: #000 !important;
      font-weight: bold !important;
    }

    /* Remove backgrounds */
    .bill-print-area .bg-gray-100,
    .bill-print-area .bg-orange-50 {
      background: transparent !important;
    }

    /* Page setup */
    @page {
      size: 80mm auto;
      margin: 0;
    }
  }
`}</style>
        </>
    );
};

export default BillPreviewModal;
