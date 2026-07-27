/**
 * Cache Strategy Overview (SCALE-2)
 *
 * Three layers collaborate; each has a single well-defined role.
 *
 *   1. BoundedCache (L1, in-process)
 *      -----------------------------
 *      - Hot path. TTL < 5 min typically.
 *      - Bounded (LRU eviction) to prevent unbounded memory growth.
 *      - Lost on process restart; that is fine because entries are cheap to
 *        recompute (one MongoDB lookup per key).
 *      - Use the shared helper at backend/src/utils/boundedCache.js.
 *
 *   2. MongoDB (L2, persistent storage)
 *      --------------------------------
 *      - The ONLY persistent layer; survives restarts.
 *      - Source of truth for class/student/notification payloads.
 *      - Writers invalidate the L1 cache via .del() / .flushAll().
 *      - NOT a cache; no TTL on MongoDB reads.
 *
 *   3. LMS API (L3, external system)
 *      ------------------------------
 *      - Slowest path. Reached only when L1 and L2 both miss.
 *      - Always write the response back to L2 before returning.
 *
 * Read flow:
 *   L1 hit  -> return cached payload
 *   L1 miss -> query L2 (MongoDB); warm L1; return
 *   L2 miss -> query LMS (L3); persist to L2; warm L1; return
 *
 * Write flow:
 *   mutator -> update L2 first -> invalidate L1 (.del() / .flushAll())
 *
 * Rules of the road:
 *   - Never introduce a sibling in-process cache (raw Map / Object literal)
 *     at the controller level. Always use `BoundedCache` for predictable
 *     memory behavior and consistent TTL semantics.
 *   - Never put a TTL on a MongoDB query - that makes the L2 layer ambiguous.
 *   - Cache keys must include the full set of inputs that change the result
 *     (centre ids, roles, status filter, etc.).
 */