import { assertSupabase } from "../utils/supabase.js";

export async function getSettings(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("workspace_id, explicit_consent, idle_lock_minutes, allow_clipboard, allow_recording, connection_notifications")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

export async function updateSettings(supabase, workspaceId, patch) {
  const safePatch = { ...patch };
  delete safePatch.explicit_consent;

  const { data, error } = await supabase
    .from("workspace_settings")
    .update(safePatch)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  assertSupabase(error);
  return data;
}
