const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
});

const taskLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyGenerator: (req) => req.user?.email ?? ipKeyGenerator(req),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many task requests. Please slow down." },
});

module.exports = { globalLimiter, authLimiter, taskLimiter };