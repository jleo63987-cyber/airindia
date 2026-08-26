import * as workspaceService from "../services/workspace.service.js";

export async function getSettings(req, res) {
  const data = await workspaceService.getSettings(req.supabase, req.params.workspaceId);
  res.json({ data });
}

export async function updateSettings(req, res) {
  const data = await workspaceService.updateSettings(req.supabase, req.params.workspaceId, req.body);
  res.json({ data });
}
