import { assertSupabase } from "../utils/supabase.js";

export async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, created_at")
    .eq("id", userId)
    .maybeSingle();
  assertSupabase(error);
  return data;
}

export async function getPrimaryWorkspace(supabase) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, created_at, workspaces(id, name, slug, owner_id)")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  assertSupabase(error);
  return data ? { ...data.workspaces, membershipRole: data.role } : null;
}
