import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/oneko.js', import.meta.url), 'utf8');

function catPage({ article = true, reduced = false, width = 400 } = {}) {
  class Element extends EventTarget {
    style: Record<string, any> = {};
    className = '';
    children: Element[] = [];
    classList = { add() {}, remove() {} };
    captured = new Set<number>();
    isConnected = true;
    hidden = false;
    setAttribute() {}
    appendChild(el: Element) { this.children.push(el); }
    remove() { this.isConnected = false; }
    setPointerCapture(id: number) { this.captured.add(id); }
    hasPointerCapture(id: number) { return this.captured.has(id); }
    releasePointerCapture(id: number) { this.captured.delete(id); }
  }
  const body = new Element();
  const document = Object.assign(new EventTarget(), {
    body, head: new Element(), hidden: false,
    documentElement: { scrollHeight: 1600 },
    createElement: () => new Element(),
    querySelector: (selector: string) => selector.includes('.post:not') && article ? {} : null,
    querySelectorAll: () => [],
  });
  const intervals: (() => void)[] = [];
  const frames: (() => void)[] = [];
  let clock = 0;
  const location = { pathname: article ? '/en/blog/story/' : '/en/', search: '?today=2026-04-01' };
  const window: any = Object.assign(new EventTarget(), {
    location, innerWidth: width, innerHeight: 600, scrollY: 0,
    matchMedia: (query: string) => ({ matches: query.includes('reduced-motion') ? reduced : true }),
  });
  const storage = new Map();
  runInNewContext(source, {
    window, document, location, URLSearchParams, Date, CustomEvent, performance: { now: () => clock },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    setInterval: (fn: () => void) => intervals.push(fn), setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: (fn: () => void) => frames.push(fn),
  });
  const cat = body.children.find((el) => el.className === 'oneko-cat')!;
  const pointer = (type: string, x: number, y: number, pointerType = 'mouse', id = 1) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType, clientX: x, clientY: y, button: 0 });
    cat.dispatchEvent(event);
  };
  const yarn = () => body.children.find((el) => el.className === 'oneko-yarn')!;
  // Run animation frames at a refresh rate until nothing is left to draw.
  const animate = (hz = 60, limit = 2000) => {
    const start = clock;
    for (let i = 0; i < limit && frames.length; i++) {
      clock += 1000 / hz;
      frames.splice(0).forEach((fn) => fn());
    }
    return clock - start;
  };
  const later = (ms: number) => { clock += ms; };
  const tick = () => intervals.forEach((fn) => fn());
  const settle = () => { for (let i = 0; i < 40; i++) tick(); };
  return { cat, yarn, pointer, animate, later, settle, window, location, document, body, tick };
}

test('a reader can drag the cat and leave it in place without petting it', () => {
  const b = catPage();
  b.pointer('pointerdown', 16, 19);
  expect(b.cat.hasPointerCapture(1)).toBe(true);
  b.pointer('pointermove', 140, 180);
  b.tick();
  expect(b.window.oneko.cats()[0]).toEqual({ x: 140, y: 180 });
  b.pointer('pointerup', 140, 180);
  b.cat.dispatchEvent(new Event('click'));
  b.tick();
  expect(b.window.oneko.cats()[0]).toEqual({ x: 140, y: 180 });
  expect(b.window.oneko.pets()).toBe(0);
  expect(b.cat.style.cursor).toBe('grab');
  expect(b.cat.hasPointerCapture(1)).toBe(false);
});

test('touch dragging works with reduced motion and clamps the cat inside the viewport', () => {
  const b = catPage({ reduced: true });
  b.pointer('pointerdown', 16, 19, 'touch');
  b.pointer('pointermove', -100, 1000, 'touch');
  b.pointer('pointerup', -100, 1000, 'touch');
  expect(b.window.oneko.cats()[0]).toEqual({ x: 16, y: 584 });
});

test('cancelling a drag releases capture and keeps the cat still', () => {
  const b = catPage();
  b.pointer('pointerdown', 16, 19);
  b.pointer('pointermove', 100, 150);
  b.pointer('pointercancel', 100, 150);
  b.tick();
  expect(b.cat.hasPointerCapture(1)).toBe(false);
  expect(b.window.oneko.cats()[0]).toEqual({ x: 100, y: 150 });
});

test('articles are quiet and cannot be bitten, pushed, tilted or have words stolen', () => {
  const b = catPage();
  const before = b.window.oneko.cats();
  b.document.dispatchEvent(Object.assign(new Event('mousemove'), { clientX: 100, clientY: 400 }));
  b.tick();
  expect(b.window.oneko.cats()).toEqual(before);
  for (const action of ['bite', 'knock', 'push', 'steal']) expect(b.window.oneko[action]()).toBe(false);
});

