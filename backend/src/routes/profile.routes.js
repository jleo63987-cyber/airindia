import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "../controllers/profile.controller.js";

const router = Router();
router.get("/profile", asyncHandler(controller.profile));
router.get("/workspace", asyncHandler(controller.primaryWorkspace));
export default router;
