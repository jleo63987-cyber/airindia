import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import profileRoutes from "./profile.routes.js";
import deviceRoutes from "./device.routes.js";
import sessionRoutes from "./session.routes.js";
import workspaceRoutes from "./workspace.routes.js";
import fileRoutes from "./file.routes.js";
import authRoutes from "./auth.routes.js";
import mobileSecurityRoutes from "./mobileSecurity.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    data: {
      ok: true,
      service: "airlink-api",
      time: new Date().toISOString(),
    },
  });
});

router.use("/auth", authRoutes);
router.use("/mobile", mobileSecurityRoutes);
router.use("/me", authenticate, profileRoutes);
router.use(deviceRoutes);
router.use(sessionRoutes);
router.use(workspaceRoutes);
router.use(fileRoutes);

export default router;
