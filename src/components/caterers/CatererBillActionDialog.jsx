import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { DocumentTextIcon, CheckCircleIcon, ChatBubbleLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';

const CatererBillActionDialog = ({ 
  isOpen, 
  onClose, 
  onBillPreview, 
  onCreateBill, 
  onWhatsAppBill 
}) => {
  const handleAction = (action) => {
    switch (action) {
      case 'preview':
        onBillPreview();
        break;
      case 'create':
        onCreateBill();
        break;
      case 'whatsapp':
        onWhatsAppBill();
        break;
      case 'cancel':
        onClose();
        break;
      default:
        break;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-ml p-4">
        <DialogHeader >
          <DialogTitle className="text-lg font-semibold text-gray-900 flex">
            <DocumentTextIcon className="h-6 w-6 text-orange-600 mr-2" />
            Complete Selling in Caterer Bill
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600 mt-2">
            Choose what you want to do with this caterer bill:
          </p>
          
          <div className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
              onClick={() => handleAction('preview')}
            >
              <div className="flex items-center w-full">
                <DocumentTextIcon className="h-5 w-5 text-orange-600 mr-3" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">Bill Preview</div>
                  <div className="text-xs text-gray-500 mt-1">View the bill before finalizing</div>
                </div>
              </div>
            </Button>

            <Button
              variant="default"
              className="w-full justify-start h-auto p-4 bg-orange-600 hover:bg-orange-700"
              onClick={() => handleAction('create')}
            >
              <div className="flex items-center w-full">
                <CheckCircleIcon className="h-5 w-5 text-white mr-3" />
                <div className="text-left">
                  <div className="font-medium text-white">Create Bill</div>
                  <div className="text-xs text-orange-100 mt-1">Finalize and save the bill</div>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4 border-green-200 hover:bg-green-50 hover:border-green-300"
              onClick={() => handleAction('whatsapp')}
            >
              <div className="flex items-center w-full">
                <ChatBubbleLeftIcon className="h-5 w-5 text-green-600 mr-3" />
                <div className="text-left">
                  <div className="font-medium text-gray-900">WhatsApp Bill</div>
                  <div className="text-xs text-gray-500 mt-1">Send bill via WhatsApp</div>
                </div>
              </div>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-4 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              onClick={() => handleAction('cancel')}
            >
              <div className="flex items-center w-full">
                <XMarkIcon className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Cancel</div>
                  <div className="text-xs text-gray-500 mt-1">Close without action</div>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CatererBillActionDialog;