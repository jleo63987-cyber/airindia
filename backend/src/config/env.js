import "dotenv/config";

const required = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DEVICE_REGISTRATION_WORKSPACE_ID",
  "MOBILE_UNLOCK_SECRET",
  "DEVICE_TOKEN_SECRET",
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  frontendOrigin: configuredFrontendOrigins.length === 1
    ? configuredFrontendOrigins[0]
    : configuredFrontendOrigins,
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  deviceRegistrationWorkspaceId: process.env.DEVICE_REGISTRATION_WORKSPACE_ID,
  mobileUnlockSecret: process.env.MOBILE_UNLOCK_SECRET,
  deviceTokenSecret: process.env.DEVICE_TOKEN_SECRET,
};
