import { z } from "zod";

export const workspaceIdParams = z.object({ workspaceId: z.string().uuid() });
export const deviceIdParams = z.object({ deviceId: z.string().uuid() });
export const sessionIdParams = z.object({ sessionId: z.string().uuid() });
export const fileIdParams = z.object({ fileId: z.string().uuid() });

export const directDeviceRegistrationSchema = z.object({
  deviceName: z.string().trim().min(1).max(120),
  ownerLabel: z.string().trim().max(120).nullable().optional(),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  androidVersion: z.string().trim().max(80).nullable().optional(),
  batteryPercent: z.coerce.number().int().min(0).max(100).default(0),
  storagePercent: z.coerce.number().int().min(0).max(100).default(0),
  networkType: z.string().trim().max(80).nullable().optional(),
  signalPercent: z.coerce.number().int().min(0).max(100).default(0),
});

export const presenceSchema = z.object({
  deviceId: z.string().uuid(),
  status: z.enum(["online", "idle", "offline"]).default("online"),
  batteryPercent: z.coerce.number().int().min(0).max(100).default(0),
  storagePercent: z.coerce.number().int().min(0).max(100).default(0),
  networkType: z.string().trim().max(80).nullable().optional(),
  signalPercent: z.coerce.number().int().min(0).max(100).default(0),
  locationLabel: z.string().trim().max(160).nullable().optional(),
});


// Flutter device-token API contracts. These routes intentionally use a
// separate payload shape from the authenticated web dashboard routes.
export const flutterDeviceRegistrationSchema = z.object({
  installationId: z.string().uuid(),
  username: z.string().trim().regex(/^[A-Za-z0-9]{6}$/, "Username must be exactly 6 letters/numbers"),
  mobile: z.string().trim().min(6).max(24),
  securityCode: z.string().regex(/^\d{6}$/, "Security code must be exactly 6 digits"),
  platform: z.literal("android"),
  manufacturer: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(120).nullable().optional(),
  androidSdk: z.coerce.number().int().min(21).max(100),
  appVersion: z.string().trim().min(1).max(40),
}).strict();

export const flutterSessionConsentSchema = z.object({
  capabilities: z.array(z.enum(["screen", "tap", "swipe", "text", "navigation"]))
    .max(10)
    .default([]),
}).strict();

export const signalCursorSchema = z.object({
  after: z.string().datetime({ offset: true }).optional(),
});

export const flutterSignalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("offer"),
    sdp: z.string().min(1).max(2_000_000),
  }).strict(),
  z.object({
    type: z.literal("answer"),
    sdp: z.string().min(1).max(2_000_000),
  }).strict(),
  z.object({
    type: z.literal("candidate"),
    candidate: z.string().min(1).max(16_384),
    sdpMid: z.string().max(256).nullable().optional(),
    sdpMLineIndex: z.coerce.number().int().min(0).max(65_535).nullable().optional(),
  }).strict(),
]);

export const requestSessionSchema = z.object({
  permissions: z.record(z.string(), z.boolean()).optional(),
});

export const respondSessionSchema = z.object({
  approved: z.boolean(),
  approvedPermissions: z.record(z.string(), z.boolean()).optional(),
});

export const endSessionSchema = z.object({
  reason: z.string().trim().max(250).optional(),
});

const point01 = z.coerce.number().min(0).max(1);
const gestureDuration = z.coerce.number().int().min(60).max(2000).optional();

export const controlCommandSchema = z.object({
  command: z.discriminatedUnion("type", [
    z.object({ type: z.literal("tap"), x: point01, y: point01 }),
    z.object({ type: z.literal("long_press"), x: point01, y: point01, durationMs: gestureDuration }),
    z.object({ type: z.literal("swipe"), startX: point01, startY: point01, endX: point01, endY: point01, durationMs: gestureDuration }),
    z.object({ type: z.literal("back") }),
    z.object({ type: z.literal("home") }),
    z.object({ type: z.literal("recents") }),
  ]),
});

export const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

// Existing live-screen patch emits "ice-candidate". Keep "ice" for older callers.
export const signalSchema = z.object({
  signalType: z.enum(["offer", "answer", "ice", "ice-candidate"]),
  payload: z.unknown(),
});

export const workspaceSettingsSchema = z.object({
  idle_lock_minutes: z.coerce.number().int().min(1).max(60).optional(),
  allow_clipboard: z.boolean().optional(),
  allow_recording: z.boolean().optional(),
  connection_notifications: z.boolean().optional(),
}).strict();

export const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(120).optional(),
  clientType: z.enum(["web_operator", "mobile_device"]).optional(),
});
export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});
export const refreshSchema = z.object({ refreshToken: z.string().min(20).max(4096) });
export const mobilePinSchema = z.object({ pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits") });
export const mobileUnlockSchema = z.object({
  pin: z.string().regex(/^\d{6}$/).optional(),
  backupCode: z.string().trim().regex(/^[A-F0-9]{5}-[A-F0-9]{5}$/i).optional(),
}).refine((value) => Boolean(value.pin) !== Boolean(value.backupCode), {
  message: "Provide either PIN or backupCode",
});
