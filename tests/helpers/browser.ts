import { Window } from 'happy-dom';
import { createContext, runInContext } from 'node:vm';
import { browserSource, coverage } from './coverage';

export const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };

// Real DOM, synthetic layout, and a clock we can move without waiting for animations.
export function browser({ html = '', url = 'https://example.test/en/?today=2026-04-01', width = 800, height = 600, touch = false, random = 0.5 } = {}) {
  const window: any = new Window({ url, settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true, disableJavaScriptEvaluation: true } });
  const document = window.document;
  document.body.innerHTML = html;
  document.documentElement.lang = 'en';
  window.innerWidth = width;
  window.innerHeight = height;
  Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  window.matchMedia = () => ({ matches: !touch });
  const rect = (el: any, box: any = {}) => {
    const bounds = { x: 100, y: 100, left: 100, top: 100, width: 160, height: 40, ...box };
    bounds.right = bounds.left + bounds.width;
    bounds.bottom = bounds.top + bounds.height;
    el.getBoundingClientRect = () => bounds;
    el.getClientRects = () => [bounds];
    return bounds;
  };
  for (const el of document.querySelectorAll('*')) rect(el);
  const captured = new WeakMap();
  window.HTMLElement.prototype.setPointerCapture = function (id: number) { captured.set(this, id); };
  window.HTMLElement.prototype.hasPointerCapture = function (id: number) { return captured.get(this) === id; };
  window.HTMLElement.prototype.releasePointerCapture = function () { captured.delete(this); };
  const scrolls: any[] = [];
  window.scrollTo = (x: any, y: any) => {
    window.scrollX = typeof x === 'object' ? x.left ?? 0 : x;
    window.scrollY = typeof x === 'object' ? x.top ?? 0 : y;
    scrolls.push([window.scrollX, window.scrollY]);
    window.dispatchEvent(new window.Event('scroll'));
  };
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1600, writable: true });
  let now = Date.parse('2026-04-01T12:00:00Z');
  let randomValue: any = random;
  class Clock extends Date {
    constructor(...args: any[]) { super(args.length ? args[0] : now); }
    static now() { return now; }
  }
  const math = Object.create(Math);
  math.random = () => typeof randomValue === 'function' ? randomValue() : randomValue;
  let id = 0;
  const timers = new Map<number, { fn: () => void; at: number; repeat: number }>();
  const frames = new Map<number, (ts: number) => void>();
  const timeout = (fn: () => void, delay = 0) => { timers.set(++id, { fn, at: now + (Number(delay) || 0), repeat: 0 }); return id; };
  const interval = (fn: () => void, delay = 0) => { timers.set(++id, { fn, at: now + delay, repeat: Math.max(1, delay) }); return id; };
  const clear = (id: number) => timers.delete(id);
  const raf = (fn: (ts: number) => void) => { frames.set(++id, fn); return id; };
  Object.assign(window, { setTimeout: timeout, setInterval: interval, clearTimeout: clear, clearInterval: clear, requestAnimationFrame: raf, cancelAnimationFrame: (id: number) => frames.delete(id) });
  const advance = (ms: number) => {
    const until = now + ms;
    let runs = 0;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      if (++runs > 100000) throw new Error('Timer loop');
      const [key, timer] = due;
      now = timer.at;
      if (timer.repeat) timer.at += timer.repeat;
      else timers.delete(key);
      timer.fn();
    }
    now = until;
  };
  const frame = (count = 1) => {
    for (let i = 0; i < count; i++) {
      advance(1000 / 60);
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(now));
    }
  };
  const logs: any[][] = [];
  const fetches: any[] = [];
  const fetch = async (...args: any[]) => { fetches.push(args); return new Response('{}', { headers: { 'content-type': 'application/json' } }); };
  window.fetch = fetch;
  const context: any = createContext({
    __coverage__: coverage, window, document, location: window.location, history: window.history,
    navigator: window.navigator, localStorage: window.localStorage, sessionStorage: window.sessionStorage,
    Date: Clock, Math: math, performance: { now: () => now - Date.parse('2026-04-01T12:00:00Z') },
    setTimeout: timeout, setInterval: interval, clearTimeout: clear, clearInterval: clear,
    requestAnimationFrame: raf, cancelAnimationFrame: window.cancelAnimationFrame,
    Event: window.Event, CustomEvent: window.CustomEvent, Node: window.Node, NodeFilter: window.NodeFilter,
    MutationObserver: window.MutationObserver, AbortController: window.AbortController,
    DOMParser: window.DOMParser, URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto, fetch, getComputedStyle: window.getComputedStyle.bind(window), console: { log: (...a: any[]) => logs.push(a), warn: (...a: any[]) => logs.push(a) },
  });
  const run = (path: string) => runInContext(browserSource(path), context, { filename: path });
  const emit = (target: any, type: string, props: any = {}) => {
    const event = new window.Event(type, { cancelable: true, bubbles: true });
    Object.assign(event, props);
    target.dispatchEvent(event);
    return event;
  };
  const pointer = (target: any, type: string, x: number, y: number, extra = {}) => emit(target, type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, ...extra });
  return { window, document, context, run, emit, pointer, rect, advance, frame, timers, frames, logs, scrolls, fetches, random: (value: any) => { randomValue = value; }, now: () => now };
}
