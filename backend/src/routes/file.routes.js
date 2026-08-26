import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/file.controller.js";
import { fileIdParams, workspaceIdParams } from "../validators/schemas.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
});

const router = Router();
router.use(authenticate);

router.get("/workspaces/:workspaceId/files", validate(workspaceIdParams, "params"), asyncHandler(controller.list));
router.post(
  "/files",
  upload.single("file"),
  validate(z.object({
    workspaceId: z.string().uuid(),
    deviceId: z.string().uuid().optional().or(z.literal("")),
    sessionId: z.string().uuid().optional().or(z.literal("")),
  }), "body"),
  asyncHandler(controller.upload),
);
router.get("/files/:fileId/download", validate(fileIdParams, "params"), asyncHandler(controller.download));
router.delete("/files/:fileId", validate(fileIdParams, "params"), asyncHandler(controller.remove));

export default router;
