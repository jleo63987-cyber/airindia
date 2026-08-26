import { createPublicSupabaseClient, createUserSupabaseClient } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function authenticate(req, _res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) throw new HttpError(401, "Bearer token required.");

    const verifier = createPublicSupabaseClient();
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user) {
      throw new HttpError(401, "Invalid or expired access token.");
    }

    req.accessToken = token;
    req.user = data.user;
    req.supabase = createUserSupabaseClient(token);
    next();
  } catch (error) {
    next(error);
  }
}
