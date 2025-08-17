import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { CreditCard, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function PaymentConfirmationDialog({
  isOpen,
  onClose,
  onYes,
  onNo,
  orderDetails,
  isLoading = false,
}) {
  const formatCurrency = (amount) => `₹${amount?.toLocaleString('en-IN') || 0}`;

  if (!orderDetails) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3 pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="font-bold">Payment Confirmation</div>
              <div className="text-sm font-normal text-gray-600">
                Order #{orderDetails.order_number}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Customer:</span>
                <span className="text-sm font-semibold">{orderDetails.customer_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                <span className="text-lg font-bold text-blue-700">
                  {formatCurrency(orderDetails.total_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Will be marked as:</span>
                <span className="text-sm font-semibold text-green-600">Delivered</span>
              </div>
            </CardContent>
          </Card>

          {/* Question */}
          <div className="text-center py-6">
            <div className="flex items-center justify-center mb-4">
              <AlertCircle className="h-10 w-10 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Did you receive payment?
            </h3>
            <p className="text-sm text-gray-600 px-2">
              Please confirm if payment was collected for this delivered order.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Button
              onClick={onNo} // This will now mark as delivered and add to outstanding
              disabled={isLoading}
              variant="outline"
              className="flex-1 h-12 text-red-600 border-red-200 hover:bg-red-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  No - Add to Outstanding
                </>
              )}
            </Button>
            <Button
              onClick={onYes} // This will open payment collection form
              disabled={isLoading}
              className="flex-1 h-12 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Yes - Record Payment
            </Button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-gray-500 text-center bg-gray-50 rounded-lg p-4">
            <strong>Yes:</strong> Opens payment collection form to record payment details<br />
            <strong>No:</strong> Order will be marked as delivered and amount added to customer's outstanding balance
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
