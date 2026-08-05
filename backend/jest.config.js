/**
 * Jest configuration for the backend.
 *
 * Notes:
 * - The unit tests under __tests__/ are intentionally framework-free:
 *   they test pure utility modules (role resolution, cache helpers, etc.)
 *   and do NOT require MongoDB, Firebase, or HTTP servers to be running.
 * - To avoid loading optional native modules (e.g. mongoose, firebase-admin)
 *   when running pure unit tests, we use the default Node test runner.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  // Skip integration-style tests by default; they're opt-in via `npm run test:integration`.
  testPathIgnorePatterns: ["/node_modules/"],
  // Verbose per-file output for small unit suites.
  verbose: false,
  // Treat console.warn / console.error inside tests as soft signals (not failures).
  silent: false,
  // Clear mocks between tests automatically.
  clearMocks: true,
  // Fail the suite on unexpected open handles (e.g. setInterval not unref'd).
  detectOpenHandles: false,
};