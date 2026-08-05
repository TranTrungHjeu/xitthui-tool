/**
 * Shared HTTP client with keep-alive.
 *
 * Creates a single axios instance with a persistent TCP connection pool
 * (HTTP Agent with keepAlive: true). This is used by all internal
 * outbound HTTP calls (LMS API, Slack webhooks, email services, etc.)
 * to avoid the overhead of establishing a new TCP connection for every request.
 *
 * Usage:
 *   const httpClient = require("./utils/httpClient");
 *   const res = await httpClient.post(url, data, options);
 *
 * For GraphQL calls with large payloads, use the dedicated `graphqlClient`
 * which uses a larger max body size.
 */

const http = require("http");
const https = require("https");
const axios = require("axios");

// Persistent keep-alive agent (reused across all axios instances in this process).
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000, // 30s TCP keep-alive
  maxSockets: 64, // max concurrent sockets per host
  maxFreeSockets: 16,
  timeout: 60_000,
  scheduling: "fifo",
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 60_000,
  scheduling: "fifo",
});

const httpClient = axios.create({
  httpAgent,
  httpsAgent,
  // Global timeout for all requests (override per-call if needed)
  timeout: 30_000,
  // Preserve raw error response data for debugging
  validateStatus: () => true,
});

/**
 * GraphQL-optimized client: larger timeout + body size for LMS queries.
 */
const graphqlClient = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 60_000, // LMS queries can take longer
  maxContentLength: 50 * 1024 * 1024, // 50MB
  maxBodyLength: 50 * 1024 * 1024,
  validateStatus: () => true,
});

module.exports = {
  httpClient,
  graphqlClient,
};
