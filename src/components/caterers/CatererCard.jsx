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
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../../contexts/ToastContext';
import { useSafety } from '../../contexts/SafetyContext';
import SafetyDialog from '../common/SafetyDialog';

const CatererCard = ({ caterer, onEdit, onDelete, onCatererUpdated }) => {
  const { showSuccess, showError } = useToast();
  const { requiresSafetyCheck } = useSafety();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSafetyDialog, setShowSafetyDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Helper function to get proper image URL
  const getImageUrl = () => {
    if (caterer.card_image_url) {
      console.log('Using card_image_url:', caterer.card_image_url);
      return caterer.card_image_url;
    }

    if (caterer.card_image) {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const constructedUrl = `${API_BASE_URL}/images/${caterer.card_image}`;
      console.log('Using constructed URL:', constructedUrl);
      return constructedUrl;
    }

    console.log('No image available for caterer:', caterer.caterer_name);
    return null;
  };

  const handleImageError = (e) => {
    console.warn(`Failed to load image for caterer: ${caterer.caterer_name}`, {
      attempted_url: e.target.src,
      card_image_url: caterer.card_image_url,
      card_image: caterer.card_image,
      error_type: 'IMAGE_LOAD_ERROR'
    });
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    console.log(`Successfully loaded image for caterer: ${caterer.caterer_name}`);
    setImageLoading(false);
    setImageError(false);
  };

  const handleView = () => {
    showSuccess('View Caterer (to be implemented)');
  };

  const handleSell = () => {
    navigate(`/caterers/${caterer.id}/sell`);
  };

  const handleEdit = () => {
    if (requiresSafetyCheck('edit')) {
      setPendingAction('edit');
      setShowSafetyDialog(true);
    } else {
      onEdit && onEdit(caterer);
    }
  };

  const handleDelete = () => {
    if (requiresSafetyCheck('delete')) {
      setPendingAction('delete');
      setShowSafetyDialog(true);
    } else {
      performDelete();
    }
  };

  const performDelete = async () => {
    try {
      setLoading(true);
      onDelete && await onDelete(caterer);
    } catch (error) {
      console.error('Delete error:', error);
      showError(error.message || 'Failed to delete caterer');
    } finally {
      setLoading(false);
    }
  };

  const handleSafetyConfirm = () => {
    if (pendingAction === 'edit') {
      onEdit && onEdit(caterer);
    } else if (pendingAction === 'delete') {
      performDelete();
    }
    setShowSafetyDialog(false);
    setPendingAction(null);
  };

  const handleSafetyCancel = () => {
    setShowSafetyDialog(false);
    setPendingAction(null);
  };

  // Helper to get up to 3 info fields
  const infoFields = [];
  if (caterer.contact_person) infoFields.push({
    icon: <UserIcon className="h-4 w-4 mr-2 text-gray-400" />,
    value: caterer.contact_person
  });
  if (caterer.phone_number) infoFields.push({
    icon: <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />,
    value: caterer.phone_number
  });
  if (caterer.email) infoFields.push({
    icon: <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />,
    value: caterer.email
  });
  if (caterer.address) infoFields.push({
    icon: <MapPinIcon className="h-4 w-4 mr-2 text-gray-400" />,
    value: caterer.address
  });
  if (caterer.city || caterer.state || caterer.pincode) infoFields.push({
    icon: null,
    value: [caterer.city, caterer.state, caterer.pincode].filter(Boolean).join(', ')
  });
  if (caterer.gst_number) infoFields.push({
    icon: null,
    value: `GST: ${caterer.gst_number}`
  });
  if (caterer.description) infoFields.push({
    icon: null,
    value: caterer.description
  });

  const shownFields = infoFields.slice(0, 3);
  const imageUrl = getImageUrl();

  return (
    <>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
        {/* Caterer Image */}
        <div className="h-48 bg-gray-200 relative">
          {imageUrl && !imageError ? (
            <>
              {/* Loading spinner overlay */}
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              )}

              {/* Actual image */}
              <img
                src={imageUrl}
                alt={caterer.caterer_name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'
                  }`}
                onError={handleImageError}
                onLoad={handleImageLoad}
                loading="lazy"
              />
            </>
          ) : (
            /* Fallback UI when no image or image failed */
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
              <UserIcon className="h-16 w-16 text-orange-400 mb-2" />
              <span className="text-xs text-orange-600 font-medium">No Image</span>
            </div>
          )}

          {/* Action Buttons Overlay */}
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              onClick={handleSell}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all transform hover:scale-105"
              title="Sell to Caterer"
            >
              <ShoppingCartIcon className="h-4 w-4 text-green-600" />
            </button>
            <button
              onClick={handleView}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all transform hover:scale-105"
              title="View Details"
            >
              <EyeIcon className="h-4 w-4 text-blue-600" />
            </button>
            <button
              onClick={handleEdit}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all transform hover:scale-105"
              title="Edit Caterer"
            >
              <PencilIcon className="h-4 w-4 text-orange-600" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-opacity-100 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              title="Delete Caterer"
            >
              <TrashIcon className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* Caterer Info */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate" title={caterer.caterer_name}>
            {caterer.caterer_name}
          </h3>

          {/* Show up to 3 info fields */}
          {shownFields.map((field, idx) => (
            <div key={idx} className="flex items-center text-sm text-gray-600 mb-2">
              {field.icon}
              <span className="truncate" title={field.value}>{field.value}</span>
            </div>
          ))}

          {/* Show balance due if available */}
          {typeof caterer.balance_due !== 'undefined' && Number(caterer.balance_due) > 0 && (
            <div className="text-xs text-red-600 font-semibold mb-2 bg-red-50 px-2 py-1 rounded">
              Balance Due: ₹{Number(caterer.balance_due).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-100">
            <button
              onClick={handleSell}
              className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center transition-colors"
            >
              <ShoppingCartIcon className="h-4 w-4 mr-1" />
              Sell
            </button>
            <div className="flex space-x-3">
              <button
                onClick={handleView}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                View
              </button>
              <button
                onClick={handleEdit}
                className="text-sm text-orange-600 hover:text-orange-800 font-medium transition-colors"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50 transition-colors"
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
          title={`${pendingAction === 'edit' ? 'Edit' : 'Delete'} Caterer`}
          message={`Are you sure you want to ${pendingAction === 'edit' ? 'edit' : 'delete'} ${caterer.caterer_name}?`}
          actionType={pendingAction}
        />
      )}
    </>
  );
};

export default CatererCard;
