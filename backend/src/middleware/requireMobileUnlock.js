import { verifyUnlockToken } from "../utils/mobileUnlock.js";

export function requireMobileUnlock(req, _res, next) {
  try {
    verifyUnlockToken(req.headers["x-airlink-unlock"], req.user.id);
    next();
  } catch (error) {
    next(error);
  }
}
