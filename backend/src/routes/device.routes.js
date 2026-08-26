import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/device.controller.js";
import {
  deviceIdParams,
  directDeviceRegistrationSchema,
  presenceSchema,
  workspaceIdParams,
} from "../validators/schemas.js";

const router = Router();

router.use(authenticate);

// Current flow: mobile account logs in, then phone registers automatically.
router.post(
  "/device/register",
  validate(directDeviceRegistrationSchema),
  asyncHandler(controller.register),
);

router.get("/workspaces/:workspaceId/devices", validate(workspaceIdParams, "params"), asyncHandler(controller.list));

router.get(
  "/devices/:deviceId",
  validate(deviceIdParams, "params"),
  validate(z.object({ workspaceId: z.string().uuid() }), "query"),
  asyncHandler(controller.one),
);
router.get(
  "/devices/:deviceId/open-session",
  validate(deviceIdParams, "params"),
  validate(z.object({ workspaceId: z.string().uuid() }), "query"),
  asyncHandler(controller.openSession),
);


router.delete(
  "/devices/:deviceId",
  validate(deviceIdParams, "params"),
  validate(z.object({ workspaceId: z.string().uuid() }), "query"),
  asyncHandler(controller.remove),
);

router.get(
  "/device/sync",
  validate(z.object({
    deviceId: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }), "query"),
  asyncHandler(controller.sync),
);

router.post("/device/presence", validate(presenceSchema), asyncHandler(controller.presence));
router.get(
  "/device/sessions/pending",
  validate(z.object({ deviceId: z.string().uuid() }), "query"),
  asyncHandler(controller.pendingSessions),
);
router.get(
  "/device/sessions",
  validate(z.object({ deviceId: z.string().uuid(), limit: z.coerce.number().int().min(1).max(100).optional() }), "query"),
  asyncHandler(controller.sessions),
);

export default router;
