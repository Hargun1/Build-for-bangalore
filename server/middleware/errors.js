const env = require("../config/env");

// Wraps async handlers so a rejected promise reaches the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

function notFound(req, res) {
  res.status(404).json({ message: `No API route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Upload is too large. Please use an image under 8 MB." });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid id." });
  }
  const status = err.status || 500;
  if (status >= 500 && !env.isTest) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }
  // Never leak internals (stack traces, Mongo messages) to clients in production.
  const message = status >= 500 && env.isProduction ? "Something went wrong on our side." : err.message;
  return res.status(status).json({ message, ...(err.extra || {}) });
}

module.exports = { asyncHandler, HttpError, notFound, errorHandler };
