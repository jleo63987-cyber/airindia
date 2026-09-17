import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticateDevice, skipUnlessDeviceToken } from "../middleware/authenticateDevice.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/flutterRemote.controller.js";
import {
  deviceIdParams,
  flutterDeviceRegistrationSchema,
  flutterSessionConsentSchema,
  flutterSignalSchema,
  sessionIdParams,
  signalCursorSchema,
} from "../validators/schemas.js";

export const flutterRegistrationRoutes = Router();
const registrationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

flutterRegistrationRoutes.post(
  "/devices/register",
  registrationLimiter,
  validate(flutterDeviceRegistrationSchema),
  asyncHandler(controller.register),
);

const router = Router();
router.use(skipUnlessDeviceToken);
router.use(authenticateDevice);

router.get(
  "/devices/:deviceId/sessions/pending",
  validate(deviceIdParams, "params"),
  asyncHandler(controller.pending),
);
router.post(
  "/sessions/:sessionId/accept",
  validate(sessionIdParams, "params"),
  validate(flutterSessionConsentSchema),
  asyncHandler(controller.accept),
);
router.post(
  "/sessions/:sessionId/reject",
  validate(sessionIdParams, "params"),
  asyncHandler(controller.reject),
);
router.get(
  "/sessions/:sessionId/signals",
  validate(sessionIdParams, "params"),
  validate(signalCursorSchema, "query"),
  asyncHandler(controller.signals),
);
router.post(
  "/sessions/:sessionId/signals",
  validate(sessionIdParams, "params"),
  validate(flutterSignalSchema),
  asyncHandler(controller.publishSignal),
);
router.post(
  "/sessions/:sessionId/end",
  validate(sessionIdParams, "params"),
  asyncHandler(controller.end),
);

export default router;
