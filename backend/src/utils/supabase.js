import { HttpError } from "./httpError.js";

export function assertSupabase(error, fallback = "Database request failed") {
  if (!error) return;
  const message = error.message || fallback;
  const lower = message.toLowerCase();
  let status = 400;

  if (lower.includes("not authorized") || lower.includes("permission") || lower.includes("row-level security")) {
    status = 403;
  } else if (lower.includes("not found")) {
    status = 404;
  } else if (lower.includes("authentication required") || lower.includes("jwt")) {
    status = 401;
  } else if (lower.includes("duplicate") || lower.includes("already") || error.code === "23505") {
    status = 409;
  }

  throw new HttpError(status, message, { code: error.code || null });
}
