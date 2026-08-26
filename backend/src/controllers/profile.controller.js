import * as profileService from "../services/profile.service.js";

export async function profile(req, res) {
  const data = await profileService.getProfile(req.supabase, req.user.id);
  res.json({ data });
}

export async function primaryWorkspace(req, res) {
  const data = await profileService.getPrimaryWorkspace(req.supabase);
  res.json({ data });
}
