import { createAdminSupabaseClient } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { hashDeviceToken } from "../utils/deviceToken.js";
import { assertSupabase } from "../utils/supabase.js";

export function hasDeviceToken(req) {
  return typeof req.headers["x-device-token"] === "string";
}

export function skipUnlessDeviceToken(req, _res, next) {
  if (!hasDeviceToken(req)) return next("router");
  next();
}

export async function authenticateDevice(req, _res, next) {
  try {
    const token = req.headers["x-device-token"];
    if (typeof token !== "string" || token.length < 32 || token.length > 512) {
      throw new HttpError(401, "Valid X-Device-Token header required.");
    }

    const admin = createAdminSupabaseClient();
    const { data: credential, error: credentialError } = await admin
      .from("mobile_device_credentials")
      .select("id, device_id, device_user_id, installation_id, revoked_at")
      .eq("token_hash", hashDeviceToken(token))
      .is("revoked_at", null)
      .maybeSingle();
    assertSupabase(credentialError);
    if (!credential) throw new HttpError(401, "Invalid or revoked device token.");

    const { data: device, error: deviceError } = await admin
      .from("devices")
      .select("id, workspace_id, device_user_id, name, revoked_at")
      .eq("id", credential.device_id)
      .eq("device_user_id", credential.device_user_id)
      .maybeSingle();
    assertSupabase(deviceError);
    if (!device || device.revoked_at) throw new HttpError(410, "This device was removed.");

    req.supabase = admin;
    req.user = { id: credential.device_user_id, device: true };
    req.deviceIdentity = {
      credentialId: credential.id,
      installationId: credential.installation_id,
      deviceId: device.id,
      deviceUserId: credential.device_user_id,
      workspaceId: device.workspace_id,
    };

    // Best-effort usage timestamp; authentication should not fail if telemetry does.
    admin
      .from("mobile_device_credentials")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", credential.id)
      .then(() => {}, () => {});
    next();
  } catch (error) {
    next(error);
  }
}
