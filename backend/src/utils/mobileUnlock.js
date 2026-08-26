import crypto from "node:crypto";
import { env } from "../config/env.js";
import { HttpError } from "./httpError.js";

const TTL_SECONDS = 12 * 60 * 60;

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(input) {
  return crypto.createHmac("sha256", env.mobileUnlockSecret).update(input).digest("base64url");
}

export function issueUnlockToken(userId) {
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyUnlockToken(token, expectedUserId) {
  if (!token || !token.includes(".")) throw new HttpError(401, "App PIN unlock required.");
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  const a = Buffer.from(signature || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new HttpError(401, "Invalid app unlock token.");
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(401, "Invalid app unlock token.");
  }
  if (payload.sub !== expectedUserId || Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "App unlock token expired.");
  }
  return payload;
}
