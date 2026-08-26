import { assertSupabase } from "../utils/supabase.js";

const sessionSelect = "id, workspace_id, device_id, requested_by, status, requested_permissions, approved_permissions, created_at, request_expires_at, approved_at, started_at, ended_at, end_reason";

export async function getOpenSessionForDevice(supabase, workspaceId, deviceId) {
  const { data, error } = await supabase
    .from("remote_sessions")
    .select(sessionSelect)
    .eq("workspace_id", workspaceId)
    .eq("device_id", deviceId)
    .in("status", ["requested", "approved", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

export async function listSessions(supabase, workspaceId, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { data, error } = await supabase
    .from("remote_sessions")
    .select(`${sessionSelect}, device:devices(name, owner_label), operator:profiles!remote_sessions_requested_by_fkey(full_name)`)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  assertSupabase(error);
  return data || [];
}

export async function getSession(supabase, sessionId) {
  const { data, error } = await supabase
    .from("remote_sessions")
    .select(`${sessionSelect}, device:devices(id, name, owner_label, android_version, battery_percent, network_type, signal_percent, location_label, status)`)
    .eq("id", sessionId)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

export async function requestSession(supabase, deviceId, permissions = {}) {
  const { data, error } = await supabase.rpc("create_remote_session", {
    p_device_id: deviceId,
    p_requested_permissions: {
      screen_view: true,
      remote_input: true,
      keyboard: false,
      file_exchange: false,
      ...permissions,
    },
  });
  assertSupabase(error);
  return data;
}

export async function respondToSession(supabase, sessionId, approved, approvedPermissions = {}) {
  const { data, error } = await supabase.rpc("respond_to_remote_session", {
    p_session_id: sessionId,
    p_approved: approved,
    p_approved_permissions: approvedPermissions,
  });
  assertSupabase(error);
  return data;
}

export async function startSession(supabase, sessionId) {
  const { data, error } = await supabase.rpc("start_remote_session", { p_session_id: sessionId });
  assertSupabase(error);
  return data;
}

export async function endSession(supabase, sessionId, reason = "ended") {
  const { data, error } = await supabase.rpc("end_remote_session", {
    p_session_id: sessionId,
    p_reason: reason,
  });
  assertSupabase(error);
  return data;
}

export async function operatorCanControl(supabase, workspaceId, userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  assertSupabase(error);
  return Boolean(data);
}

export async function listEvents(supabase, sessionId) {
  const { data, error } = await supabase
    .from("session_events")
    .select("id, event_type, actor_kind, payload, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  assertSupabase(error);
  return data || [];
}

export async function listMessages(supabase, sessionId) {
  const { data, error } = await supabase
    .from("session_messages")
    .select("id, sender_user_id, sender_kind, body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  assertSupabase(error);
  return data || [];
}

export async function sendMessage(supabase, sessionId, body) {
  const { data, error } = await supabase.rpc("send_session_message", {
    p_session_id: sessionId,
    p_body: body,
  });
  assertSupabase(error);
  return data;
}

export async function listSignals(supabase, sessionId) {
  const { data, error } = await supabase
    .from("webrtc_signals")
    .select("id, sender_user_id, signal_type, payload, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  assertSupabase(error);
  return data || [];
}

export async function publishSignal(supabase, sessionId, signalType, payload) {
  // Normalize the live-screen client name to the DB's original signal type.
  const normalizedType = signalType === "ice-candidate" ? "ice" : signalType;
  const { data, error } = await supabase.rpc("publish_webrtc_signal", {
    p_session_id: sessionId,
    p_signal_type: normalizedType,
    p_payload: payload,
  });
  assertSupabase(error);
  return data;
}
