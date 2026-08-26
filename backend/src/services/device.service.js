import { assertSupabase } from "../utils/supabase.js";
import { HttpError } from "../utils/httpError.js";

const deviceSelect = "id, workspace_id, device_user_id, name, owner_label, manufacturer, model, android_version, battery_percent, storage_percent, network_type, signal_percent, location_label, status, last_seen_at, paired_at, created_at, revoked_at, revoked_by, revoke_reason";

export async function listDevices(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("devices")
    .select(deviceSelect)
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  assertSupabase(error);
  return data || [];
}

export async function getDevice(supabase, workspaceId, deviceId) {
  const { data, error } = await supabase
    .from("devices")
    .select(deviceSelect)
    .eq("workspace_id", workspaceId)
    .eq("id", deviceId)
    .is("revoked_at", null)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

/**
 * Direct enrollment: the authenticated mobile account itself becomes the
 * device identity. The workspace is chosen only by trusted Node config.
 * A web-revoked phone stays revoked and is never silently recreated.
 */
export async function registerCurrentPhone(adminSupabase, workspaceId, user, input) {
  const { data: existing, error: existingError } = await adminSupabase
    .from("devices")
    .select("id, revoked_at")
    .eq("device_user_id", user.id)
    .maybeSingle();
  assertSupabase(existingError);

  if (existing?.revoked_at) {
    throw new HttpError(410, "This device was removed from the AirLink web dashboard.");
  }

  const { data: workspace, error: workspaceError } = await adminSupabase
    .from("workspaces")
    .select("id, name")
    .eq("id", workspaceId)
    .maybeSingle();
  assertSupabase(workspaceError);
  if (!workspace) throw new HttpError(500, "Configured device registration workspace was not found.");

  const ownerLabel =
    input.ownerLabel ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Device owner";

  const payload = {
    workspace_id: workspace.id,
    device_user_id: user.id,
    name: input.deviceName,
    owner_label: String(ownerLabel).slice(0, 120),
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    android_version: input.androidVersion ?? null,
    battery_percent: input.batteryPercent ?? 0,
    storage_percent: input.storagePercent ?? 0,
    network_type: input.networkType ?? null,
    signal_percent: input.signalPercent ?? 0,
    status: "online",
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await adminSupabase
    .from("devices")
    .upsert(payload, { onConflict: "device_user_id" })
    .select(deviceSelect)
    .single();
  assertSupabase(error);

  return { device: data, workspace };
}

export async function assertActiveOwnedDevice(supabase, deviceId, userId) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, workspace_id, device_user_id, revoked_at")
    .eq("id", deviceId)
    .eq("device_user_id", userId)
    .maybeSingle();
  assertSupabase(error);

  if (!data) throw new HttpError(404, "Device not found for this mobile account.");
  if (data.revoked_at) throw new HttpError(410, "This device was removed from the AirLink web dashboard.");
  return data;
}

/**
 * Mobile reliability sync.
 *
 * The authenticated mobile account is verified against devices.device_user_id,
 * but the actual device/session rows are read with the trusted admin client.
 * This avoids a missed request when a client-side RLS policy is stale while
 * keeping PostgreSQL as the source of truth.
 */
export async function getMobileDeviceSync(adminSupabase, deviceId, userId, limit = 60) {
  const { data: device, error: deviceError } = await adminSupabase
    .from("devices")
    .select(deviceSelect)
    .eq("id", deviceId)
    .eq("device_user_id", userId)
    .maybeSingle();
  assertSupabase(deviceError);

  if (!device) throw new HttpError(404, "Device not found for this mobile account.");
  if (device.revoked_at) {
    throw new HttpError(410, "This device was removed from the AirLink web dashboard.");
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), 100);
  const { data: sessions, error: sessionsError } = await adminSupabase
    .from("remote_sessions")
    .select("id, workspace_id, device_id, status, requested_permissions, approved_permissions, created_at, request_expires_at, approved_at, started_at, ended_at, end_reason")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  assertSupabase(sessionsError);

  return {
    device,
    sessions: sessions || [],
  };
}

export async function updatePresence(supabase, input) {
  const { data, error } = await supabase.rpc("update_device_presence", {
    p_device_id: input.deviceId,
    p_status: input.status,
    p_battery_percent: input.batteryPercent,
    p_storage_percent: input.storagePercent,
    p_network_type: input.networkType ?? null,
    p_signal_percent: input.signalPercent,
    p_location_label: input.locationLabel ?? null,
  });
  assertSupabase(error);
  return data;
}

export async function listPendingDeviceSessions(supabase, deviceId) {
  const { data, error } = await supabase
    .from("remote_sessions")
    .select("id, workspace_id, device_id, status, requested_permissions, approved_permissions, created_at, request_expires_at, approved_at, started_at, ended_at, end_reason")
    .eq("device_id", deviceId)
    .eq("status", "requested")
    .gt("request_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  assertSupabase(error);
  return data || [];
}

export async function listDeviceSessions(supabase, deviceId, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const { data, error } = await supabase
    .from("remote_sessions")
    .select("id, workspace_id, device_id, status, requested_permissions, approved_permissions, created_at, request_expires_at, approved_at, started_at, ended_at, end_reason")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  assertSupabase(error);
  return data || [];
}

export async function getDeviceForIdentity(supabase, deviceId, userId) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, workspace_id, device_user_id, name, model, android_version, status, revoked_at")
    .eq("id", deviceId)
    .eq("device_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

export async function canManageDevices(supabase, workspaceId, userId) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  assertSupabase(error);
  return ["owner", "admin"].includes(data?.role);
}

export async function revokeDevice(adminSupabase, workspaceId, deviceId, actorUserId) {
  const now = new Date().toISOString();

  const { data: device, error: deviceError } = await adminSupabase
    .from("devices")
    .select(deviceSelect)
    .eq("workspace_id", workspaceId)
    .eq("id", deviceId)
    .is("revoked_at", null)
    .maybeSingle();
  assertSupabase(deviceError);
  if (!device) throw new HttpError(404, "Device not found in this workspace.");

  const { data: openSessions, error: sessionsError } = await adminSupabase
    .from("remote_sessions")
    .select("id, workspace_id")
    .eq("device_id", deviceId)
    .in("status", ["requested", "approved", "active"]);
  assertSupabase(sessionsError);

  if (openSessions?.length) {
    const ids = openSessions.map((row) => row.id);
    const { error: terminateError } = await adminSupabase
      .from("remote_sessions")
      .update({
        status: "terminated",
        ended_at: now,
        ended_by: actorUserId,
        end_reason: "device_removed_from_web",
      })
      .in("id", ids);
    assertSupabase(terminateError);

    const { error: eventError } = await adminSupabase.from("session_events").insert(
      openSessions.map((row) => ({
        workspace_id: row.workspace_id,
        session_id: row.id,
        actor_user_id: actorUserId,
        actor_kind: "operator",
        event_type: "device_removed",
        payload: { device_id: deviceId },
      })),
    );
    assertSupabase(eventError);
  }

  const { data: removed, error } = await adminSupabase
    .from("devices")
    .update({
      status: "offline",
      revoked_at: now,
      revoked_by: actorUserId,
      revoke_reason: "removed_from_web_dashboard",
    })
    .eq("id", deviceId)
    .eq("workspace_id", workspaceId)
    .select(deviceSelect)
    .single();
  assertSupabase(error);
  return removed;
}
