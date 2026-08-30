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

  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...String(env.frontendOrigin || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ];

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests without browser Origin header
        // e.g. Android app, Postman, curl.
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.warn("Blocked CORS origin:", origin);

        return callback(
          new Error(`CORS origin not allowed: ${origin}`),
        );
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
      ],
    }),
  );

  app.options(/.*/, cors());

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

  app.use(
    morgan(
      env.nodeEnv === "production"
        ? "combined"
        : "dev",
    ),
  );

  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "airlink-api",
      message: "AirLink backend is running",
    });
  });

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );

  app.use("/api", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
