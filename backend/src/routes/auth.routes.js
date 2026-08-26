import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import * as controller from "../controllers/auth.controller.js";
import { loginSchema, refreshSchema, signupSchema } from "../validators/schemas.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post("/signup", authLimiter, validate(signupSchema), asyncHandler(controller.signup));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post("/refresh", authLimiter, validate(refreshSchema), asyncHandler(controller.refresh));

export default router;
