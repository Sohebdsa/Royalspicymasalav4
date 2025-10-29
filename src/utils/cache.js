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
  set(endpoint, params, data, customTtl = null) {
    const key = this.generateKey(endpoint, params);
    this.cache.set(key, {
      data,
      expiry: Date.now() + (customTtl || this.ttl)
    });
  }

  // Invalidate specific cache entry
  invalidate(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      console.log(`✅ Cache invalidated for: ${endpoint}`);
    } else {
      console.log(`ℹ️  No cache found for: ${endpoint}`);
    }
    
    return deleted;
  }

  // Invalidate all cache entries matching a pattern
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    console.log(`✅ Invalidated ${count} cache entries matching: ${pattern}`);
    return count;
  }

  // Clear expired items
  clearExpired() {
    const now = Date.now();
    let count = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      console.log(`🧹 Cleared ${count} expired cache entries`);
    }
    return count;
  }

  // Clear all cache
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 Cleared all cache (${size} entries)`);
    return size;
  }

  // Get cache statistics
  getStats() {
    this.clearExpired();
    const entries = Array.from(this.cache.entries()).map(([key, item]) => ({
      key,
      expiresIn: Math.max(0, item.expiry - Date.now()),
      dataSize: JSON.stringify(item.data).length
    }));
    
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      entries,
      totalSize: entries.reduce((sum, e) => sum + e.dataSize, 0)
    };
  }

  // Check if cache has a specific entry
  has(endpoint, params = {}) {
    const key = this.generateKey(endpoint, params);
    return this.cache.has(key);
  }
}

// Create a singleton cache instance
const cache = new Cache();

// Set up automatic cleanup of expired items every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.clearExpired();
  }, 5 * 60 * 1000);
}

// Cache middleware for API calls
export const withCache = async (endpoint, fetchFn, params = {}, options = {}) => {
  const { ttl, forceRefresh = false } = options;
  
  // Skip cache for force refresh
  if (!forceRefresh) {
    const cachedData = cache.get(endpoint, params);
    if (cachedData) {
      console.log(`📦 Cache hit for ${endpoint}`);
      return cachedData;
    }
  }

  // Fetch data from API
  try {
    const data = await fetchFn(params);
    
    // Store in cache (if data is valid)
    if (data && (!data.error || data.success)) {
      cache.set(endpoint, params, data, ttl);
    }
    
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ${endpoint}:`, error);
    throw error;
  }
};

// Cache utilities
export const cacheUtils = {
  // Get cache stats
  getStats: () => cache.getStats(),
  
  // Clear cache
  clear: () => cache.clear(),
  
  // Clear expired items
  clearExpired: () => cache.clearExpired(),
  
  // Invalidate specific cache entry
  invalidate: (endpoint, params = {}) => cache.invalidate(endpoint, params),
  
  // Invalidate all entries matching a pattern
  invalidatePattern: (pattern) => cache.invalidatePattern(pattern),
  
  // Check if cache has entry
  has: (endpoint, params = {}) => cache.has(endpoint, params),
  
  // Get cached data without expiry check (for debugging)
  peek: (endpoint, params = {}) => {
    const key = cache.generateKey(endpoint, params);
    return cache.cache.get(key);
  },
  
  // Pre-warm cache with frequently accessed data
  preWarm: async (fetchProducts, fetchCaterers) => {
    try {
      console.log('🔥 Pre-warming cache...');
      
      // Fetch and cache products
      const productsData = await fetchProducts();
      if (productsData && productsData.success) {
        cache.set('/api/products', {}, productsData);
        console.log('✅ Products cached successfully');
      }
      
      // Fetch and cache caterers
      const caterersData = await fetchCaterers();
      if (caterersData && caterersData.success) {
        cache.set('/api/caterers', {}, caterersData);
        console.log('✅ Caterers cached successfully');
      }
      
      console.log('🔥 Cache pre-warming complete');
    } catch (error) {
      console.error('❌ Error pre-warming cache:', error);
    }
  }
};

export default cache;