test('navigation resets the reader placement while preserving the cat instance', () => {
  const b = catPage();
  const original = b.cat;
  b.pointer('pointerdown', 16, 19);
  b.pointer('pointermove', 100, 200);
  b.pointer('pointerup', 100, 200);
  b.window.dispatchEvent(new Event('site:navigate'));
  b.settle();
  expect(b.window.oneko.cats()[0]).toEqual({ x: 16, y: 19 });
  expect(b.cat).toBe(original);
});


test('one cat follows article progress, then detaches when dragged off the bar', () => {
  const b = catPage();
  b.window.scrollY = 500;
  b.window.dispatchEvent(new Event('scroll'));
  b.settle();
  expect(b.window.oneko.cats()).toEqual([{ x: 188, y: 19 }]);
  b.pointer('pointerdown', 188, 19);
  b.pointer('pointermove', 100, 200);
  b.pointer('pointerup', 100, 200);
  b.window.scrollY = 900;
  b.window.dispatchEvent(new Event('scroll'));
  b.tick();
  expect(b.window.oneko.cats()).toEqual([{ x: 100, y: 200 }]);
});

test('reduced motion keeps one still sprite following progress until dragged away', () => {
  const b = catPage({ reduced: true });
  b.window.scrollY = 500;
  b.window.dispatchEvent(new Event('scroll'));
  expect(b.window.oneko.cats()).toEqual([{ x: 188, y: 19 }]);
  b.pointer('pointerdown', 188, 19, 'touch');
  b.pointer('pointermove', 100, 200, 'touch');
  b.pointer('pointerup', 100, 200, 'touch');
  b.window.scrollY = 900;
  b.window.dispatchEvent(new Event('scroll'));
  expect(b.window.oneko.cats()).toEqual([{ x: 100, y: 200 }]);
});


test('the progress neko sleeps at the end and keeps extra cats out of articles', () => {
  const b = catPage();
  b.window.oneko.friend();
  b.window.scrollY = 1000;
  b.settle();
  expect(b.cat.style.backgroundPosition).toBe('-64px 0px');
  expect(b.body.children.filter((el) => el.className === 'oneko-cat' && !el.hidden)).toHaveLength(1);
});

test('a held cat swings against the drag, kicks, then lands and grooms', () => {
  const b = catPage({ article: false });
  b.pointer('pointerdown', 32, 32);
  b.pointer('pointermove', 132, 32);
  expect(parseFloat(b.cat.style.rotate)).toBeLessThan(0);
  const swing = Math.abs(parseFloat(b.cat.style.rotate));
  b.tick();
  expect(Math.abs(parseFloat(b.cat.style.rotate))).toBeLessThan(swing);
  for (let i = 0; i < 12; i++) b.tick();
  expect(['-192px -96px', '-224px -64px']).toContain(b.cat.style.backgroundPosition);
  b.pointer('pointerup', 132, 32);
  expect(b.cat.style.rotate).toBe('');
  b.tick();
  expect(['-160px 0px', '-192px 0px', '-224px 0px']).toContain(b.cat.style.backgroundPosition);
  expect(b.window.oneko.cats()[0]).toEqual({ x: 132, y: 32 });
});

test('reduced motion drags the cat without swinging it', () => {
  const b = catPage({ article: false, reduced: true });
  b.pointer('pointerdown', 32, 32);
  b.pointer('pointermove', 132, 32);
  b.tick();
  expect(b.cat.style.rotate).toBeUndefined();
});

test('the cat comes over and paws at yarn while someone holds it up', () => {
  const b = catPage({ article: false, width: 800 });
  const at = (type: string, x: number, y: number) =>
    b.yarn().dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: 2, pointerType: 'mouse', clientX: x, clientY: y, button: 0 }));
  at('pointerdown', 28, 572);
  at('pointermove', 300, 300);
  for (let i = 0; i < 40; i++) b.tick();
  const cat = b.window.oneko.cats()[0];
  expect(Math.hypot(cat.x - 300, cat.y - 320)).toBeLessThan(12);
  expect(['0px 0px', '0px -32px']).toContain(b.cat.style.backgroundPosition);
});

