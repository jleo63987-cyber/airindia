import * as authService from "../services/auth.service.js";

export async function signup(req, res) {
  const data = await authService.signUp(req.body);
  res.status(201).json({ data });
}

export async function login(req, res) {
  const data = await authService.signIn(req.body);
  res.json({ data });
}

export async function refresh(req, res) {
  const data = await authService.refresh(req.body.refreshToken);
  res.json({ data });
}
