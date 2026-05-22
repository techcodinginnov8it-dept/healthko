import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const httpServer = createServer();

const io = new Server(httpServer, {
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
});

httpServer.on("request", (req, res) => {
  if (req.url?.startsWith("/api/socket")) {
    return;
  }

  handle(req, res);
});

httpServer.listen(port, hostname, () => {
  console.log(`> Healthko ready on http://${hostname}:${port}`);
});
