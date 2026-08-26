import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin: env.frontendOrigin,
    credentials: true,
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.use("/api", rateLimit({
    windowMs: 60_000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }));

  app.use("/api", apiRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
