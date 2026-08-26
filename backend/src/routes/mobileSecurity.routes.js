import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireMobileUnlock } from "../middleware/requireMobileUnlock.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/mobileSecurity.controller.js";
import { mobilePinSchema, mobileUnlockSchema } from "../validators/schemas.js";

const router = Router();
const unlockLimiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

router.use(authenticate);
router.get("/security/status", asyncHandler(controller.status));
router.post("/security/setup", validate(mobilePinSchema), asyncHandler(controller.setup));
router.post("/security/unlock", unlockLimiter, validate(mobileUnlockSchema), asyncHandler(controller.unlock));
router.post("/security/backup-codes", requireMobileUnlock, asyncHandler(controller.regenerate));
router.patch("/security/pin", requireMobileUnlock, validate(mobilePinSchema), asyncHandler(controller.changePin));

export default router;
