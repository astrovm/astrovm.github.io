import { test, expect } from 'bun:test';
import { browser, settle } from './helpers/browser';

const status = '<div id="site-status"><span id="status-clock"></span><span id="status-weather" hidden></span></div><button id="sound-toggle" hidden></button>';
function fun(options: any = {}) {
  const b = browser(options);
  const calls: any[] = [];
  let positions: any[] = [];
  let point: any;
  let list: any;
  const cat: any = { x: 100, y: 100, sprite: [-3, -3], reading: false, hidden: false };
  b.window.oneko = {
    hat: (name: string) => calls.push(['hat', name]), cats: () => positions,
    chase: (fn: any) => point = fn, guide: () => {}, note: (text: string) => calls.push(['note', text]),
    play: () => calls.push(['play']), me: () => cat, friends: (fn: any) => list = fn,
    noticed: (ghost: any) => calls.push(['noticed', ghost]), booped: (ghost: any) => calls.push(['booped', ghost]), tagged: (ghost: any) => calls.push(['tagged', ghost]),
    passed: (ghost: any) => { calls.push(['passed', ghost]); return options.acceptYarn ?? false; },
  };
  const tones: any[] = [];
  const closes: number[] = [];
  b.context.AudioContext = class {
    currentTime = 1; destination = {};
    createOscillator() { return { frequency: { setValueAtTime: (...a: any[]) => tones.push(a), linearRampToValueAtTime: (...a: any[]) => tones.push(a) }, connect: (gain: any) => gain, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    close() { closes.push(1); return Promise.reject(new Error('already closed')); }
  };
  return { ...b, calls, tones, closes, cat, positions: (value: any[]) => positions = value, chase: () => point?.(), friends: () => list?.() };
}

test('status uses Buenos Aires time and sound labels in all four languages', async () => {
  for (const lang of ['en', 'es', 'ja', 'zh']) {
    const b = fun({ html: status, url: 'https://example.test/en/?today=2026-03-03T06:00:00Z' });
    b.document.documentElement.lang = lang;
    b.context.fetch = async () => ({ ok: false });
    b.run('assets/fun.js');
    expect(b.document.querySelector('#status-clock').textContent).toContain('03:00 BA 💤');
    const button = b.document.querySelector('#sound-toggle');
    expect(button.hidden).toBe(false);
    button.click(); expect(button.getAttribute('aria-pressed')).toBe('false');
    b.emit(b.window, 'oneko:meow'); expect(b.tones).toHaveLength(0);
    button.click(); expect(button.getAttribute('aria-pressed')).toBe('true');
    for (const sound of ['oneko:meow', 'oneko:purr', 'oneko:nom']) b.emit(b.window, sound);
    expect(b.tones.length).toBeGreaterThan(10);
    b.advance(30000);
    b.emit(b.window, 'site:navigate'); await settle();
    expect(b.closes).toHaveLength(1);
  }
});

test('weather caches fresh readings, swaps its glyph on click and covers each weather family', async () => {
  for (const [code, day, icon] of [[0, true, '☀'], [1, false, '☾'], [2, true, '⛅'], [2, false, '⛅'], [3, true, '☁'], [45, true, '≋'], [48, true, '≋'], [71, true, '❄'], [85, true, '❄'], [95, true, '⚡'], [61, true, '☂']] as const) {
    const b = fun({ html: status });
    b.window.sessionStorage.setItem('fun.weather', JSON.stringify({ temperature: 18, code, isDay: day, checked: b.now() }));
    b.run('assets/fun.js'); await settle();
    const button = b.document.querySelector('.weather-icon');
    expect(button.textContent).toStartWith(icon);
    button.click();
    expect(b.window.localStorage.getItem('fun.weatherEmoji')).toBe('true');
    expect(b.document.querySelector('#status-weather').textContent).toEndWith('18°C');
    expect(b.fetches).toHaveLength(0);
  }
});

test('weather fetches stale data, tolerates bad storage and hides failed readings', async () => {
  const b = fun({ html: status });
  b.window.sessionStorage.setItem('fun.weather', 'invalid json');
  let requested: any;
  b.context.fetch = async (url: string, options: any) => { requested = { url, options }; return { ok: true, json: async () => ({ current: { temperature_2m: 19.7, weather_code: 3, is_day: 0 } }) }; };
  b.run('assets/fun.js'); await settle();
  expect(requested.url).toContain('open-meteo.com');
  expect(b.document.querySelector('#status-weather').textContent).toEndWith('20°C');
  const stored = JSON.parse(b.window.sessionStorage.getItem('fun.weather'));
  expect(stored.code).toBe(3);
  for (const failure of ['status', 'network', 'storage']) {
    const page = fun({ html: status });
    if (failure === 'storage') page.context.sessionStorage = { getItem() { throw new Error('blocked'); } };
    page.context.fetch = async () => { if (failure !== 'status') throw new Error('offline'); return { ok: false }; };
    page.run('assets/fun.js'); await settle();
    expect(page.document.querySelector('#status-weather').hidden).toBe(true);
  }
});

test('weather cannot render a stale response after navigation aborts it', async () => {
  const b = fun({ html: status });
  const pending: ((data: any) => void)[] = [];
  b.context.fetch = () => new Promise((resolve) => pending.push(resolve));
  b.run('assets/fun.js');
  b.emit(b.window, 'site:navigate');
  pending[0]({ ok: true, json: async () => ({ current: { temperature_2m: 10, weather_code: 0, is_day: 1 } }) });
  await settle();
  expect(b.document.querySelector('#status-weather').hidden).toBe(true);
  pending[1]({ ok: false }); await settle();
});

test('seasonal accents, hats, bats, petals and Sonic animations end and clean up on navigation', () => {
  const halloween = fun({ url: 'https://example.test/en/?today=2026-10-31', random: 0.1 });
  halloween.run('assets/fun.js'); halloween.advance(2000); halloween.frame();
  expect(halloween.calls).toContainEqual(['hat', 'pumpkin']);
  expect(halloween.document.querySelector('.fun-bat').style.transform).toContain('860px');
  halloween.advance(7000);
  halloween.random(0.9); halloween.advance(9000); halloween.frame();
  expect(halloween.document.querySelector('.fun-bat').style.transform).toContain('-860px');
  const pending = [...halloween.frames.values()];
  halloween.emit(halloween.window, 'site:navigate');
  pending.forEach((fn) => fn(0));
  const argentina = fun({ url: 'https://example.test/en/?today=2026-05-25' });
  argentina.run('assets/fun.js');
  expect(argentina.document.documentElement.classList.contains('fun-argentina')).toBe(true);
  const spring = fun({ url: 'https://example.test/en/?today=2026-09-21' });
  spring.run('assets/fun.js'); spring.advance(700);
  expect(spring.document.querySelectorAll('.fun-petal')).toHaveLength(1);
  Object.defineProperty(spring.document, 'hidden', { value: true, configurable: true });
  spring.advance(9000);
  expect(spring.document.querySelector('.fun-petal')).toBeNull();
  for (const random of [0.1, 0.9]) {
    const sonic = fun({ url: 'https://example.test/en/?today=2026-06-23', random });
    sonic.run('assets/fun.js'); sonic.advance(3000); sonic.frame();
    expect(sonic.chase()).not.toBeNull();
    sonic.frame(160);
    expect(sonic.document.querySelector('.fun-sonic')).toBeNull();
    expect(sonic.chase()).toBeNull();
  }
});

test('Christmas snow settles on headings and the cat knocks deep piles down', () => {
  const b = fun({ html: '<a class="logo">logo</a><h1 class="post-title">title</h1>', url: 'https://example.test/en/?today=2026-12-25', random: 0.1 });
  b.rect(b.document.querySelector('.logo'), { top: 20, left: 0, width: 800 });
  b.rect(b.document.querySelector('.post-title'), { top: 80, left: 500 });
  b.run('assets/fun.js'); b.frame(100);
  expect(b.document.querySelector('.fun-snowcap')).not.toBeNull();
  b.positions([{ x: 90, y: 20 }]); b.frame(20);
  expect(b.document.querySelector('.fun-snowcap-falling')).not.toBeNull();
  b.advance(900);
  expect(b.calls).toContainEqual(['hat', 'santa']);
  b.document.querySelector('.logo').remove(); b.frame(800);
  expect(b.document.querySelectorAll('.fun-flake').length).toBeLessThanOrEqual(45);
});

test('lost-page buttons dodge five mouse approaches or two touch clicks, then allow navigation', () => {
  for (const touch of [false, true]) {
    const b = fun({ html: '<div><a class="lost-home" href="/en/">home</a></div>', touch });
    b.run('assets/fun.js');
    const button = b.document.querySelector('.lost-home');
    if (touch) {
      expect(b.emit(button, 'click').defaultPrevented).toBe(true);
      expect(b.emit(button, 'click').defaultPrevented).toBe(true);
      expect(b.emit(button, 'click').defaultPrevented).toBe(false);
    } else {
      b.pointer(b.document, 'pointermove', 700, 500);
      expect(button.style.transform).toBe('');
      for (let i = 0; i < 7; i++) b.pointer(b.document, 'pointermove', 180, 120);
      expect(button.style.transform).toContain('translate');
    }
    b.advance(7000); expect(b.calls.filter(([name]) => name === 'play')).toHaveLength(2);
  }
});

function ghosts(options: any = {}) {
  const b = fun(options);
  const sockets: any[] = [];
  class Socket extends b.window.EventTarget {
    static OPEN = 1;
    readyState = 0;
    sent: any[] = [];
    url: string;
    constructor(url: string) { super(); this.url = url; sockets.push(this); }
    send(text: string) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState = 3; b.emit(this, 'close'); }
  }
  b.window.WebSocket = b.context.WebSocket = Socket;
  b.window.__GHOSTS_URL__ = 'wss://relay.example.test';
  const open = (socket = sockets.at(-1)) => { socket.readyState = 1; b.emit(socket, 'open'); return socket; };
  const hear = (data: any, socket = sockets.at(-1)) => b.emit(socket, 'message', { data: typeof data === 'string' ? data : JSON.stringify(data) });
  return { ...b, sockets, open, hear };
}

test('ghost cats appear, glide, interact, share our sprite and expire', () => {
  const b = ghosts(); b.run('assets/fun.js');
  const ws = b.open();
  expect(ws.url).toContain('v=3&room=%2Fen%2F');
  b.hear('bad json'); b.hear({ id: 'invalid' });
  b.hear({ id: 'friend1', x: 0.5, y: 0.5, s: [-3, -3], r: 0, h: 0 });
  expect(b.document.querySelectorAll('.fun-ghost')).toHaveLength(1);
  b.advance(1000);
  expect(b.calls.some(([name]) => name === 'noticed')).toBe(true);
  const [friend] = b.friends();
  friend.meet('boop'); expect(ws.sent.at(-1)).toEqual({ to: 'friend1', a: 'boop' });
  b.hear({ from: 'friend1', a: 'boop' }); b.hear({ from: 'friend1', a: 'tag' });
  expect(b.calls.some(([name]) => name === 'booped')).toBe(true);
  expect(b.calls.some(([name]) => name === 'tagged')).toBe(true);
  b.hear({ from: 'friend1', a: 'pass' }); b.hear({ from: 'unknown', a: 'pass' });
  expect(ws.sent.filter((message: any) => message.a === 'pass')).toHaveLength(1);
  b.hear({ id: 'friend1', x: 0.9, y: 0.2, s: [0, -1], r: 0, h: 1 }); b.advance(100);
  expect(b.document.querySelector('.fun-ghost').hidden).toBe(true);
  expect(b.friends()).toEqual([]);
  b.cat.reading = true; b.cat.x = 400;
  b.hear({ id: 'reader1', x: 0.5, y: 0.5, s: [-2, 0], r: 1, h: 0 }); b.advance(100);
  expect(b.calls.filter(([name]) => name === 'booped')).toHaveLength(2);
  b.advance(10000);
  expect(ws.sent.filter((message: any) => message.s)).toHaveLength(2);
  b.cat.sprite = null; b.advance(200); b.cat.sprite = [-3, -3];
  b.hear({ id: 'reader1', gone: true });
  b.advance(31000);
  expect(b.document.querySelectorAll('.fun-ghost')).toHaveLength(0);
});

test('ghost reconnects back off, hidden tabs leave and navigation clears sockets and listeners', () => {
  const b = ghosts(); b.run('assets/fun.js');
  const ws = b.open();
  b.hear({ id: 'friend1', x: 0.2, y: 0.2, s: [0, 0] });
  ws.close(); expect(b.document.querySelector('.fun-ghost')).toBeNull();
  b.advance(5000); expect(b.sockets).toHaveLength(2);
  const next = b.open();
  b.hear({ id: 'friend2', x: 0.2, y: 0.2, s: [0, 0] });
  Object.defineProperty(b.document, 'hidden', { value: true, configurable: true }); b.emit(b.document, 'visibilitychange');
  expect(next.readyState).toBe(3);
  Object.defineProperty(b.document, 'hidden', { value: false, configurable: true }); b.emit(b.document, 'visibilitychange');
  expect(b.sockets).toHaveLength(3);
  b.emit(b.window, 'site:navigate');
  expect(b.sockets[2].readyState).toBe(3);
  expect(b.sockets).toHaveLength(4);
});

test('ghost limit stays at 30 and accepted yarn does not bounce back', () => {
  const b = ghosts({ acceptYarn: true }); b.run('assets/fun.js'); const ws = b.open();
  for (let i = 0; i < 31; i++) b.hear({ id: `friend${i}`, x: 0.5, y: 0.5, s: [0, 0], r: 0, h: 0 });
  expect(b.document.querySelectorAll('.fun-ghost')).toHaveLength(30);
  b.hear({ from: 'friend0', a: 'pass' });
  expect(ws.sent).toEqual([]);
});

test('initialization waits for DOM readiness and invalid dates or unsupported languages remain usable', () => {
  const b = fun({ html: status, url: 'https://example.test/en/?today=invalid' });
  Object.defineProperty(b.document, 'readyState', { value: 'loading' });
  b.document.documentElement.lang = 'xx';
  b.context.localStorage = { getItem() { throw new Error('private'); }, setItem() { throw new Error('private'); }, removeItem() { throw new Error('private'); } };
  b.run('assets/fun.js'); expect(b.logs).toHaveLength(0);
  b.emit(b.document, 'DOMContentLoaded'); expect(b.logs).toHaveLength(1);
  expect(b.document.querySelector('#sound-toggle').hidden).toBe(true);
});

test('navigation cancels pending seasonal frames before starting the new page', () => {
  const b = fun({ url: 'https://example.test/en/?today=2026-10-31' });
  b.run('assets/fun.js'); b.advance(2000);
  expect(b.frames.size).toBe(1);
  const stale = [...b.frames.values()];
  b.emit(b.window, 'site:navigate');
  expect(b.frames.size).toBe(0);
  stale.forEach((fn) => fn(0));
  expect(b.document.querySelector('.fun-bat')).toBeNull();
});
