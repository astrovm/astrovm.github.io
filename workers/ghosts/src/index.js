// Ghost cats: relays where each visitor's cat is to everyone else on the same page,
// and passes nudges (boops, tag, the yarn) from one cat to another.
import { DurableObject } from "cloudflare:workers";
import { allowedOrigin, parseMessage, roomName } from "./move.js";

const MAX_VISITORS = 30;
const MIN_GAP_MS = 80;
const MIN_NUDGE_GAP_MS = 2000;
// Bump when the messages change, so old pages don't mix with new ones.
const VERSION = "3";

export class Room extends DurableObject {
  async fetch() {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_VISITORS) {
      return new Response("room is full", { status: 503 });
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: crypto.randomUUID().slice(0, 8), last: 0, nudged: 0, cat: null });
    // Newcomers see the cats already here, even the ones sitting still.
    for (const socket of sockets) {
      const { id, cat } = socket.deserializeAttachment();
      if (cat) server.send(JSON.stringify({ id, ...cat }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, text) {
    const visitor = socket.deserializeAttachment();
    const message = parseMessage(text);
    const now = Date.now();
    if (!message) {
      return;
    }
    if (message.to) {
      if (now - visitor.nudged < MIN_NUDGE_GAP_MS) return;
      socket.serializeAttachment({ ...visitor, nudged: now });
      const target = this.ctx.getWebSockets().find((other) => other !== socket && other.deserializeAttachment().id === message.to);
      if (target) send(target, JSON.stringify({ from: visitor.id, a: message.a }));
      return;
    }
    if (now - visitor.last < MIN_GAP_MS) {
      return;
    }
    socket.serializeAttachment({ ...visitor, last: now, cat: message });
    this.broadcast(socket, JSON.stringify({ id: visitor.id, ...message }));
  }

  webSocketClose(socket) {
    const { id } = socket.deserializeAttachment();
    this.broadcast(socket, JSON.stringify({ id, gone: true }));
  }

  broadcast(from, text) {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== from) send(socket, text);
    }
  }
}

function send(socket, text) {
  try {
    socket.send(text);
  } catch {
    // That visitor already left.
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
    const params = new URL(request.url).searchParams;
    if (params.get("v") !== VERSION) {
      return new Response("refresh the page for the new ghost cats", { status: 426 });
    }
    const room = roomName(params.get("room"));
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
  },
};
