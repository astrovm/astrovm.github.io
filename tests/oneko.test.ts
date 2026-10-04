import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/oneko.js', import.meta.url), 'utf8');

function catPage({ article = true, reduced = false } = {}) {
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
  const location = { pathname: article ? '/en/blog/story/' : '/en/', search: '' };
  const window: any = Object.assign(new EventTarget(), {
    location, innerWidth: 400, innerHeight: 600, scrollY: 0,
    matchMedia: (query: string) => ({ matches: query.includes('reduced-motion') ? reduced : true }),
  });
  const storage = new Map();
  runInNewContext(source, {
    window, document, location, URLSearchParams, Date, CustomEvent,
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) },
    setInterval: (fn: () => void) => intervals.push(fn), setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame() {},
  });
  const cat = body.children.find((el) => el.className === 'oneko-cat')!;
  const pointer = (type: string, x: number, y: number, pointerType = 'mouse', id = 1) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { pointerId: id, pointerType, clientX: x, clientY: y, button: 0 });
    cat.dispatchEvent(event);
  };
  return { cat, pointer, window, location, document, body, tick: () => intervals.forEach((fn) => fn()) };
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
  b.tick();
  expect(b.window.oneko.cats()[0]).toEqual({ x: 16, y: 19 });
  expect(b.cat).toBe(original);
});


test('one cat follows article progress, then detaches when dragged off the bar', () => {
  const b = catPage();
  b.window.scrollY = 500;
  b.window.dispatchEvent(new Event('scroll'));
  b.tick();
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
  b.tick();
  expect(b.cat.style.backgroundPosition).toBe('-64px 0px');
  expect(b.body.children.filter((el) => el.className === 'oneko-cat' && !el.hidden)).toHaveLength(1);
});
