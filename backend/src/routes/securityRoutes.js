/**
 * Security / CSRF routes.
 *
 * GET /csrf-token — Returns the current CSRF token for clients.
 *   Sets a signed cookie `_csrf` that csurf will read on mutations.
 *   Client must then send `x-xsrf-token: <token>` header on POST/PUT/PATCH/DELETE.
 */

const express = require("express");

const router = express.Router();

router.get("/csrf-token", (req, res) => {
  // csurf validates the request and attaches req.csrfToken().
  // If a valid cookie is already present, it regenerates and sets a fresh token.
  // We call it to ensure a token is available in the response cookie.
  // (The actual token is read from the signed cookie; we just need to
  // ensure the route is processed through the cookie-parser + csurf.)
  const token = req.csrfToken ? req.csrfToken() : null;
  res.set("X-CSRF-Token", token || "");
  res.status(200).json({
    success: true,
    csrfToken: token,
    instructions:
      "Include this token in the 'x-xsrf-token' header on all state-changing requests.",
  });
});

module.exports = router;
