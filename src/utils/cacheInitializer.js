import { cacheService } from '../services/apiService';

class CacheInitializer {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  // Initialize cache with frequently accessed data
  async initialize() {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  // Perform the actual cache initialization
  async performInitialization() {
    try {
      console.log('Starting cache initialization...');
      
      // Pre-warm cache with frequently accessed data
      await cacheService.preWarmCache();
      
      // Set up periodic cache refresh
      this.setupPeriodicRefresh();
      
      this.initialized = true;
      console.log('Cache initialization completed successfully');
      
    } catch (error) {
      console.error('Cache initialization failed:', error);
      throw error;
    }
  }

  // Set up periodic cache refresh
  setupPeriodicRefresh() {
    // Refresh products every 5 minutes
    setInterval(async () => {
      try {
        console.log('Periodic cache refresh: Products');
        await cacheService.forceRefresh(
          '/api/products',
          {},
          async () => {
            const response = await fetch('http://localhost:5000/api/products');
            return await response.json();
          }
        );
      } catch (error) {
        console.error('Error refreshing products cache:', error);
      }
    }, 5 * 60 * 1000);

    // Refresh caterers every 10 minutes
    setInterval(async () => {
      try {
        console.log('Periodic cache refresh: Caterers');
        await cacheService.forceRefresh(
          '/api/caterers',
          {},
          async () => {
            const response = await fetch('http://localhost:5000/api/caterers');
            return await response.json();
          }
        );
      } catch (error) {
        console.error('Error refreshing caterers cache:', error);
      }
    }, 10 * 60 * 1000);

    // Refresh categories every 15 minutes
    setInterval(async () => {
      try {
        console.log('Periodic cache refresh: Categories');
        await cacheService.forceRefresh(
          '/api/categories',
          {},
          async () => {
            const response = await fetch('http://localhost:5000/api/categories');
            return await response.json();
          }
        );
      } catch (error) {
        console.error('Error refreshing categories cache:', error);
      }
    }, 15 * 60 * 1000);
  }

  // Get cache statistics
  getCacheStats() {
    return cacheService.getCacheStats();
  }

  // Clear all cache
  clearCache() {
    return cacheService.clearCache();
  }
}

// Create singleton instance
const cacheInitializer = new CacheInitializer();

// Export utility functions
export const initializeCache = () => cacheInitializer.initialize();
export const getCacheStats = () => cacheInitializer.getCacheStats();
export const clearCache = () => cacheInitializer.clearCache();

// Auto-initialize cache when module is imported
if (typeof window !== 'undefined') {
  // Only run in browser environment
  initializeCache().catch(error => {
    console.error('Auto cache initialization failed:', error);
  });
}

export default cacheInitializer;