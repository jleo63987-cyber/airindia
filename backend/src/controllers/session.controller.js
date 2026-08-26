import { HttpError } from "../utils/httpError.js";
import * as sessionService from "../services/session.service.js";

function emitSession(req, sessionId, event = "session:changed", payload = {}) {
  req.app.get("io")?.to(`session:${sessionId}`).emit(event, { sessionId, ...payload });
}

export async function list(req, res) {
  const data = await sessionService.listSessions(req.supabase, req.params.workspaceId, req.query.limit);
  res.json({ data });
}

export async function one(req, res) {
  const data = await sessionService.getSession(req.supabase, req.params.sessionId);
  res.json({ data });
}

export async function request(req, res) {
  const sessionId = await sessionService.requestSession(
    req.supabase,
    req.params.deviceId,
    req.body.permissions || {},
  );
  emitSession(req, sessionId, "session:requested");
  req.app.get("io")?.to(`device:${req.params.deviceId}`).emit("session:requested", {
    sessionId,
    deviceId: req.params.deviceId,
  });
  res.status(201).json({ data: sessionId });
}

export async function respond(req, res) {
  const before = await sessionService.getSession(req.supabase, req.params.sessionId);
  if (!before) throw new HttpError(404, "Session not found.");

  const requested = before.requested_permissions || {};
  const incoming = req.body.approvedPermissions || {};
  const approvedPermissions = {};
  for (const key of ["screen_view", "remote_input", "keyboard", "file_exchange"]) {
    approvedPermissions[key] = req.body.approved === true && requested[key] === true && incoming[key] === true;
  }

  const status = await sessionService.respondToSession(
    req.supabase,
    req.params.sessionId,
    req.body.approved,
    approvedPermissions,
  );

  // Database-authoritative lifecycle: Accept writes only requested -> approved.
  // The Android client starts WebRTC from the approved row and calls /start only
  // after the peer is actually connected, which writes approved -> active.

  emitSession(req, req.params.sessionId, "session:changed", { status });
  const session = await sessionService.getSession(req.supabase, req.params.sessionId);
  if (session?.device_id) {
    req.app.get("io")?.to(`device:${session.device_id}`).emit("session:changed", {
      sessionId: req.params.sessionId,
      status,
    });
  }
  res.json({ data: status });
}

export async function start(req, res) {
  const data = await sessionService.startSession(req.supabase, req.params.sessionId);
  emitSession(req, req.params.sessionId, "session:changed", { status: "active" });
  const session = await sessionService.getSession(req.supabase, req.params.sessionId);
  if (session?.device_id) {
    req.app.get("io")?.to(`device:${session.device_id}`).emit("session:changed", {
      sessionId: req.params.sessionId,
      status: "active",
    });
  }
  res.json({ data });
}

export async function end(req, res) {
  const before = await sessionService.getSession(req.supabase, req.params.sessionId);
  const data = await sessionService.endSession(
    req.supabase,
    req.params.sessionId,
    req.body.reason || "ended",
  );
  emitSession(req, req.params.sessionId, "session:changed", { status: "terminated" });
  if (before?.device_id) {
    req.app.get("io")?.to(`device:${before.device_id}`).emit("session:changed", {
      sessionId: req.params.sessionId,
      status: "terminated",
    });
  }
  res.json({ data });
}

export async function control(req, res) {
  const session = await sessionService.getSession(req.supabase, req.params.sessionId);
  if (!session) throw new HttpError(404, "Session not found.");

  const operatorAllowed = await sessionService.operatorCanControl(
    req.supabase,
    session.workspace_id,
    req.user.id,
  );
  if (!operatorAllowed) throw new HttpError(403, "Workspace operator access required.");
  if (session.status !== "active") throw new HttpError(409, "Remote session is not active.");
  if (session.approved_permissions?.remote_input !== true) {
    throw new HttpError(403, "Remote input was not approved by the Android owner.");
  }

  req.app.get("io")?.to(`device:${session.device_id}`).emit("control:input", {
    sessionId: session.id,
    command: req.body.command,
    sentAt: new Date().toISOString(),
  });

  res.status(202).json({ data: { ok: true } });
}

export async function events(req, res) {
  const data = await sessionService.listEvents(req.supabase, req.params.sessionId);
  res.json({ data });
}
export async function messages(req, res) {
  const data = await sessionService.listMessages(req.supabase, req.params.sessionId);
  res.json({ data });
}
export async function sendMessage(req, res) {
  const data = await sessionService.sendMessage(req.supabase, req.params.sessionId, req.body.body);
  emitSession(req, req.params.sessionId, "session:message", { messageId: data });
  res.status(201).json({ data });
}
export async function signals(req, res) {
  const data = await sessionService.listSignals(req.supabase, req.params.sessionId);
  res.json({ data });
}
export async function publishSignal(req, res) {
  const data = await sessionService.publishSignal(
    req.supabase,
    req.params.sessionId,
    req.body.signalType,
    req.body.payload,
  );
  emitSession(req, req.params.sessionId, "webrtc:signal", {
    signalId: data,
    signalType: req.body.signalType === "ice-candidate" ? "ice" : req.body.signalType,
    payload: req.body.payload,
    senderUserId: req.user.id,
  });
  res.status(201).json({ data });
}
