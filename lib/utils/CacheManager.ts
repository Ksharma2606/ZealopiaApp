/**
 * Cache Manager
 *
 * Replicates Flutter Flow's FutureRequestManager pattern.
 * Caches Firebase query results with TTL and prevents duplicate in-flight requests.
 *
 * Flutter Flow Reference:
 * - old_flutterflow_app/lib/app_state.dart:178-192
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>; // For in-flight request deduplication
}

export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private TTL: number;
  private name: string;

  constructor(name: string, ttlMs: number = 5 * 60 * 1000) { // 5 minutes default (like Flutter Flow)
    this.name = name;
    this.TTL = ttlMs;
  }

  /**
   * Perform a request with caching
   * Mirrors Flutter Flow's performRequest method
   */
  async performRequest(
    uniqueKey: string,
    requestFn: () => Promise<T>,
    overrideCache: boolean = false
  ): Promise<T> {
    // Check cache first
    const cached = this.cache.get(uniqueKey);
    const now = Date.now();

    if (!overrideCache && cached) {
      // Return cached data if still valid
      if ((now - cached.timestamp) < this.TTL) {
        console.log(`[CacheManager:${this.name}] Cache hit for: ${uniqueKey}`);
        return cached.data;
      }

      // Return in-flight promise if exists (prevents duplicate requests)
      if (cached.promise) {
        console.log(`[CacheManager:${this.name}] In-flight request for: ${uniqueKey}`);
        return cached.promise;
      }
    }

    // Cache miss or expired - fetch fresh data
    console.log(`[CacheManager:${this.name}] Cache miss for: ${uniqueKey}`);
    const promise = requestFn();

    // Store in-flight promise
    this.cache.set(uniqueKey, {
      data: undefined as any, // Will be updated when promise resolves
      timestamp: now,
      promise,
    });

    try {
      const data = await promise;

      // Update cache with resolved data
      this.cache.set(uniqueKey, {
        data,
        timestamp: now,
        promise: undefined,
      });

      return data;
    } catch (error) {
      // Remove failed request from cache
      this.cache.delete(uniqueKey);
      throw error;
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    console.log(`[CacheManager:${this.name}] Cache cleared`);
  }

  /**
   * Clear specific cache entry
   */
  clearKey(uniqueKey: string) {
    this.cache.delete(uniqueKey);
    console.log(`[CacheManager:${this.name}] Cleared cache for: ${uniqueKey}`);
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      name: this.name,
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Create singleton instances for different data types
export const userMembershipCache = new CacheManager<any>('UserMembership', 5 * 60 * 1000); // 5 min
export const groupCache = new CacheManager<any>('Group', 5 * 60 * 1000); // 5 min
export const userCache = new CacheManager<any>('User', 5 * 60 * 1000); // 5 min
