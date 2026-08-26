import multer from "multer";

export function notFound(req, res) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: { message: error.message, code: error.code } });
  }

  const status = Number(error.status || 500);
  const body = {
    error: {
      message: error.message || "Internal server error.",
    },
  };

  if (error.details) body.error.details = error.details;
  if (process.env.NODE_ENV !== "production" && status >= 500) {
    body.error.stack = error.stack;
  }

  res.status(status).json(body);
}
