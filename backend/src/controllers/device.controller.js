import { createAdminSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import * as deviceService from "../services/device.service.js";
import * as sessionService from "../services/session.service.js";

function queryOf(req) {
  return req.validated?.query || req.query || {};
}

export async function list(req, res) {
  const data = await deviceService.listDevices(req.supabase, req.params.workspaceId);
  res.json({ data });
}

export async function one(req, res) {
  const query = queryOf(req);
  const data = await deviceService.getDevice(req.supabase, query.workspaceId, req.params.deviceId);
  if (!data) throw new HttpError(404, "Device not found in this workspace.");
  res.json({ data });
}

export async function openSession(req, res) {
  const query = queryOf(req);
  const device = await deviceService.getDevice(req.supabase, query.workspaceId, req.params.deviceId);
  if (!device) throw new HttpError(404, "Device not found in this workspace.");

  const data = await sessionService.getOpenSessionForDevice(
    req.supabase,
    query.workspaceId,
    req.params.deviceId,
  );
  res.json({ data: data || null });
}

export async function register(req, res) {
  const admin = createAdminSupabaseClient();
  const result = await deviceService.registerCurrentPhone(
    admin,
    env.deviceRegistrationWorkspaceId,
    req.user,
    req.body,
  );

  req.app.get("io")?.to(`workspace:${result.workspace.id}`).emit("device:changed", {
    device: result.device,
  });

  res.status(201).json({
    data: {
      deviceId: result.device.id,
      workspaceId: result.device.workspace_id,
      name: result.device.name,
      device: result.device,
    },
  });
}

export async function sync(req, res) {
  const query = queryOf(req);
  const admin = createAdminSupabaseClient();
  const data = await deviceService.getMobileDeviceSync(
    admin,
    query.deviceId,
    req.user.id,
    query.limit,
  );
  res.json({ data });
}

export async function presence(req, res) {
  await deviceService.assertActiveOwnedDevice(req.supabase, req.body.deviceId, req.user.id);
  const data = await deviceService.updatePresence(req.supabase, req.body);
  res.json({ data });
}

export async function pendingSessions(req, res) {
  const query = queryOf(req);
  await deviceService.assertActiveOwnedDevice(req.supabase, query.deviceId, req.user.id);
  const data = await deviceService.listPendingDeviceSessions(req.supabase, query.deviceId);
  res.json({ data });
}

export async function sessions(req, res) {
  const query = queryOf(req);
  await deviceService.assertActiveOwnedDevice(req.supabase, query.deviceId, req.user.id);
  const data = await deviceService.listDeviceSessions(req.supabase, query.deviceId, query.limit);
  res.json({ data });
}

export async function remove(req, res) {
  const query = queryOf(req);
  const allowed = await deviceService.canManageDevices(req.supabase, query.workspaceId, req.user.id);
  if (!allowed) throw new HttpError(403, "Only a workspace owner or admin can remove devices.");

  const admin = createAdminSupabaseClient();
  const removed = await deviceService.revokeDevice(
    admin,
    query.workspaceId,
    req.params.deviceId,
    req.user.id,
  );

  const io = req.app.get("io");
  io?.to(`device:${req.params.deviceId}`).emit("device:removed", {
    deviceId: req.params.deviceId,
    workspaceId: query.workspaceId,
  });
  io?.to(`workspace:${query.workspaceId}`).emit("device:changed", {
    deviceId: req.params.deviceId,
    removed: true,
  });

  res.json({ data: { id: removed.id, removed: true } });
}
