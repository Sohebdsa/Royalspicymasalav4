import { withCache, cacheUtils } from '../utils/cache';

// Base API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Caterer API functions
export const catererService = {
  // Get all caterers with caching
  getCaterers: () => withCache(
    '/api/caterers',
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/caterers`);
      return await response.json();
    },
    {},
    { ttl: 10 * 60 * 1000 } // 10 minutes cache
  ),

  // Get single caterer by ID (no cache as it's specific)
  getCatererById: (id) => 
    fetch(`${API_BASE_URL}/api/caterers/${id}`)
      .then(response => response.json()),

  // Create new caterer
  createCaterer: (catererData) =>
    fetch(`${API_BASE_URL}/api/caterers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(catererData),
    }).then(response => response.json()),

  // Update caterer
  updateCaterer: (id, catererData) =>
    fetch(`${API_BASE_URL}/api/caterers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(catererData),
    }).then(response => response.json()),

  // Delete caterer
  deleteCaterer: (id) =>
    fetch(`${API_BASE_URL}/api/caterers/${id}`, {
      method: 'DELETE',
    }).then(response => response.json()),
};

// Product API functions
export const productService = {
  // Get all products with caching
  getProducts: () => withCache(
    '/api/products',
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/products`);
      return await response.json();
    },
    {},
    { ttl: 5 * 60 * 1000 } // 5 minutes cache
  ),

  // Get single product by ID (no cache as it's specific)
  getProductById: (id) =>
    fetch(`${API_BASE_URL}/api/products/${id}`)
      .then(response => response.json()),

  // Create new product
  createProduct: (productData) =>
    fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    }).then(response => response.json()),

  // Update product
  updateProduct: (id, productData) =>
    fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(productData),
    }).then(response => response.json()),

  // Delete product
  deleteProduct: (id) =>
    fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'DELETE',
    }).then(response => response.json()),

  // Get product categories with caching
  getCategories: () => withCache(
    '/api/categories',
    async () => {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      return await response.json();
    },
    {},
    { ttl: 15 * 60 * 1000 } // 15 minutes cache for categories
  ),

  // Get product batches by product ID
  getProductBatches: (productId) =>
    fetch(`${API_BASE_URL}/api/inventory/product/${productId}/batches`)
      .then(response => response.json()),
};

// Caterer Sales API functions
export const catererSalesService = {
  // Get next bill number (no cache as it needs to be fresh)
  getNextBillNumber: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/caterer-sales/next-bill-number`);
      if (response.ok) {
        return await response.json();
      } else {
        // Fallback response if endpoint doesn't exist
        return { success: true, bill_number: '#0001' };
      }
    } catch (error) {
      // Fallback response if request fails
      console.warn('Could not fetch next bill number:', error);
      return { success: true, bill_number: '#0001' };
    }
  },

  // Create new caterer sale
  createSale: async (saleData) => {
    console.log('createSale called with data:', saleData);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/caterer-sales/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saleData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create sale');
      }
      
      console.log('Sale created successfully:', result);
      
      // Invalidate related caches after successful sale creation
      if (cacheUtils.invalidate) {
        cacheUtils.invalidate(`/api/caterer-sales/history/${saleData.caterer_id}`);
        cacheUtils.invalidate(`/api/caterers/${saleData.caterer_id}`);
      }
      
      return result;
    } catch (error) {
      console.error('Error in createSale:', error);
      throw error;
    }
  },

  // Get caterer sales history with caching
  getSalesHistory: (catererId, params = {}) => withCache(
    `/api/caterer-sales/history/${catererId}`,
    async () => {
      const queryParams = new URLSearchParams(params);
      const response = await fetch(`${API_BASE_URL}/api/caterer-sales/history/${catererId}?${queryParams}`);
      return await response.json();
    },
    params,
    { ttl: 3 * 60 * 1000 } // 3 minutes cache for sales history
  ),

  // Get all sales for a specific caterer (no cache for real-time data)
  getCatererSales: async (catererId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/caterer-sales/caterer/${catererId}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch sales');
      }
      
      return result.sales;
    } catch (error) {
      console.error('Error fetching caterer sales:', error);
      throw error;
    }
  },

  // Get sale details with items and payments
  getSaleDetails: async (saleId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/caterer-sales/${saleId}/details`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch sale details');
      }
      
      return result.sale;
    } catch (error) {
      console.error('Error fetching sale details:', error);
      throw error;
    }
  },
};

// Cache management utilities
export const cacheService = {
  // Pre-warm cache with frequently accessed data
  preWarmCache: async () => {
    try {
      console.log('Pre-warming API cache...');
      
      // Fetch and cache products
      const productsData = await productService.getProducts();
      if (productsData && productsData.success) {
        console.log('Products cached successfully');
      }
      
      // Fetch and cache caterers
      const caterersData = await catererService.getCaterers();
      if (caterersData && caterersData.success) {
        console.log('Caterers cached successfully');
      }
      
      // Fetch and cache categories
      const categoriesData = await productService.getCategories();
      if (categoriesData && categoriesData.success) {
        console.log('Categories cached successfully');
      }
      
    } catch (error) {
      console.error('Error pre-warming cache:', error);
    }
  },

  // Clear all cache
  clearCache: () => {
    cacheUtils.clear();
    console.log('All cache cleared');
  },

  // Get cache statistics
  getCacheStats: () => {
    const stats = cacheUtils.getStats();
    console.log('Cache stats:', stats);
    return stats;
  },

  // Force refresh specific cache
  forceRefresh: async (endpoint, params = {}, fetchFn) => {
    console.log(`Force refreshing cache for ${endpoint}`);
    return withCache(endpoint, fetchFn, params, { forceRefresh: true });
  },
  
  // Invalidate specific cache entry
  invalidateCache: (key) => {
    if (cacheUtils.invalidate) {
      cacheUtils.invalidate(key);
      console.log(`Cache invalidated for: ${key}`);
    }
  },
};

// Export all services
export default {
  caterer: catererService,
  product: productService,
  catererSales: catererSalesService,
  cache: cacheService,
};
