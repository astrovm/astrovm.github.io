// Ghost cats: relays where each visitor's cursor is to everyone else on the same page.
import { DurableObject } from "cloudflare:workers";
import { allowedOrigin, parseMove, roomName } from "./move.js";

const MAX_VISITORS = 30;
const MIN_GAP_MS = 80;

export class Room extends DurableObject {
  async fetch() {
    if (this.ctx.getWebSockets().length >= MAX_VISITORS) {
      return new Response("room is full", { status: 503 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), last: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const visitor = socket.deserializeAttachment();
    const now = Date.now();
    const move = parseMove(message);
    if (!move || now - visitor.last < MIN_GAP_MS) {
      return;
    }
    socket.serializeAttachment({ ...visitor, last: now });
    this.broadcast(socket, JSON.stringify({ id: visitor.id, ...move }));
  }

  webSocketClose(socket) {
    const { id } = socket.deserializeAttachment();
    this.broadcast(socket, JSON.stringify({ id, gone: true }));
  }

  broadcast(from, text) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== from) {
        try {
          socket.send(text);
        } catch {
          // That visitor already left.
        }
      }
    }
  }
}

export default {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("ghost cats live here (=^･ω･^=)", { status: 426 });
    }
    if (!allowedOrigin(request.headers.get("Origin"))) {
      return new Response("not from here", { status: 403 });
    }
    const room = roomName(new URL(request.url).searchParams.get("room"));
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
  },
};
