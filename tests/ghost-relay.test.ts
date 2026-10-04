import { test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { browserSource, coverage } from './helpers/coverage';
import { allowedOrigin, nudgeTimes, parseMessage, roomName } from '../workers/ghosts/src/move.js';

// Bun has no cloudflare:workers module. Supply only the platform boundary; execute
// the instrumented worker's own routing, rate limits and relay methods unchanged.
function relay() {
  class Socket {
    attachment: any;
    sent: any[] = [];
    fail = false;
    serializeAttachment(value: any) { this.attachment = structuredClone(value); }
    deserializeAttachment() { return structuredClone(this.attachment); }
    send(value: string) { if (this.fail) throw new Error('closed'); this.sent.push(JSON.parse(value)); }
  }
  class Pair { 0 = new Socket(); 1 = new Socket(); }
  class UpgradeResponse extends Response {
    webSocket: any;
    constructor(body: any, options: any) {
      super(body, { ...options, status: options.status === 101 ? 200 : options.status });
      if (options.status === 101) Object.defineProperty(this, 'status', { value: 101 });
      this.webSocket = options.webSocket;
    }
  }
  let now = 10000;
  const sockets: Socket[] = [];
  const ctx = { getWebSockets: () => sockets, acceptWebSocket: (socket: Socket) => sockets.push(socket) };
  const context: any = { __coverage__: coverage, DurableObject: class { ctx: any; constructor(ctx: any) { this.ctx = ctx; } }, WebSocketPair: Pair, Response: UpgradeResponse, crypto, Date: { now: () => now }, URL, allowedOrigin, nudgeTimes, parseMessage, roomName };
  const source = browserSource('workers/ghosts/src/index.js').replace(/import\s*[\s\S]*?from\s+["'][^"']+["'];/g, '').replace('export class Room', 'class Room').replace('export default', 'globalThis.worker =');
  runInNewContext(source + '; globalThis.Room = Room;', context);
  const room = new context.Room(ctx);
  return { room, sockets, worker: context.worker, time: (ms: number) => now += ms };
}

test('ghost relay accepts upgrades, replays existing cats and caps room size', async () => {
  const b = relay();
  const first = await b.room.fetch();
  expect(first.status).toBe(101);
  expect(first.webSocket).toBeDefined();
  const cat = { x: 0.4, y: 0.5, s: [-3, -3], r: 0, h: 0 };
  b.room.webSocketMessage(b.sockets[0], JSON.stringify(cat));
  await b.room.fetch();
  expect(b.sockets[1].sent).toEqual([{ id: b.sockets[0].attachment.id, ...cat }]);
  for (let i = 2; i < 30; i++) await b.room.fetch();
  const full = await b.room.fetch();
  expect(full.status).toBe(503);
  expect(await full.text()).toBe('room is full');
});

test('relay validates and throttles movement and sends departures to everyone else', async () => {
  const b = relay();
  await b.room.fetch(); await b.room.fetch();
  const [a, other] = b.sockets;
  b.room.webSocketMessage(a, 'bad json');
  expect(other.sent).toEqual([]);
  const cat = JSON.stringify({ x: 0.1, y: 0.2, s: [0, 0] });
  b.room.webSocketMessage(a, cat);
  b.room.webSocketMessage(a, cat);
  expect(other.sent).toHaveLength(1);
  b.time(80);
  b.room.webSocketMessage(a, cat);
  expect(other.sent).toHaveLength(2);
  b.room.webSocketClose(a);
  expect(other.sent.at(-1)).toEqual({ id: a.attachment.id, gone: true });
  other.fail = true;
  expect(() => b.room.webSocketClose(a)).not.toThrow();
});

test('nudges target another visitor and throttle independently from movement', async () => {
  const b = relay();
  await b.room.fetch(); await b.room.fetch();
  const [a, target] = b.sockets;
  const text = JSON.stringify({ to: target.attachment.id, a: 'boop' });
  b.room.webSocketMessage(a, text);
  b.room.webSocketMessage(a, text);
  expect(target.sent).toEqual([{ from: a.attachment.id, a: 'boop' }]);
  b.time(2000);
  b.room.webSocketMessage(a, text);
  expect(target.sent).toHaveLength(2);
  b.room.webSocketMessage(a, JSON.stringify({ to: 'missing1', a: 'tag' }));
  expect(a.sent).toEqual([]);
});

test('worker requires websocket, allowed origin and protocol version before selecting a language-neutral room', async () => {
  const b = relay();
  const calls: any[] = [];
  const env = { ROOMS: { idFromName: (name: string) => name, get: (id: string) => ({ fetch: async (request: any) => { calls.push({ id, request }); return new Response('room'); } }) } };
  const request = (headers: any, search = '?v=3&room=%2Fes%2Fcontact%2F') => new Request('https://example.test/' + search, { headers });
  expect((await b.worker.fetch(request({}), env)).status).toBe(426);
  expect((await b.worker.fetch(request({ Upgrade: 'websocket', Origin: 'https://elsewhere.test' }), env)).status).toBe(403);
  expect((await b.worker.fetch(request({ Upgrade: 'websocket', Origin: 'https://4st.li' }, '?v=2'), env)).status).toBe(426);
  const response = await b.worker.fetch(request({ Upgrade: 'websocket', Origin: 'https://4st.li' }), env);
  expect(await response.text()).toBe('room');
  expect(calls[0].id).toBe('/contact/');
});
