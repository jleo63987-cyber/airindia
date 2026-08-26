import crypto from "node:crypto";
import { createAdminSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { issueUnlockToken } from "../utils/mobileUnlock.js";

function pinHash(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

function recoveryHash(code) {
  return crypto.createHmac("sha256", env.mobileUnlockSecret).update(code.toUpperCase()).digest("hex");
}

function newRecoveryCodes() {
  return Array.from({ length: 8 }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

async function rowFor(userId) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("mobile_security")
    .select("user_id, pin_salt, pin_hash, backup_code_hashes, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  return data;
}

async function save(userId, pin, { requireExisting = false } = {}) {
  const current = await rowFor(userId);
  if (requireExisting && !current) throw new HttpError(404, "App PIN is not configured.");
  if (!requireExisting && current) throw new HttpError(409, "App PIN is already configured.");

  const salt = crypto.randomBytes(24).toString("hex");
  const codes = newRecoveryCodes();
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("mobile_security").upsert({
    user_id: userId,
    pin_salt: salt,
    pin_hash: pinHash(pin, salt),
    backup_code_hashes: codes.map(recoveryHash),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new HttpError(500, error.message);
  return { backupCodes: codes, unlockToken: issueUnlockToken(userId) };
}

export async function status(userId) {
  const row = await rowFor(userId);
  return {
    pinEnabled: Boolean(row),
    backupCodesRemaining: row?.backup_code_hashes?.length || 0,
    updatedAt: row?.updated_at || null,
  };
}

export function setup(userId, pin) {
  return save(userId, pin);
}

export async function unlock(userId, { pin, backupCode }) {
  const row = await rowFor(userId);
  if (!row) throw new HttpError(428, "Set up an app PIN first.");

  if (pin) {
    const actual = Buffer.from(pinHash(pin, row.pin_salt), "hex");
    const expected = Buffer.from(row.pin_hash, "hex");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      throw new HttpError(401, "Incorrect PIN.");
    }
    return { unlockToken: issueUnlockToken(userId), usedBackupCode: false };
  }

  const normalized = backupCode.toUpperCase();
  const hash = recoveryHash(normalized);
  const hashes = row.backup_code_hashes || [];
  const index = hashes.indexOf(hash);
  if (index < 0) throw new HttpError(401, "Backup code is invalid or already used.");

  const next = hashes.filter((_, i) => i !== index);
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("mobile_security")
    .update({ backup_code_hashes: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);

  return {
    unlockToken: issueUnlockToken(userId),
    usedBackupCode: true,
    backupCodesRemaining: next.length,
  };
}

export async function regenerateBackupCodes(userId) {
  const row = await rowFor(userId);
  if (!row) throw new HttpError(428, "Set up an app PIN first.");
  const codes = newRecoveryCodes();
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("mobile_security")
    .update({ backup_code_hashes: codes.map(recoveryHash), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);
  return { backupCodes: codes };
}

export async function changePin(userId, pin) {
  const current = await rowFor(userId);
  if (!current) throw new HttpError(428, "Set up an app PIN first.");
  const salt = crypto.randomBytes(24).toString("hex");
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("mobile_security")
    .update({ pin_salt: salt, pin_hash: pinHash(pin, salt), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);
  return { ok: true, unlockToken: issueUnlockToken(userId) };
}
