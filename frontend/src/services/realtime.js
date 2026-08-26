import { io } from "socket.io-client";
import { currentAccessToken, SOCKET_BASE_URL } from "./api";

let socketPromise;
const roomRefs = new Map();

export async function getSocket() {
  if (!socketPromise) {
    socketPromise = (async () => {
      const token = await currentAccessToken();
      const socket = io(SOCKET_BASE_URL, {
        transports: ["websocket", "polling"],
        auth: { token },
      });

      socket.on("connect_error", async (error) => {
        if (error?.message !== "unauthorized") return;
        try {
          socket.auth = { token: await currentAccessToken() };
          socket.connect();
        } catch {
          // Auth state will redirect when the browser session is no longer valid.
        }
      });

      socket.on("connect", () => {
        for (const [sessionId, count] of roomRefs.entries()) {
          if (count > 0) socket.emit("session:join", { sessionId });
        }
      });

      return socket;
    })();
  }
  return socketPromise;
}

async function retainSessionRoom(sessionId, onError) {
  const socket = await getSocket();
  const next = (roomRefs.get(sessionId) || 0) + 1;
  roomRefs.set(sessionId, next);

  if (next === 1) {
    socket.emit("session:join", { sessionId }, (result) => {
      if (!result?.ok) onError?.(new Error(result?.error || "Unable to join session."));
    });
  }

  return () => {
    const current = Math.max(0, (roomRefs.get(sessionId) || 1) - 1);
    if (current === 0) {
      roomRefs.delete(sessionId);
      socket.emit("session:leave", { sessionId });
    } else {
      roomRefs.set(sessionId, current);
    }
  };
}

export async function emitSessionSignal(sessionId, signalType, payload) {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit("webrtc:signal", { sessionId, signalType, payload }, (result) => {
      if (result?.ok) resolve(result);
      else reject(new Error(result?.error || "Unable to publish WebRTC signal."));
    });
  });
}

export async function subscribeToSession(sessionId, handlers = {}) {
  const socket = await getSocket();
  const releaseRoom = await retainSessionRoom(sessionId, handlers.onError);

  const onChanged = (payload) => {
    if (payload?.sessionId === sessionId) handlers.onChanged?.(payload);
  };
  const onRequested = (payload) => {
    if (payload?.sessionId === sessionId) handlers.onChanged?.(payload);
  };
  const onMessage = (payload) => {
    if (payload?.sessionId === sessionId) handlers.onMessage?.(payload);
  };
  const onSignal = (payload) => {
    if (payload?.sessionId === sessionId) handlers.onSignal?.(payload);
  };

  socket.on("session:changed", onChanged);
  socket.on("session:requested", onRequested);
  socket.on("session:message", onMessage);
  socket.on("webrtc:signal", onSignal);

  return () => {
    releaseRoom();
    socket.off("session:changed", onChanged);
    socket.off("session:requested", onRequested);
    socket.off("session:message", onMessage);
    socket.off("webrtc:signal", onSignal);
  };
}
