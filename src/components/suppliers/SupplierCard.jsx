import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  TagIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import { useSafety } from '../../contexts/SafetyContext';
import SafetyDialog from '../common/SafetyDialog';
import DeleteConfirmationDialog from '../common/DeleteConfirmationDialog';

const SupplierCard = ({ supplier, onEdit, onSupplierUpdated }) => {
  const { showSuccess, showError } = useToast();
  const { requiresSafetyCheck } = useSafety();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);

  const handleView = () => {
    navigate(`/suppliers/${supplier.id}/details`);
  };

  const handlePurchase = () => {
    navigate(`/suppliers/${supplier.id}/purchase`);
  };

  const handleEdit = () => {
    if (requiresSafetyCheck('edit')) {
      setPendingAction('edit');
      setShowSafetyDialog(true);
    } else {
      onEdit(supplier);
    }
  };

  const handleDelete = () => {
    if (requiresSafetyCheck('delete')) {
      setPendingAction('delete');
      setShowSafetyDialog(true);
    } else {
      setShowDeleteConfirmation(true);
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/suppliers/${supplier.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Supplier deleted successfully');
        onSupplierUpdated();
      } else {
        showError(data.message || 'Failed to delete supplier');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showError('Failed to delete supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyConfirm = () => {
    if (pendingAction === 'edit') {
      onEdit(supplier);
    } else if (pendingAction === 'delete') {
      // Always show confirmation dialog after password verification
      setShowDeleteConfirmation(true);
    }
    setShowSafetyDialog(false);
    setPendingAction(null);
  };

  const handleSafetyCancel = () => {
    setShowSafetyDialog(false);
    setPendingAction(null);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirmation(false);
    performDelete();
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirmation(false);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        {/* Supplier Image */}
        <div className="h-48 bg-gray-200 relative">
          {supplier.supplier_image ? (
            <img
              src={`http://localhost:5000/uploads/suppliers/${supplier.supplier_image}`}
              alt={supplier.supplier_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
              <UserIcon className="h-16 w-16 text-orange-400" />
            </div>
          )}
          
          {/* Action Buttons Overlay */}
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              onClick={handlePurchase}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all"
              title="Purchase from Supplier"
            >
              <ShoppingCartIcon className="h-4 w-4 text-green-600" />
            </button>
            <button
              onClick={handleView}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all"
              title="View Details"
            >
              <EyeIcon className="h-4 w-4 text-blue-600" />
            </button>
            <button
              onClick={handleEdit}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all"
              title="Edit Supplier"
            >
              <PencilIcon className="h-4 w-4 text-orange-600" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all disabled:opacity-50"
              title="Delete Supplier"
            >
              <TrashIcon className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* Supplier Info */}
        <div className="p-4">
          {/* Supplier Name */}
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
            {supplier.supplier_name}
          </h3>
          
          {/* Contact Person */}
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span className="truncate">{supplier.contact_person}</span>
          </div>

          {/* Phone Number */}
          <div className="flex items-center text-sm text-gray-600 mb-2">
            <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
            <span>{supplier.phone_number}</span>
          </div>

          {/* Email */}
          {supplier.email && (
            <div className="flex items-center text-sm text-gray-600 mb-2">
              <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
              <span className="truncate">{supplier.email}</span>
            </div>
          )}

          {/* Address */}
          {supplier.address && (
            <div className="flex items-start text-sm text-gray-600 mb-3">
              <MapPinIcon className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{supplier.address}</span>
            </div>
          )}

          {/* Products Supplied Tags */}
          {supplier.products_supplied && supplier.products_supplied.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <TagIcon className="h-4 w-4 mr-1 text-gray-400" />
                <span className="font-medium">Products:</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {supplier.products_supplied.slice(0, 3).map((product, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full"
                  >
                    {product}
                  </span>
                ))}
                {supplier.products_supplied.length > 3 && (
                  <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                    +{supplier.products_supplied.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <button
              onClick={handlePurchase}
              className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center"
            >
              <ShoppingCartIcon className="h-4 w-4 mr-1" />
              Purchase
            </button>
            <div className="flex space-x-3">
              <button
                onClick={handleView}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View
              </button>
              <button
                onClick={handleEdit}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Dialog */}
      {showSafetyDialog && (
        <SafetyDialog
          isOpen={showSafetyDialog}
          onClose={handleSafetyCancel}
          onConfirm={handleSafetyConfirm}
          title={`${pendingAction === 'edit' ? 'Edit' : 'Delete'} Supplier`}
          message={`Are you sure you want to ${pendingAction === 'edit' ? 'edit' : 'delete'} ${supplier.supplier_name}?`}
          actionType={pendingAction}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <DeleteConfirmationDialog
          isOpen={showDeleteConfirmation}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          itemName={supplier.supplier_name}
          itemType="Supplier"
          loading={loading}
        />
      )}
    </>
  );
};

export default SupplierCard;
