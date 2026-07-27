/**
 * Unit tests for backend/src/utils/boundedCache.js
 *
 * The bounded cache is used as the single in-process cache layer across
 * the backend (see utils/CACHE_STRATEGY.js). These tests pin the contract:
 *
 *  - LRU eviction when maxKeys is exceeded (oldest keys are evicted first).
 *  - TTL-based expiration (entries are dropped after their TTL window).
 *  - Basic CRUD: get / set / del / has / keys / flushAll.
 *  - getStats() reports current size and the configured maxKeys.
 *
 * If any of these contracts change, the SCALE-2 unified cache story breaks.
 */

const BoundedCache = require("../boundedCache");

describe("BoundedCache - basic API", () => {
  test("stores and retrieves a value", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
    cache.close();
  });

  test("returns undefined for missing keys", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    expect(cache.get("missing")).toBeUndefined();
    cache.close();
  });

  test("overwrites existing value when set() called twice with same key", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.get("a")).toBe(2);
    cache.close();
  });

  test("del() removes a key", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    expect(cache.del("a")).toBe(1);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.del("a")).toBe(0);
    cache.close();
  });

  test("has() reports presence", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
    cache.close();
  });

  test("flushAll() empties the cache", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.flushAll();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(0);
    cache.close();
  });

  test("keys() returns all stored keys", () => {
    const cache = new BoundedCache({ maxKeys: 10, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.keys().sort()).toEqual(["a", "b"]);
    cache.close();
  });

  test("getStats() reports size and maxKeys", () => {
    const cache = new BoundedCache({ maxKeys: 5, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    const stats = cache.getStats();
    expect(stats.keys).toBe(2);
    expect(stats.maxKeys).toBe(5);
    cache.close();
  });
});

describe("BoundedCache - LRU eviction", () => {
  test("evicts the oldest key when maxKeys is exceeded", () => {
    const cache = new BoundedCache({ maxKeys: 3, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // Evicts 'a'
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
    cache.close();
  });

  test("get() promotes the accessed key to most-recently-used", () => {
    const cache = new BoundedCache({ maxKeys: 3, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.get("a"); // Promotes 'a' - it should now be the MRU
    cache.set("d", 4); // Evicts 'b' (now the oldest)
    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
    cache.close();
  });

  test("set() with same key keeps the key's MRU position", () => {
    const cache = new BoundedCache({ maxKeys: 2, stdTTL: 60, checkperiod: 0 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 11); // Re-set moves 'a' to MRU
    cache.set("c", 3); // Evicts 'b'
    expect(cache.get("a")).toBe(11);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    cache.close();
  });
});

describe("BoundedCache - TTL", () => {
  test("expires entries after TTL elapses", () => {
    jest.useFakeTimers();
    try {
      const cache = new BoundedCache({ maxKeys: 10, stdTTL: 1, checkperiod: 0 });
      cache.set("a", 1);
      expect(cache.get("a")).toBe(1);
      jest.advanceTimersByTime(1500);
      expect(cache.get("a")).toBeUndefined();
      cache.close();
    } finally {
      jest.useRealTimers();
    }
  });

  test("per-key TTL overrides the default TTL", () => {
    jest.useFakeTimers();
    try {
      const cache = new BoundedCache({ maxKeys: 10, stdTTL: 100, checkperiod: 0 });
      cache.set("a", 1); // default 100s
      cache.set("b", 2, 1); // 1s
      jest.advanceTimersByTime(2000);
      expect(cache.get("a")).toBe(1); // still alive
      expect(cache.get("b")).toBeUndefined(); // expired
      cache.close();
    } finally {
      jest.useRealTimers();
    }
  });
});