// server/src/middlewares/errorHandler.js
export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  const payload = {
    message: err.message || "Server error",
  };

  if (process.env.NODE_ENV !== "production") {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}
