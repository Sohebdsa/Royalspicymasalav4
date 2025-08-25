import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';

const DeleteConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  itemName,
  itemType = 'item',
  loading = false
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Deletion"
      maxWidth="max-w-md"
    >
      <div className="p-1">
        <div className="flex flex-col items-center justify-center mb-6">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Delete {itemType}?
          </h3>
          <p className="mt-2 text-sm text-center text-gray-600">
            This action cannot be undone. This will permanently delete the 
            <span className="font-medium text-gray-900"> {itemType} "{itemName}"</span>
            and all associated data.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-red-800">
                Important Note
              </h4>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  • All purchase history related to this supplier will be preserved
                </p>
                <p>
                  • This action only removes the supplier contact information
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deleting...
              </span>
            ) : (
              'Delete Supplier'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteConfirmationDialog;