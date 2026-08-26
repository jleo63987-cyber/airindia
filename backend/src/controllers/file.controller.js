import * as fileService from "../services/file.service.js";

export async function list(req, res) {
  const data = await fileService.listTransfers(req.supabase, req.params.workspaceId, req.query.limit);
  res.json({ data });
}

export async function upload(req, res) {
  const data = await fileService.uploadTransfer(req.supabase, {
    workspaceId: req.body.workspaceId,
    deviceId: req.body.deviceId || null,
    sessionId: req.body.sessionId || null,
    file: req.file,
  });
  res.status(201).json({ data });
}

export async function download(req, res) {
  const data = await fileService.getDownloadUrl(req.supabase, req.params.fileId);
  res.json({ data });
}

export async function remove(req, res) {
  await fileService.deleteTransfer(req.supabase, req.params.fileId);
  res.status(204).end();
}
