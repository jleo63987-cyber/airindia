import { HttpError } from "../utils/httpError.js";
import * as service from "../services/flutterRemote.service.js";

function emitSession(req, sessionId, event, payload = {}) {
  req.app.get("io")?.to(`session:${sessionId}`).emit(event, { sessionId, ...payload });
}

export async function register(req, res) {
  const data = await service.registerFlutterDevice(req.body);
  req.app.get("io")?.to(`workspace:${data.device.workspace_id}`).emit("device:changed", {
    device: data.device,
  });
  res.status(201).json({ data });
}

export async function pending(req, res) {
  if (req.params.deviceId !== req.deviceIdentity.deviceId) {
    throw new HttpError(403, "Device token does not match the requested device.");
  }
  res.json({ data: await service.pendingSession(req.deviceIdentity) });
}

export async function accept(req, res) {
  const data = await service.consentToSession(
    req.deviceIdentity,
    req.params.sessionId,
    true,
    req.body.capabilities,
  );
  emitSession(req, data.id, "session:changed", { status: "approved" });
  res.json({ data });
}

export async function reject(req, res) {
  const data = await service.consentToSession(
    req.deviceIdentity,
    req.params.sessionId,
    false,
  );
  emitSession(req, data.id, "session:changed", { status: "terminated" });
  res.json({ data });
}

export async function signals(req, res) {
  const query = req.validated?.query || req.query;
  const data = await service.listDeviceSignals(
    req.deviceIdentity,
    req.params.sessionId,
    query.after,
  );
  res.json({ data });
}

export async function publishSignal(req, res) {
  const data = await service.publishDeviceSignal(
    req.deviceIdentity,
    req.params.sessionId,
    req.body,
  );
  const socketType = req.body.type === "candidate" ? "ice" : req.body.type;
  emitSession(req, req.params.sessionId, "webrtc:signal", {
    signalId: data.id,
    signalType: socketType,
    payload: req.body.type === "candidate"
      ? {
        candidate: req.body.candidate,
        sdpMid: req.body.sdpMid ?? null,
        sdpMLineIndex: req.body.sdpMLineIndex ?? null,
      }
      : { sdp: req.body.sdp },
    senderUserId: req.deviceIdentity.deviceUserId,
  });
  if (req.body.type === "answer") {
    emitSession(req, req.params.sessionId, "session:changed", { status: "active" });
  }
  res.status(201).json({ data });
}

export async function end(req, res) {
  const data = await service.endDeviceSession(req.deviceIdentity, req.params.sessionId);
  emitSession(req, data.id, "session:changed", { status: "terminated" });
  res.json({ data });
}
