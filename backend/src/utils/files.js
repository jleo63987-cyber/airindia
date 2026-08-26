export function sanitizeFileName(name = "file") {
  const cleaned = String(name).replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 180) || "file";
}
