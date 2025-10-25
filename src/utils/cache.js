// Simple in-memory cache implementation
class Cache {
  constructor(ttl = 5 * 60 * 1000) { // Default TTL: 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  // Generate a unique key for cache entries
  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});
    return `${endpoint}:${JSON.stringify(sortedParams)}`;
  }

  // Get item from cache
  get(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  // Set item in cache
  set(endpoint, params, data) {
    const key = this.generateKey(endpoint, params);
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }

  // Clear expired items
  clearExpired() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear();
  }

  // Get cache statistics
  getStats() {
    this.clearExpired();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create a singleton cache instance
const cache = new Cache();

// Cache middleware for API calls
export const withCache = async (endpoint, fetchFn, params = {}, options = {}) => {
  const { ttl, forceRefresh = false } = options;
  
  // Skip cache for force refresh
  if (!forceRefresh) {
    const cachedData = cache.get(endpoint, params);
    if (cachedData) {
      console.log(`Cache hit for ${endpoint}`);
      return cachedData;
    }
  }

  // Fetch data from API
  const data = await fetchFn(params);
  
  // Store in cache (if data is valid)
  if (data && (!data.error || data.success)) {
    cache.set(endpoint, params, data);
  }
  
  return data;
};

// Cache utilities
export const cacheUtils = {
  // Get cache stats
  getStats: () => cache.getStats(),
  
  // Clear cache
  clear: () => cache.clear(),
  
  // Clear expired items
  clearExpired: () => cache.clearExpired(),
  
  // Pre-warm cache with frequently accessed data
  preWarm: async (fetchProducts, fetchCaterers) => {
    try {
      console.log('Pre-warming cache...');
      
      // Fetch and cache products
      const productsData = await fetchProducts();
      if (productsData && productsData.success) {
        cache.set('/api/products', {}, productsData);
        console.log('Products cached successfully');
      }
      
      // Fetch and cache caterers
      const caterersData = await fetchCaterers();
      if (caterersData && caterersData.success) {
        cache.set('/api/caterers', {}, caterersData);
        console.log('Caterers cached successfully');
      }
      
    } catch (error) {
      console.error('Error pre-warming cache:', error);
    }
  }
};

export default cache;