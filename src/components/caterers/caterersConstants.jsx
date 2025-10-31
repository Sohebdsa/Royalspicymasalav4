// Caterer Constants
import {
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
  DocumentCheckIcon,
  CreditCardIcon,
  EllipsisHorizontalIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

// Unit options for products
export const UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'l', label: 'Liter (l)' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'piece', label: 'Piece' },
  { value: 'packet', label: 'Packet' },
  { value: 'box', label: 'Box' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'can', label: 'Can' },
  { value: 'carton', label: 'Carton' }
];

// Payment options for caterer sales
export const PAYMENT_OPTIONS = [
  { value: 'full', label: 'Full Payment' },
  { value: 'partial', label: 'Partial Payment' },
  { value: 'advance', label: 'Advance Payment' },
  { value: 'custom', label: 'Custom Amount' }
];

// Payment methods for caterer sales
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: BanknotesIcon },
  { value: 'upi', label: 'UPI', icon: DevicePhoneMobileIcon },
  { value: 'bank', label: 'Bank Transfer', icon: BuildingLibraryIcon },
  { value: 'check', label: 'Cheque', icon: DocumentCheckIcon },
  { value: 'credit', label: 'Credit', icon: CreditCardIcon },
  { value: 'other', label: 'Other', icon: EllipsisHorizontalIcon }
];

// Charge types for additional charges
export const CHARGE_TYPES = [
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'discount', label: 'Discount' }
];

// Discount value types
export const DISCOUNT_VALUE_TYPES = [
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'percentage', label: 'Percentage' }
];

// Image validation constants
export const IMAGE_VALIDATION = {
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_SIZE_TEXT: '5MB'
};

// Form validation constants
export const VALIDATION_REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\d\s\-\+\(\)]+$/
};

// API URLs
export const API_ENDPOINTS = {
  CATERERS: '/api/caterers',
  CATERER_SALES: '/api/caterer-sales',
  CATERER_SALES_CREATE: '/api/caterer-sales/create',
  CATERER_SALES_NEXT_BILL_NUMBER: '/api/caterer-sales/next-bill-number',
  CATERER_SALES_HISTORY: '/api/caterer-sales/history',
  CATERER_SALES_CATERER: '/api/caterer-sales/caterer',
  CATERER_SALES_DETAILS: '/api/caterer-sales',
  PRODUCTS: '/api/products',
  CATEGORIES: '/api/categories',
  INVENTORY_PRODUCT_BATCHES: '/api/inventory/product',
  IMAGES: '/images'
};

// Error messages
export const ERROR_MESSAGES = {
  CATERER: {
    NAME_REQUIRED: 'Caterer name is required',
    CONTACT_REQUIRED: 'Contact person is required',
    PHONE_REQUIRED: 'Phone number is required',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_PHONE: 'Invalid phone number format',
    DUPLICATE_NAME_OR_PHONE: 'A caterer with this name or phone number already exists',
    NOT_FOUND: 'Caterer not found',
    DELETE_FAILED: 'Failed to delete caterer',
    FOREIGN_KEY_CONSTRAINT: 'Cannot delete caterer because it has associated sales records. Please delete all sales records for this caterer first.'
  },
  PRODUCT: {
    NOT_FOUND: 'Product not found',
    INVALID_PRICE: 'Invalid price',
    OUT_OF_STOCK: 'Product is out of stock',
    INVALID_QUANTITY: 'Invalid quantity'
  },
  PAYMENT: {
    INVALID_AMOUNT: 'Invalid payment amount',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    PAYMENT_FAILED: 'Payment failed'
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_FORMAT: 'Invalid format',
    FILE_TOO_LARGE: 'File size too large. Maximum 5MB allowed.',
    INVALID_FILE_TYPE: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
  }
};

// Success messages
export const SUCCESS_MESSAGES = {
  CATERER: {
    CREATED: 'Caterer created successfully',
    UPDATED: 'Caterer updated successfully',
    DELETED: 'Caterer deleted successfully'
  },
  SALE: {
    CREATED: 'Sale created successfully',
    UPDATED: 'Sale updated successfully',
    PAYMENT_RECORDED: 'Payment recorded successfully'
  },
  PAYMENT: {
    COLLECTED: 'Payment collected successfully'
  }
};

// Status mapping for bills
export const STATUS_MAPPING = {
  paid: {
    class: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircleIcon
  },
  pending: {
    class: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: ExclamationCircleIcon
  },
  overdue: {
    class: 'bg-red-100 text-red-800 border-red-200',
    icon: ExclamationCircleIcon
  },
  partial: {
    class: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: ExclamationCircleIcon
  }
};

// Payment method icons mapping
export const PAYMENT_ICONS = {
  cash: BanknotesIcon,
  upi: DevicePhoneMobileIcon,
  bank: BuildingLibraryIcon,
  check: DocumentCheckIcon,
  credit: CreditCardIcon,
  other: EllipsisHorizontalIcon
};

// File upload constants
export const FILE_UPLOAD = {
  ACCEPT: 'image/*',
  MULTIPLE: false
};


// Date formatting
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  INPUT: 'YYYY-MM-DD'
};

// Number formatting
export const NUMBER_FORMATTING = {
  CURRENCY: {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  },
  DECIMAL: {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }
};

// Mix product constants
export const MIX_PRODUCT = {
  IS_MIX_FLAG: true,
  TYPE_MIX: 'mix',
  DEFAULT_GST: '0'
};

// Batch selection constants
export const BATCH_SELECTION = {
  EXPIRY_WARNING_DAYS: 30,
  EXPIRED_CLASS: 'bg-red-100 border-red-300',
  EXPIRING_SOON_CLASS: 'bg-yellow-100 border-yellow-300',
  VALID_CLASS: 'bg-green-100 border-green-300'
};

// Safety check constants
export const SAFETY_CHECK = {
  ACTIONS: ['edit', 'delete', 'create']
};

// Cache constants
export const CACHE_CONFIG = {
  CATERERS_TTL: 10 * 60 * 1000, // 10 minutes
  PRODUCTS_TTL: 5 * 60 * 1000, // 5 minutes
  CATEGORIES_TTL: 15 * 60 * 1000, // 15 minutes
  SALES_HISTORY_TTL: 3 * 60 * 1000 // 3 minutes
};

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100
};

// Export all constants as a single object for convenience
export const CATERER_CONSTANTS = {
  UNIT_OPTIONS,
  PAYMENT_OPTIONS,
  PAYMENT_METHODS,
  CHARGE_TYPES,
  DISCOUNT_VALUE_TYPES,
  IMAGE_VALIDATION,
  VALIDATION_REGEX,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STATUS_MAPPING,
  PAYMENT_ICONS,
  FILE_UPLOAD,
  DATE_FORMATS,
  NUMBER_FORMATTING,
  MIX_PRODUCT,
  BATCH_SELECTION,
  SAFETY_CHECK,
  CACHE_CONFIG,
  PAGINATION
};

export default CATERER_CONSTANTS;