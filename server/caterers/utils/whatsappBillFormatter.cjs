/**
 * WhatsApp Bill Formatter
 * Formats caterer sale bills into WhatsApp-friendly text format
 */

/**
 * Format a caterer sale bill for WhatsApp
 * @param {Object} billData - Complete bill data including sale, items, caterer info
 * @returns {string} Formatted bill text for WhatsApp
 */
function formatBillForWhatsApp(billData) {
    const { sale, caterer, items, payments, otherCharges } = billData;

    let billText = '';

    // Header
    billText += '━━━━━━━━━━━━━━━━━━━━━\n';
    billText += ' *ROYAL SPICY MASALA*\n';
    billText += '━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Bill Information
    billText += ` *Bill No:* ${sale.bill_number}\n`;
    billText += ` *Date:* ${formatDate(sale.sell_date)}\n\n`;

    // Caterer Information
    billText += ' *CATERER DETAILS*\n';
    billText += `Name: ${caterer.caterer_name}\n`;
    if (caterer.contact_person) {
        billText += `Contact: ${caterer.contact_person}\n`;
    }
    if (caterer.phone_number) {
        billText += `Phone: ${caterer.phone_number}\n`;
    }
    if (caterer.address) {
        billText += `Address: ${caterer.address}\n`;
    }
    billText += '\n';

    // Items Section
    billText += '━━━━━━━━━━━━━━━━━━━━━\n';
    billText += '*ITEMS*\n';
    billText += '━━━━━━━━━━━━━━━━━━━━━\n\n';

    // Filter out child items (items that are part of a mix)
    // Only process top-level items (regular products and mix products themselves)
    const topLevelItems = items.filter(item => !item.parent_sale_item_id);

    // Process items
    let itemNumber = 1;
    for (const item of topLevelItems) {
        if (item.is_mix && item.mix_items && item.mix_items.length > 0) {
            // Mix product
            billText += `${itemNumber}. *${item.product_name}*\n`;
            billText += `   Qty: ${formatQuantity(item.quantity)} ${item.unit}\n`;
            billText += `   Rate: ₹${formatAmount(item.rate)}\n`;
            billText += `   *Total: ₹${formatAmount(item.total_amount)}*\n`;
            billText += `   \n`;
            billText += `   _Mix Components:_\n`;

            // Mix components
            for (const mixItem of item.mix_items) {
                billText += `   • ${mixItem.product_name}\n`;
                billText += `     ${formatQuantity(mixItem.quantity)} ${mixItem.unit} @ ₹${formatAmount(mixItem.rate)}\n`;
            }
            billText += '\n';
        } else {
            // Regular product
            billText += `${itemNumber}. *${item.product_name}*\n`;
            billText += `   Qty: ${formatQuantity(item.quantity)} ${item.unit}\n`;
            billText += `   Rate: ₹${formatAmount(item.rate)}/${item.unit}\n`;

            if (item.gst_percentage && parseFloat(item.gst_percentage) > 0) {
                billText += `   GST: ${item.gst_percentage}% (₹${formatAmount(item.gst_amount)})\n`;
            }

            billText += `   *Total: ₹${formatAmount(item.total_amount)}*\n\n`;
        }
        itemNumber++;
    }

    // Totals Section
    billText += '━━━━━━━━━━━━━━━━━━━━━\n';
    billText += ' *BILL SUMMARY*\n';
    billText += '━━━━━━━━━━━━━━━━━━━━━\n\n';

    billText += `Subtotal: ₹${formatAmount(sale.subtotal)}\n`;

    if (sale.total_gst && parseFloat(sale.total_gst) > 0) {
        billText += `GST: ₹${formatAmount(sale.total_gst)}\n`;
    }

    billText += `Items Total: ₹${formatAmount(sale.items_total)}\n`;

    // Other charges
    if (otherCharges && otherCharges.length > 0) {
        billText += '\n_Other Charges:_\n';
        for (const charge of otherCharges) {
            const chargeAmount = calculateChargeAmount(charge, sale.items_total);
            const sign = charge.charge_name.toLowerCase().includes('discount') ? '-' : '+';
            billText += `${charge.charge_name}: ${sign}₹${formatAmount(chargeAmount)}\n`;
        }
    }

    billText += '\n';
    billText += `*GRAND TOTAL: ₹${formatAmount(sale.grand_total)}*\n\n`;

    // Payment Information
    if (payments && payments.length > 0) {
        billText += '━━━━━━━━━━━━━━━━━━━━━\n';
        billText += ' *PAYMENT DETAILS*\n';
        billText += '━━━━━━━━━━━━━━━━━━━━━\n\n';

        let totalPaid = 0;
        for (const payment of payments) {
            const amount = parseFloat(payment.payment_amount) || 0;
            totalPaid += amount;

            if (amount > 0) {
                billText += `Date: ${formatDate(payment.payment_date)}\n`;
                billText += `Method: ${formatPaymentMethod(payment.payment_method)}\n`;
                billText += `Amount: ₹${formatAmount(amount)}\n\n`;
            }
        }

        const remaining = parseFloat(sale.grand_total) - totalPaid;

        if (remaining > 0.01) {
            billText += `*Remaining: ₹${formatAmount(remaining)}*\n`;
            billText += `Status: ${sale.payment_status === 'partial' ? '⚠️ Partial Payment' : '⏳ Pending'}\n\n`;
        } else {
            billText += `✅ *PAID IN FULL*\n\n`;
        }
    }

    // Footer
    billText += '━━━━━━━━━━━━━━━━━━━━━\n';
    billText += '🙏 *Thank you for your business!*\n';
    billText += '━━━━━━━━━━━━━━━━━━━━━\n';

    return billText;
}

/**
 * Format date to readable format
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    try {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        return dateString;
    }
}

/**
 * Format amount to 2 decimal places with Indian number formatting
 */
function formatAmount(amount) {
    if (amount === null || amount === undefined) return '0.00';

    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';

    return num.toFixed(2);
}

/**
 * Format quantity to remove unnecessary decimals
 */
function formatQuantity(quantity) {
    if (quantity === null || quantity === undefined) return '0';

    const num = parseFloat(quantity);
    if (isNaN(num)) return '0';

    // If it's a whole number, don't show decimals
    if (num % 1 === 0) {
        return num.toString();
    }

    // Otherwise show up to 3 decimal places, removing trailing zeros
    return parseFloat(num.toFixed(3)).toString();
}

/**
 * Format payment method to readable text
 */
function formatPaymentMethod(method) {
    const methodMap = {
        'cash': 'Cash',
        'upi': 'UPI',
        'card': 'Card',
        'bank_transfer': 'Bank Transfer',
        'cheque': 'Cheque',
        'credit': 'Credit'
    };

    return methodMap[method] || method;
}

/**
 * Calculate charge amount based on type
 */
function calculateChargeAmount(charge, itemsTotal) {
    const value = parseFloat(charge.charge_amount) || 0;

    if (charge.charge_type === 'percentage') {
        return (itemsTotal * value) / 100;
    }

    return value;
}

module.exports = {
    formatBillForWhatsApp
};
