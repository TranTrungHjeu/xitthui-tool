const { childLogger } = require("./logger.js");
const log = childLogger("BoundedCache");

/**
 * Bounded LRU Cache
 *
 * A bounded cache implementation that evicts the least recently used
 * items when the cache exceeds the max size. Wraps NodeCache-like API
 * but enforces a hard size limit.
 *
 * Usage:
 *   const cache = new BoundedCache({ maxKeys: 10000, stdTTL: 300 });
 *   cache.set(key, value);
 *   const value = cache.get(key);
 */

class BoundedCache {
  /**
   * @param {Object} options
   * @param {number} options.maxKeys - Maximum number of keys to keep
   * @param {number} options.stdTTL - Standard TTL in seconds
   * @param {number} options.checkperiod - Check period in seconds for cleanup
   */
  constructor(options = {}) {
    this.maxKeys = options.maxKeys || 10000;
    this.stdTTL = (options.stdTTL || 300) * 1000; // Convert to ms
    this.checkperiod = (options.checkperiod || 60) * 1000; // Convert to ms
    this.cache = new Map(); // For O(1) access and LRU ordering

    // Start periodic cleanup
    if (this.checkperiod > 0) {
      this.cleanupInterval = setInterval(() => {
        this._cleanup();
      }, this.checkperiod);
      // Don't keep process alive
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Get value by key
   * @param {string} key
   * @returns {*} - Value or undefined if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value
   * @param {string} key
   * @param {*} value
   * @param {number} ttl - Optional TTL in seconds (overrides stdTTL)
   * @returns {boolean} - True if successful
   */
  set(key, value, ttl) {
    // If key already exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const ttlMs = ttl ? ttl * 1000 : this.stdTTL;
    const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : null;

    this.cache.set(key, { value, expiresAt });

    // Evict oldest entries if over limit
    while (this.cache.size > this.maxKeys) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    return true;
  }

  /**
   * Delete key
   * @param {string} key
   * @returns {number} - Number of keys deleted (0 or 1)
   */
  del(key) {
    return this.cache.delete(key) ? 1 : 0;
  }

  /**
   * Check if key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Flush all keys
   */
  flushAll() {
    this.cache.clear();
  }

  /**
   * Get all keys
   * @returns {Array<string>}
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache stats
   * @returns {Object}
   */
  getStats() {
    return {
      keys: this.cache.size,
      maxKeys: this.maxKeys,
      hits: this.hits || 0,
      misses: this.misses || 0,
    };
  }

  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      log.info(`[BoundedCache] Cleaned ${cleaned} expired entries. Current size: ${this.cache.size}`);
    }
  }

  /**
   * Stop cleanup interval
   */
  close() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

module.exports = BoundedCache;