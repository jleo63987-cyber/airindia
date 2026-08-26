import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/workspace.controller.js";
import { workspaceIdParams, workspaceSettingsSchema } from "../validators/schemas.js";

const router = Router();
router.use(authenticate);

router.get("/workspaces/:workspaceId/settings", validate(workspaceIdParams, "params"), asyncHandler(controller.getSettings));
router.patch(
  "/workspaces/:workspaceId/settings",
  validate(workspaceIdParams, "params"),
  validate(workspaceSettingsSchema),
  asyncHandler(controller.updateSettings),
);

export default router;
