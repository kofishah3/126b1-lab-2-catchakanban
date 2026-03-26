const rateLimit = require("express-rate-limit");

// Applies to ALL routes - general protection per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

// Applies to /auth/register and /auth/login - prevents brute force per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 15 minutes.",
  },
});

// Applies to /tasks - limits per user email, falls back to IP
const taskLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    if (req.user?.email) return req.user.email;
    // Use ipKeyGenerator to properly handle IPv6
    return rateLimit.ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: false,
  validate: { xForwardedForHeader: false }, // suppress IPv6 warning
  message: {
    success: false,
    message: "Too many task requests. Please slow down.",
  },
});

module.exports = { globalLimiter, authLimiter, taskLimiter };
