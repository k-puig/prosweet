import { Server } from "socket.io";

export default function setupChatSocketEvents(io: Server) {
  io.on("connection", (socket) => {
    socket.emit("ping", "pong");
    setTimeout(() => socket.emit("ping", "pong"), 1);
    setTimeout(() => socket.emit("ping", "pong"), 2);
    setTimeout(() => socket.emit("ping", "pong"), 3);
  });
}