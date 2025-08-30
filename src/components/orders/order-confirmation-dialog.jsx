// React import removed as it's not needed in modern React
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CheckCircle, 
  Clock, 
  Package, 
  Truck, 
  XCircle,
  AlertTriangle
} from 'lucide-react';


// Safe currency formatting function
const formatCurrency = (amount) => {
  const numAmount = Number(amount) || 0;
  return `₹${numAmount.toFixed(2)}`;
};


export default function OrderConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  order,
  action,
  isLoading = false,
  onSuccess = null
}) {
  
  const getActionDetails = (action) => {
    switch (action) {
      case 'approve':
        return {
          title: 'Approve Order',
          description: 'Are you sure you want to approve this order? This will confirm the order and notify the customer.',
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          confirmText: 'Approve Order',
          confirmClass: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'confirm':
        return {
          title: 'Confirm Order',
          description: 'Are you sure you want to confirm this order? This will move the order to confirmed status.',
          icon: <CheckCircle className="h-5 w-5 text-blue-600" />,
          confirmText: 'Confirm Order',
          confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
      case 'process':
        return {
          title: 'Start Processing',
          description: 'Are you sure you want to start processing this order? This will move the order to processing status.',
          icon: <Package className="h-5 w-5 text-purple-600" />,
          confirmText: 'Start Processing',
          confirmClass: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      case 'ship':
        return {
          title: 'Ship Order',
          description: 'Are you sure you want to mark this order as shipped? This will move the order to out for delivery status.',
          icon: <Truck className="h-5 w-5 text-orange-600" />,
          confirmText: 'Ship Order',
          confirmClass: 'bg-orange-600 hover:bg-orange-700 text-white'
        };
      case 'deliver':
        return {
          title: 'Mark as Delivered',
          description: 'Are you sure you want to mark this order as delivered? This action will complete the order.',
          icon: <CheckCircle className="h-5 w-5 text-green-600" />,
          confirmText: 'Mark Delivered',
          confirmClass: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'cancel':
        return {
          title: 'Cancel Order',
          description: 'Are you sure you want to cancel this order? This action cannot be undone.',
          icon: <XCircle className="h-5 w-5 text-red-600" />,
          confirmText: 'Cancel Order',
          confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
        };
      default:
        return {
          title: 'Confirm Action',
          description: 'Are you sure you want to perform this action?',
          icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
          confirmText: 'Confirm',
          confirmClass: 'bg-gray-900 hover:bg-gray-800 text-white'
        };
    }
  };


  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      confirmed: <CheckCircle className="h-4 w-4" />,
      processing: <Package className="h-4 w-4" />,
      out_for_delivery: <Truck className="h-4 w-4" />,
      delivered: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />,
    };
    return icons[status] || <Clock className="h-4 w-4" />;
  };


  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      out_for_delivery: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };


  const actionDetails = getActionDetails(action);


  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {actionDetails.icon}
            {actionDetails.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>{actionDetails.description}</p>
            
            {/* Order Details Card */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Order Number:</span>
                <span className="font-mono text-sm font-bold">{order.order_number}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Customer:</span>
                <span className="text-sm font-medium">{order.customer_name}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                <span className="text-sm font-bold text-blue-600">{formatCurrency(order.total_amount)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Current Status:</span>
                <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                  {getStatusIcon(order.status)}
                  {order.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>


            {action === 'cancel' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Warning</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. The order will be permanently cancelled.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isLoading}
            onClick={onClose}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              
              try {
                await onConfirm();
                
                // Call onSuccess callback after successful confirmation
                if (onSuccess) {
                  onSuccess();
                }
              } catch (error) {
                // Don't call onSuccess if there's an error
                console.error('Action failed:', error);
                // Error handling is done by the parent component's onConfirm function
              }
            }}
            disabled={isLoading}
            className={actionDetails.confirmClass}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </div>
            ) : (
              actionDetails.confirmText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
