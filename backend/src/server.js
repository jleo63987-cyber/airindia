import http from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { attachSocketServer } from "./sockets/socketServer.js";

const app = createApp();
const server = http.createServer(app);
const io = attachSocketServer(server);
app.set("io", io);

server.listen(env.port, () => {
  console.log(`AirLink API listening on http://localhost:${env.port}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);
  io.close();
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
