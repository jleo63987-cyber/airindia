import { createPublicSupabaseClient } from "../config/supabase.js";
import { HttpError } from "../utils/httpError.js";

export async function signUp({ email, password, fullName, clientType }) {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || null,
        client_type: clientType || "web_operator",
      },
    },
  });
  if (error) throw new HttpError(400, error.message);
  return data;
}

export async function signIn({ email, password }) {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new HttpError(401, error.message);
  return data;
}

export async function refresh(refreshToken) {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) throw new HttpError(401, error.message);
  return data;
}
