import * as service from "../services/mobileSecurity.service.js";

export async function status(req, res) {
  res.json({ data: await service.status(req.user.id) });
}

export async function setup(req, res) {
  res.status(201).json({ data: await service.setup(req.user.id, req.body.pin) });
}

export async function unlock(req, res) {
  res.json({ data: await service.unlock(req.user.id, req.body) });
}

export async function regenerate(req, res) {
  res.json({ data: await service.regenerateBackupCodes(req.user.id) });
}

export async function changePin(req, res) {
  res.json({ data: await service.changePin(req.user.id, req.body.pin) });
}
