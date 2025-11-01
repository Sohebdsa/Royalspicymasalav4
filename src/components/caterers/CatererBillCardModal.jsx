import { useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PhotoIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const CatererBillCardModal = ({ receipts, isOpen, onClose }) => {
  const [currentReceiptIndex, setCurrentReceiptIndex] = useState(0);

  if (!isOpen || !receipts || receipts.length === 0) {
    return null;
  }

  const handlePrevious = (e) => {
    e.stopPropagation();
    setCurrentReceiptIndex(prev => (prev > 0 ? prev - 1 : receipts.length - 1));
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentReceiptIndex(prev => (prev < receipts.length - 1 ? prev + 1 : 0));
  };

  const currentReceipt = receipts[currentReceiptIndex];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <PhotoIcon className="h-5 w-5 mr-2" />
            {currentReceipt?.title || 'Payment Receipt'}
          </h2>
          <div className="flex items-center gap-2">
            {receipts.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="p-1.5 text-gray-500 hover:text-gray-700 rounded disabled:opacity-50"
                  disabled={receipts.length <= 1}
                  title="Previous receipt"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-600">
                  {currentReceiptIndex + 1} / {receipts.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1.5 text-gray-500 hover:text-gray-700 rounded disabled:opacity-50"
                  disabled={receipts.length <= 1}
                  title="Next receipt"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 rounded p-1"
              title="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[80vh] overflow-auto">
          {currentReceipt?.url ? (
            <div className="space-y-4">
              <img
                src={currentReceipt.url}
                alt={currentReceipt?.title || 'Payment Receipt'}
                className="mx-auto max-h-[72vh] rounded border border-gray-200 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.innerHTML = `
                    <div class="text-center py-12">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M3 3h18v18H3z"/></svg>
                      <p class="text-gray-600">Receipt image could not be loaded</p>
                    </div>
                  `;
                }}
              />
              {receipts.length > 1 && (
                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    Receipt {currentReceiptIndex + 1} of {receipts.length}
                  </p>
                </div>
              )}
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
  );
};

export default CatererBillCardModal;