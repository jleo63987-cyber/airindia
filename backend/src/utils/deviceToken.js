import crypto from "node:crypto";
import { env } from "../config/env.js";

export function issueDeviceToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashDeviceToken(token) {
  return crypto.createHmac("sha256", env.deviceTokenSecret).update(token).digest("hex");
}

export function hashSecurityCode(code, salt) {
  return crypto.scryptSync(code, salt, 64).toString("hex");
}

export function newSecurityCodeDigest(code) {
  const salt = crypto.randomBytes(24).toString("hex");
  return { salt, hash: hashSecurityCode(code, salt) };
}

export function verifySecurityCode(code, salt, expectedHex) {
  const actual = Buffer.from(hashSecurityCode(code, salt), "hex");
  const expected = Buffer.from(expectedHex || "", "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
