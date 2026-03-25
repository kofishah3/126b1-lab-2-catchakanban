const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

// Applies to ALL routes - general protection per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
});

// Applies to /auth/register and /auth/login - prevents brute force per IP
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
});

// Applies to /tasks - limits per user email (falls back to IP if not logged in)
const taskLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60,
    keyGenerator: (req) => req.user?.email ?? ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many task requests. Please slow down." },
});

module.exports = { globalLimiter, authLimiter, taskLimiter };