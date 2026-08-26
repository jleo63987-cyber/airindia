import { Server } from "socket.io";
import { createPublicSupabaseClient, createUserSupabaseClient } from "../config/supabase.js";
import { env } from "../config/env.js";
import * as sessionService from "../services/session.service.js";
import * as deviceService from "../services/device.service.js";

function socketToken(socket) {
  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const header = socket.handshake.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : null;
}

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.frontendOrigin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socketToken(socket);
      if (!token) return next(new Error("unauthorized"));

      const verifier = createPublicSupabaseClient();
      const { data, error } = await verifier.auth.getUser(token);
      if (error || !data?.user) return next(new Error("unauthorized"));

      socket.user = data.user;
      socket.supabase = createUserSupabaseClient(token);
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("device:join", async ({ deviceId }, ack = () => {}) => {
      try {
        const device = await deviceService.getDeviceForIdentity(socket.supabase, deviceId, socket.user.id);
        if (!device) throw new Error("Device not found, removed, or not authorized");
        socket.join(`device:${deviceId}`);
        ack({ ok: true, device });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });

    socket.on("device:leave", ({ deviceId }) => {
      socket.leave(`device:${deviceId}`);
    });

    socket.on("session:join", async ({ sessionId }, ack = () => {}) => {
      try {
        const session = await sessionService.getSession(socket.supabase, sessionId);
        if (!session) throw new Error("Session not found");
        socket.join(`session:${sessionId}`);
        ack({ ok: true, session });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });

    socket.on("session:leave", ({ sessionId }) => {
      socket.leave(`session:${sessionId}`);
    });

    socket.on("webrtc:signal", async ({ sessionId, signalType, payload }, ack = () => {}) => {
      try {
        const signalId = await sessionService.publishSignal(
          socket.supabase,
          sessionId,
          signalType,
          payload,
        );
        socket.to(`session:${sessionId}`).emit("webrtc:signal", {
          sessionId,
          signalId,
          signalType,
          payload,
          senderUserId: socket.user.id,
        });
        ack({ ok: true, signalId });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });

    socket.on("session:message", async ({ sessionId, body }, ack = () => {}) => {
      try {
        const messageId = await sessionService.sendMessage(socket.supabase, sessionId, body);
        io.to(`session:${sessionId}`).emit("session:message", { sessionId, messageId });
        ack({ ok: true, messageId });
      } catch (error) {
        ack({ ok: false, error: error.message });
      }
    });
  });

  return io;
}
