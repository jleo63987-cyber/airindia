import { apiRequest } from "./api";

export async function getProfile() {
  return apiRequest("/me/profile");
}

export async function getPrimaryWorkspace() {
  return apiRequest("/me/workspace");
}

export async function listDevices(workspaceId) {
  if (!workspaceId) return [];
  return apiRequest(`/workspaces/${workspaceId}/devices`);
}

export async function getDevice(workspaceId, deviceId) {
  return apiRequest(`/devices/${deviceId}?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function getOpenSessionForDevice(workspaceId, deviceId) {
  return apiRequest(`/devices/${deviceId}/open-session?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function removeDevice(workspaceId, deviceId) {
  return apiRequest(`/devices/${deviceId}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });
}


export async function listSessions(workspaceId, limit = 100) {
  if (!workspaceId) return [];
  return apiRequest(`/workspaces/${workspaceId}/sessions?limit=${limit}`);
}

export async function getSession(sessionId) {
  return apiRequest(`/sessions/${sessionId}`);
}

export async function requestRemoteSession(deviceId, permissions = {}) {
  return apiRequest(`/devices/${deviceId}/sessions`, {
    method: "POST",
    body: { permissions },
  });
}

export async function startRemoteSession(sessionId) {
  return apiRequest(`/sessions/${sessionId}/start`, {
    method: "POST",
    body: {},
  });
}

export async function endRemoteSession(sessionId, reason = "ended_by_operator") {
  return apiRequest(`/sessions/${sessionId}/end`, {
    method: "POST",
    body: { reason },
  });
}


export async function sendRemoteInput(sessionId, command) {
  return apiRequest(`/sessions/${sessionId}/control`, {
    method: "POST",
    body: { command },
  });
}

export async function listSessionEvents(sessionId) {
  return apiRequest(`/sessions/${sessionId}/events`);
}

export async function listSessionMessages(sessionId) {
  return apiRequest(`/sessions/${sessionId}/messages`);
}

export async function sendSessionMessage(sessionId, body) {
  return apiRequest(`/sessions/${sessionId}/messages`, {
    method: "POST",
    body: { body },
  });
}

export async function listFileTransfers(workspaceId, limit = 100) {
  if (!workspaceId) return [];
  return apiRequest(`/workspaces/${workspaceId}/files?limit=${limit}`);
}

export async function uploadWorkspaceFile({
  workspaceId,
  deviceId = null,
  sessionId = null,
  file,
}) {
  const formData = new FormData();
  formData.append("workspaceId", workspaceId);
  if (deviceId) formData.append("deviceId", deviceId);
  if (sessionId) formData.append("sessionId", sessionId);
  formData.append("file", file);

  return apiRequest("/files", {
    method: "POST",
    body: formData,
  });
}

export async function downloadWorkspaceFile(transfer) {
  const data = await apiRequest(`/files/${transfer.id}/download`);
  const anchor = document.createElement("a");
  anchor.href = data.signedUrl;
  anchor.download = transfer.original_name || data.original_name || "download";
  anchor.rel = "noopener";
  anchor.click();
}

export async function deleteWorkspaceFile(transfer) {
  return apiRequest(`/files/${transfer.id}`, {
    method: "DELETE",
  });
}

export async function getWorkspaceSettings(workspaceId) {
  return apiRequest(`/workspaces/${workspaceId}/settings`);
}

export async function updateWorkspaceSettings(workspaceId, patch) {
  return apiRequest(`/workspaces/${workspaceId}/settings`, {
    method: "PATCH",
    body: patch,
  });
}

export async function listWebrtcSignals(sessionId) {
  return apiRequest(`/sessions/${sessionId}/signals`);
}

export async function publishWebrtcSignal(sessionId, signalType, payload) {
  return apiRequest(`/sessions/${sessionId}/signals`, {
    method: "POST",
    body: { signalType, payload },
  });
}
