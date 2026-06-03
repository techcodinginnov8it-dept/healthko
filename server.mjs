import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);
const httpsPort = Number.parseInt(process.env.HTTPS_PORT || "", 10);
const httpsPfxPath = process.env.HTTPS_PFX_PATH;
const httpsPfxPassphrase = process.env.HTTPS_PFX_PASSPHRASE || "";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

function getLanAddresses() {
  return Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((address) => address.family === "IPv4" && !address.internal)
    .map((address) => address.address);
}

function logReady(protocol, listenPort) {
  console.log(`> Healthko ready on ${protocol}://${hostname}:${listenPort}`);

  if (hostname === "0.0.0.0" || hostname === "::") {
    for (const address of getLanAddresses()) {
      console.log(`> LAN access: ${protocol}://${address}:${listenPort}`);
    }
  }
}

function attachSocketServer(server) {
  const io = new Server(server, {
  path: "/api/socket",
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

  io.on("connection", (socket) => {
    socket.on("dashboard:event", (event) => {
      socket.broadcast.emit("dashboard:event", event);
    });

    socket.on("webrtc:join-room", ({ roomId }) => {
      if (typeof roomId === "string" && roomId) {
        socket.join(roomId);
        socket.to(roomId).emit("webrtc:peer-ready-request");
      }
    });

    socket.on("webrtc:peer-ready", ({ roomId, role }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:peer-ready", { role });
      }
    });

    socket.on("webrtc:peer-ready-request", ({ roomId }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:peer-ready-request");
      }
    });

    socket.on("webrtc:offer", ({ roomId, offer }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:offer", { offer });
      }
    });

    socket.on("webrtc:answer", ({ roomId, answer }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:answer", { answer });
      }
    });

    socket.on("webrtc:ice-candidate", ({ roomId, candidate }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:ice-candidate", { candidate });
      }
    });

    socket.on("webrtc:session-ended", ({ roomId }) => {
      if (typeof roomId === "string" && roomId) {
        socket.to(roomId).emit("webrtc:session-ended");
      }
    });
  });
}

function attachNextHandler(server) {
  server.on("request", (req, res) => {
  if (req.url?.startsWith("/api/socket")) {
    return;
  }

  handle(req, res);
  });
}

const httpServer = createServer();
attachSocketServer(httpServer);
attachNextHandler(httpServer);

httpServer.listen(port, hostname, () => logReady("http", port));

if (httpsPfxPath && Number.isFinite(httpsPort)) {
  const httpsServer = createHttpsServer({
    pfx: readFileSync(httpsPfxPath),
    passphrase: httpsPfxPassphrase,
  });
  attachSocketServer(httpsServer);
  attachNextHandler(httpsServer);
  httpsServer.listen(httpsPort, hostname, () => logReady("https", httpsPort));
}
