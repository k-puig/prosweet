import { Server as Engine } from "@socket.io/bun-engine";
import { Server } from "socket.io";
import { Hono } from "hono";
import setupChatSocketEvents from "./sockets/chat";

const io = new Server();

const engine = new Engine();

io.bind(engine);
setupChatSocketEvents(io);

const app = new Hono();

const { websocket } = engine.handler();

export default {
  port: 3000,
  idleTimeout: 30, // must be greater than the "pingInterval" option of the engine, which defaults to 25 seconds

  fetch(req: any, server: any) {
    const url = new URL(req.url);

    if (url.pathname === "/socket.io/") {
      return engine.handleRequest(req, server);
    } else {
      return app.fetch(req, server);
    }
  },

  websocket
}