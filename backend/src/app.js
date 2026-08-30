import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";

import { env } from "./config/env.js";
import apiRoutes from "./routes/index.js";
import {
  errorHandler,
  notFound,
} from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(helmet());

  // --------------------------------------------------
  // CORS CONFIGURATION
  // --------------------------------------------------

  const configuredOrigins = String(
    env.frontendOrigin || "",
  )
    .split(",")
    .map((origin) =>
      origin.trim().replace(/\/$/, ""),
    )
    .filter(Boolean);

  const isAllowedOrigin = (origin) => {
    // Android app / Postman / curl etc.
    if (!origin) {
      return true;
    }

    const normalizedOrigin = origin.replace(
      /\/$/,
      "",
    );

    // Local frontend
    if (
      normalizedOrigin ===
        "http://localhost:5173" ||
      normalizedOrigin ===
        "http://127.0.0.1:5173"
    ) {
      return true;
    }

    // Explicitly configured frontend domains
    if (
      configuredOrigins.includes(
        normalizedOrigin,
      )
    ) {
      return true;
    }

    // AirIndia / AirLink Vercel production
    // and preview deployments
    if (
      /^https:\/\/airindia(?:-[a-zA-Z0-9-]+)?\.vercel\.app$/.test(
        normalizedOrigin,
      )
    ) {
      return true;
    }

    return false;
  };

  const corsOptions = {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.warn(
        "Blocked CORS origin:",
        origin,
      );

      return callback(null, false);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],

    exposedHeaders: [
      "RateLimit",
      "RateLimit-Policy",
      "RateLimit-Limit",
      "RateLimit-Remaining",
      "RateLimit-Reset",
    ],

    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));

  // Explicit preflight handler
  app.options(/.*/, cors(corsOptions));

  // --------------------------------------------------
  // BODY PARSERS
  // --------------------------------------------------

  app.use(
    express.json({
      limit: "1mb",
    }),
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
    }),
  );

  // --------------------------------------------------
  // LOGGING
  // --------------------------------------------------

  app.use(
    morgan(
      env.nodeEnv === "production"
        ? "combined"
        : "dev",
    ),
  );

  // --------------------------------------------------
  // ROOT HEALTH CHECK
  // --------------------------------------------------

  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "airlink-api",
      message:
        "AirLink backend is running",
    });
  });

  // --------------------------------------------------
  // API RATE LIMIT
  // --------------------------------------------------

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 240,

      standardHeaders: "draft-8",
      legacyHeaders: false,

      // OPTIONS/preflight ko rate limit na karo
      skip: (req) =>
        req.method === "OPTIONS",
    }),
  );

  // --------------------------------------------------
  // API ROUTES
  // --------------------------------------------------

  app.use("/api", apiRoutes);

  // --------------------------------------------------
  // 404 + ERROR HANDLER
  // --------------------------------------------------

  app.use(notFound);

  app.use(errorHandler);

  return app;
}

// --------------------------------------------------
// VERCEL ENTRY
// --------------------------------------------------

const app = createApp();

export default app;
