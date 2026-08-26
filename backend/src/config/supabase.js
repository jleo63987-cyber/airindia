import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

export function createPublicSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, serverAuthOptions);
}

export function createUserSupabaseClient(accessToken) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    ...serverAuthOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function createAdminSupabaseClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, serverAuthOptions);
}
