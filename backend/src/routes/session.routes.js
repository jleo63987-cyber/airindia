import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/session.controller.js";
import {
  controlCommandSchema,
  deviceIdParams,
  endSessionSchema,
  messageSchema,
  requestSessionSchema,
  respondSessionSchema,
  sessionIdParams,
  signalSchema,
  workspaceIdParams,
} from "../validators/schemas.js";

const router = Router();
router.use(authenticate);

router.get("/workspaces/:workspaceId/sessions", validate(workspaceIdParams, "params"), asyncHandler(controller.list));
router.post(
  "/devices/:deviceId/sessions",
  validate(deviceIdParams, "params"),
  validate(requestSessionSchema),
  asyncHandler(controller.request),
);

router.get("/sessions/:sessionId", validate(sessionIdParams, "params"), asyncHandler(controller.one));
router.post("/sessions/:sessionId/respond", validate(sessionIdParams, "params"), validate(respondSessionSchema), asyncHandler(controller.respond));
router.post("/sessions/:sessionId/start", validate(sessionIdParams, "params"), asyncHandler(controller.start));
router.post("/sessions/:sessionId/end", validate(sessionIdParams, "params"), validate(endSessionSchema), asyncHandler(controller.end));
router.post("/sessions/:sessionId/control", validate(sessionIdParams, "params"), validate(controlCommandSchema), asyncHandler(controller.control));
router.get("/sessions/:sessionId/events", validate(sessionIdParams, "params"), asyncHandler(controller.events));
router.get("/sessions/:sessionId/messages", validate(sessionIdParams, "params"), asyncHandler(controller.messages));
router.post("/sessions/:sessionId/messages", validate(sessionIdParams, "params"), validate(messageSchema), asyncHandler(controller.sendMessage));
router.get("/sessions/:sessionId/signals", validate(sessionIdParams, "params"), asyncHandler(controller.signals));
router.post("/sessions/:sessionId/signals", validate(sessionIdParams, "params"), validate(signalSchema), asyncHandler(controller.publishSignal));

export default router;
