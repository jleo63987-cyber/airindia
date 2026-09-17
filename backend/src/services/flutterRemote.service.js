import crypto from "node:crypto";
import { createAdminSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { assertSupabase } from "../utils/supabase.js";
import {
  hashDeviceToken,
  issueDeviceToken,
  newSecurityCodeDigest,
  verifySecurityCode,
} from "../utils/deviceToken.js";

const sessionSelect = "id, workspace_id, device_id, requested_by, status, requested_permissions, approved_permissions, created_at, request_expires_at, approved_at, started_at, ended_at, end_reason";

function deviceName(input) {
  const hardware = [input.manufacturer, input.model].filter(Boolean).join(" ").trim();
  return (hardware || `Android ${input.username}`).slice(0, 120);
}

async function findDevice(admin, deviceId) {
  const { data, error } = await admin
    .from("devices")
    .select("id, workspace_id, device_user_id, name, owner_label, manufacturer, model, android_version, status, revoked_at")
    .eq("id", deviceId)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

async function sessionForDevice(admin, sessionId, deviceId) {
  const { data, error } = await admin
    .from("remote_sessions")
    .select(sessionSelect)
    .eq("id", sessionId)
    .eq("device_id", deviceId)
    .maybeSingle();
  assertSupabase(error);
  if (!data) throw new HttpError(404, "Session not found for this device.");
  return data;
}

async function recordEvent(admin, session, userId, eventType, payload = {}) {
  await admin.from("session_events").insert({
    workspace_id: session.workspace_id,
    session_id: session.id,
    actor_user_id: userId,
    actor_kind: "device",
    event_type: eventType,
    payload,
  });
}

export async function registerFlutterDevice(input) {
  const admin = createAdminSupabaseClient();
  const token = issueDeviceToken();
  const tokenHash = hashDeviceToken(token);

  const { data: existingCredential, error: existingError } = await admin
    .from("mobile_device_credentials")
    .select("id, device_id, device_user_id, security_code_salt, security_code_hash, revoked_at")
    .eq("installation_id", input.installationId)
    .maybeSingle();
  assertSupabase(existingError);

  if (existingCredential) {
    if (existingCredential.revoked_at) throw new HttpError(410, "This device registration was revoked.");
    if (!verifySecurityCode(
      input.securityCode,
      existingCredential.security_code_salt,
      existingCredential.security_code_hash,
    )) {
      throw new HttpError(401, "Security code does not match this registered device.");
    }
    const device = await findDevice(admin, existingCredential.device_id);
    if (!device || device.revoked_at) throw new HttpError(410, "This device was removed.");

    const { error: credentialUpdateError } = await admin
      .from("mobile_device_credentials")
      .update({
        token_hash: tokenHash,
        app_version: input.appVersion,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existingCredential.id);
    assertSupabase(credentialUpdateError);

    const { data: updatedDevice, error: deviceUpdateError } = await admin
      .from("devices")
      .update({
        name: deviceName(input),
        owner_label: `${input.username} · ${input.mobile}`.slice(0, 120),
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        android_version: String(input.androidSdk),
        status: "online",
        last_seen_at: new Date().toISOString(),
      })
      .eq("id", device.id)
      .select("id, workspace_id, name")
      .single();
    assertSupabase(deviceUpdateError);
    return { deviceId: updatedDevice.id, deviceToken: token, device: updatedDevice };
  }

  const syntheticEmail = `${input.installationId}@device.airindia.invalid`;
  const { data: createdAuth, error: authError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: crypto.randomBytes(48).toString("base64url"),
    email_confirm: true,
    user_metadata: {
      full_name: input.username,
      mobile: input.mobile,
      client_type: "flutter_mobile_device",
    },
  });
  if (authError || !createdAuth?.user) {
    throw new HttpError(500, authError?.message || "Could not create the device identity.");
  }

  const userId = createdAuth.user.id;
  try {
    const { data: device, error: deviceError } = await admin
      .from("devices")
      .insert({
        workspace_id: env.deviceRegistrationWorkspaceId,
        device_user_id: userId,
        name: deviceName(input),
        owner_label: `${input.username} · ${input.mobile}`.slice(0, 120),
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        android_version: String(input.androidSdk),
        battery_percent: 0,
        storage_percent: 0,
        signal_percent: 0,
        status: "online",
        last_seen_at: new Date().toISOString(),
      })
      .select("id, workspace_id, name")
      .single();
    assertSupabase(deviceError);

    const code = newSecurityCodeDigest(input.securityCode);
    const { error: credentialError } = await admin.from("mobile_device_credentials").insert({
      installation_id: input.installationId,
      device_id: device.id,
      device_user_id: userId,
      token_hash: tokenHash,
      security_code_salt: code.salt,
      security_code_hash: code.hash,
      username: input.username,
      mobile: input.mobile,
      app_version: input.appVersion,
      last_used_at: new Date().toISOString(),
    });
    assertSupabase(credentialError);
    return { deviceId: device.id, deviceToken: token, device };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw error;
  }
}

export async function pendingSession(identity) {
  const admin = createAdminSupabaseClient();
  const { data: session, error } = await admin
    .from("remote_sessions")
    .select(sessionSelect)
    .eq("device_id", identity.deviceId)
    .eq("status", "requested")
    .gt("request_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertSupabase(error);
  if (!session) return { session: null };

  let requesterName = "Support operator";
  if (session.requested_by) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", session.requested_by)
      .maybeSingle();
    requesterName = profile?.full_name || requesterName;
  }
  return {
    session: {
      id: session.id,
      requesterName,
      createdAt: session.created_at,
    },
  };
}

export async function consentToSession(identity, sessionId, approved, capabilities = []) {
  const admin = createAdminSupabaseClient();
  const session = await sessionForDevice(admin, sessionId, identity.deviceId);
  if (session.status !== "requested") throw new HttpError(409, `Session is already ${session.status}.`);
  if (new Date(session.request_expires_at).getTime() <= Date.now()) {
    throw new HttpError(410, "Session request expired.");
  }

  if (!approved) {
    const { data, error } = await admin
      .from("remote_sessions")
      .update({
        status: "terminated",
        ended_at: new Date().toISOString(),
        end_reason: "rejected_by_device",
      })
      .eq("id", session.id)
      .eq("status", "requested")
      .select(sessionSelect)
      .single();
    assertSupabase(error);
    await recordEvent(admin, session, identity.deviceUserId, "session_rejected").catch(() => {});
    return data;
  }

  const requested = session.requested_permissions || {};
  const approvedPermissions = {
    screen_view: requested.screen_view === true && capabilities.includes("screen"),
    remote_input: requested.remote_input === true &&
      ["tap", "swipe", "navigation"].some((item) => capabilities.includes(item)),
    keyboard: requested.keyboard === true && capabilities.includes("text"),
    file_exchange: false,
  };
  if (!approvedPermissions.screen_view) {
    throw new HttpError(409, "The session did not request screen viewing.");
  }
  const { data, error } = await admin
    .from("remote_sessions")
    .update({
      status: "approved",
      approved_permissions: approvedPermissions,
      approved_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "requested")
    .select(sessionSelect)
    .single();
  assertSupabase(error);
  await recordEvent(admin, session, identity.deviceUserId, "session_approved", {
    approved_permissions: approvedPermissions,
  }).catch(() => {});
  return data;
}

function normalizeSignal(row) {
  const payload = row.payload || {};
  if (row.signal_type === "ice" || row.signal_type === "ice-candidate") {
    return {
      type: "candidate",
      candidate: payload.candidate,
      sdpMid: payload.sdpMid ?? null,
      sdpMLineIndex: payload.sdpMLineIndex ?? null,
    };
  }
  return { type: row.signal_type, sdp: payload.sdp };
}

export async function listDeviceSignals(identity, sessionId, after) {
  const admin = createAdminSupabaseClient();
  await sessionForDevice(admin, sessionId, identity.deviceId);
  let query = admin
    .from("webrtc_signals")
    .select("id, sender_user_id, signal_type, payload, created_at")
    .eq("session_id", sessionId)
    .neq("sender_user_id", identity.deviceUserId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (after) query = query.gt("created_at", after);
  const { data, error } = await query;
  assertSupabase(error);
  const rows = data || [];
  return {
    signals: rows.map(normalizeSignal),
    cursor: rows.at(-1)?.created_at || after || null,
  };
}

export async function publishDeviceSignal(identity, sessionId, signal) {
  const admin = createAdminSupabaseClient();
  const session = await sessionForDevice(admin, sessionId, identity.deviceId);
  if (!["approved", "active"].includes(session.status)) {
    throw new HttpError(409, "Session has not been accepted.");
  }
  const signalType = signal.type === "candidate" ? "ice" : signal.type;
  const payload = signal.type === "candidate"
    ? {
      candidate: signal.candidate,
      sdpMid: signal.sdpMid ?? null,
      sdpMLineIndex: signal.sdpMLineIndex ?? null,
    }
    : { sdp: signal.sdp };
  const { data, error } = await admin
    .from("webrtc_signals")
    .insert({
      session_id: session.id,
      sender_user_id: identity.deviceUserId,
      signal_type: signalType,
      payload,
    })
    .select("id")
    .single();
  assertSupabase(error);

  if (signal.type === "answer" && session.status === "approved") {
    const { error: startError } = await admin
      .from("remote_sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("status", "approved");
    assertSupabase(startError);
  }
  return { id: data.id };
}

export async function endDeviceSession(identity, sessionId, reason = "ended_by_device") {
  const admin = createAdminSupabaseClient();
  const session = await sessionForDevice(admin, sessionId, identity.deviceId);
  if (["terminated", "expired"].includes(session.status)) return session;
  const { data, error } = await admin
    .from("remote_sessions")
    .update({
      status: "terminated",
      ended_at: new Date().toISOString(),
      end_reason: reason,
    })
    .eq("id", session.id)
    .select(sessionSelect)
    .single();
  assertSupabase(error);
  await recordEvent(admin, session, identity.deviceUserId, "session_ended", { reason }).catch(() => {});
  return data;
}
