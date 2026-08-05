/**
 * Request Manager
 *
 * Prevents duplicate in-flight requests for the same resource.
 * Mirrors Flutter Flow's FutureRequestManager pattern.
 *
 * Flutter Flow Reference:
 * - old_flutterflow_app/lib/flutter_flow/request_manager.dart
 */

export class RequestManager<T> {
  private pendingRequests = new Map<string, Promise<T>>();
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Perform a request, reusing in-flight requests for the same key
   */
  async performRequest(
    uniqueKey: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already in-flight
    const existing = this.pendingRequests.get(uniqueKey);
    if (existing) {
      console.log(`[RequestManager:${this.name}] Reusing in-flight request: ${uniqueKey}`);
      return existing;
    }

    // Start new request
    console.log(`[RequestManager:${this.name}] Starting new request: ${uniqueKey}`);
    const promise = requestFn();
    this.pendingRequests.set(uniqueKey, promise);

    try {
      const result = await promise;
      this.pendingRequests.delete(uniqueKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(uniqueKey);
      throw error;
    }
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.pendingRequests.clear();
    console.log(`[RequestManager:${this.name}] Cleared all pending requests`);
  }

  /**
   * Clear specific pending request
   */
  clearRequest(uniqueKey: string) {
    this.pendingRequests.delete(uniqueKey);
    console.log(`[RequestManager:${this.name}] Cleared request: ${uniqueKey}`);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      name: this.name,
      pendingCount: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys()),
    };
  }
}
