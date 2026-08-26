import crypto from "node:crypto";
import { assertSupabase } from "../utils/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { sanitizeFileName } from "../utils/files.js";

export async function listTransfers(supabase, workspaceId, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const { data, error } = await supabase
    .from("file_transfers")
    .select("id, workspace_id, device_id, session_id, storage_path, original_name, mime_type, size_bytes, direction, status, created_at, completed_at, device:devices(name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  assertSupabase(error);
  return data || [];
}

export async function uploadTransfer(supabase, { workspaceId, deviceId, sessionId, file }) {
  if (!file) throw new HttpError(422, "File is required.");

  const safeName = sanitizeFileName(file.originalname);
  const targetFolder = deviceId || "shared";
  const storagePath = `${workspaceId}/${targetFolder}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("session-files")
    .upload(storagePath, file.buffer, {
      upsert: false,
      contentType: file.mimetype || "application/octet-stream",
    });
  assertSupabase(uploadError, "File upload failed.");

  try {
    const { data, error } = await supabase.rpc("create_file_transfer", {
      p_workspace_id: workspaceId,
      p_device_id: deviceId || null,
      p_session_id: sessionId || null,
      p_storage_path: storagePath,
      p_original_name: file.originalname,
      p_mime_type: file.mimetype || "application/octet-stream",
      p_size_bytes: file.size,
      p_direction: "web_to_device",
    });
    assertSupabase(error);
    return data;
  } catch (error) {
    await supabase.storage.from("session-files").remove([storagePath]);
    throw error;
  }
}

async function getTransfer(supabase, fileId) {
  const { data, error } = await supabase
    .from("file_transfers")
    .select("id, storage_path, original_name")
    .eq("id", fileId)
    .maybeSingle();
  assertSupabase(error);
  if (!data) throw new HttpError(404, "File transfer not found.");
  return data;
}

export async function getDownloadUrl(supabase, fileId) {
  const transfer = await getTransfer(supabase, fileId);
  const { data, error } = await supabase.storage
    .from("session-files")
    .createSignedUrl(transfer.storage_path, 60, { download: true });
  assertSupabase(error);
  return { ...transfer, signedUrl: data.signedUrl };
}

export async function deleteTransfer(supabase, fileId) {
  const transfer = await getTransfer(supabase, fileId);

  const { error: storageError } = await supabase.storage
    .from("session-files")
    .remove([transfer.storage_path]);
  assertSupabase(storageError);

  const { error } = await supabase
    .from("file_transfers")
    .delete()
    .eq("id", fileId);
  assertSupabase(error);
  return true;
}