test('entering an article, the cat runs to the progress bar instead of jumping there', () => {
  const b = catPage();
  b.pointer('pointerdown', 16, 19);
  b.pointer('pointermove', 200, 400);
  b.pointer('pointerup', 200, 400);
  b.window.dispatchEvent(new Event('site:navigate'));
  b.tick();
  const first = b.window.oneko.cats()[0];
  expect(first).not.toEqual({ x: 16, y: 19 });
  expect(Math.hypot(first.x - 200, first.y - 400)).toBeLessThanOrEqual(60.01);
  b.settle();
  expect(b.window.oneko.cats()[0]).toEqual({ x: 16, y: 19 });
  expect(b.body.children.filter((el) => el.className === 'oneko-print')).toHaveLength(0);
});

test('reduced motion still puts the cat straight on the progress bar', () => {
  const b = catPage({ reduced: true });
  b.window.scrollY = 1000;
  b.window.dispatchEvent(new Event('scroll'));
  expect(b.window.oneko.cats()).toEqual([{ x: 384, y: 19 }]);
});

function yarnPage() {
  const b = catPage({ article: false, width: 800 });
  const at = (type: string, x: number, y: number) =>
    b.yarn().dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: 2, pointerType: 'mouse', clientX: x, clientY: y, button: 0 }));
  const where = () => ({ x: parseFloat(b.yarn().style.left), y: parseFloat(b.yarn().style.top) });
  // Carry it to (x, y) and set it down gently.
  const put = (x: number, y: number) => {
    const from = where();
    at('pointerdown', from.x, from.y);
    at('pointermove', x, y);
    b.later(500);
    at('pointerup', x, y);
  };
  // Flick it from (fromX, fromY), moving dx, dy every 16 ms.
  const flick = (fromX: number, fromY: number, dx: number, dy: number, steps = 5) => {
    put(fromX, fromY);
    at('pointerdown', fromX, fromY);
    for (let i = 1; i <= steps; i++) {
      b.later(16);
      at('pointermove', fromX + dx * i, fromY + dy * i);
    }
    at('pointerup', fromX + dx * steps, fromY + dy * steps);
  };
  return { ...b, at, where, put, flick };
}

test('yarn keeps the spot you grabbed it by', () => {
  const b = yarnPage();
  b.at('pointerdown', 34, 566);
  b.at('pointermove', 134, 466);
  expect(b.where()).toEqual({ x: 128, y: 472 });
});

test('a flick throws the yarn, and it rolls the same way on 60 and 120 Hz screens', () => {
  const rolled = (hz: number) => {
    const b = yarnPage();
    b.flick(28, 300, 6, 0);
    const ms = b.animate(hz);
    return { x: b.where().x, ms };
  };
  const at60 = rolled(60);
  const at120 = rolled(120);
  expect(at60.x).toBeGreaterThan(200);
  expect(Math.abs(at120.x - at60.x)).toBeLessThan(at60.x * 0.03);
  expect(Math.abs(at120.ms - at60.ms)).toBeLessThan(at60.ms * 0.05);
});

test('yarn held still before letting go just drops', () => {
  const b = yarnPage();
  b.at('pointerdown', 28, 572);
  b.later(16);
  b.at('pointermove', 100, 300);
  b.later(500);
  b.at('pointerup', 100, 300);
  b.animate();
  expect(b.where()).toEqual({ x: 100, y: 300 });
});

test('yarn spins as it rolls and comes back off a wall slower, squashed for a moment', () => {
  const b = yarnPage();
  b.flick(700, 300, 12, 0);
  b.animate(60, 6);
  expect(b.yarn().style.scale).toMatch(/^0\.\d+ 1\.\d+$/);
  const before = parseFloat(b.yarn().style.rotate);
  b.animate();
  expect(b.where().x).toBeLessThan(788);
  expect(parseFloat(b.yarn().style.rotate)).not.toBe(before);
});

test('rolling yarn bounces off the cat', () => {
  const b = yarnPage();
  const cat = b.window.oneko.cats()[0];
  b.flick(cat.x + 150, cat.y, -8, 0);
  let closest = Infinity;
  for (let i = 0; i < 300; i++) {
    b.animate(60, 1);
    closest = Math.min(closest, b.where().x);
  }
  // Never rolls through the cat to the wall behind it.
  expect(closest).toBeGreaterThan(cat.x + 20);
});

test('the cat steps out while another cat takes over, then comes back', () => {
  const b = yarnPage();
  b.window.oneko.hide();
  b.settle();
  b.window.oneko.pet();
  expect(b.cat.hidden).toBe(true);
  expect(b.yarn().hidden).toBe(true);
  expect(b.body.children.filter((el) => el.className === 'oneko-bubble')).toHaveLength(0);
  b.window.oneko.show();
  b.tick();
  expect(b.cat.hidden).toBe(false);
  expect(b.yarn().hidden).toBe(false);
});
