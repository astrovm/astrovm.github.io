import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/fun.js', import.meta.url), 'utf8');

function page(reduced = false) {
  class Element {
    className = '';
    style: Record<string, string> = {};
    hidden = false;
    setAttribute() {}
    remove() { elements.delete(this); }
  }
  const elements = new Set<Element>();
  let article = true;
  const document = Object.assign(new EventTarget(), {
    readyState: 'complete',
    documentElement: { lang: 'en', scrollHeight: 1500, classList: { remove() {} }, style: { removeProperty() {} } },
    body: { append: (...els: Element[]) => els.forEach((el) => elements.add(el)) },
    createElement: () => new Element(),
    querySelector: (selector: string) => selector.includes('.post:not') && article ? {} : null,
    querySelectorAll: () => [...elements],
  });
  const timers = new Map<number, () => void>();
  let id = 0;
  const window = Object.assign(new EventTarget(), {
    location: { pathname: '/en/blog/story/', search: '?today=2026-04-01' },
    innerWidth: 800, innerHeight: 500, scrollY: 0,
    matchMedia: (query: string) => ({ matches: query.includes('reduced-motion') ? reduced : true }),
    setInterval: (fn: () => void) => { timers.set(++id, fn); return id; },
    clearInterval: (key: number) => timers.delete(key),
    cancelAnimationFrame() {},
  });
  runInNewContext(source, {
    window, document, AbortController, URLSearchParams, Intl,
    localStorage: { getItem: () => null }, console: { log() {} },
  });
  const find = (name: string) => [...elements].find((el) => el.className === name)!;
  return { window, document, timers, elements, find,
    navigate: (toArticle: boolean) => { article = toArticle; window.dispatchEvent(new Event('site:navigate')); } };
}

test('article progress draws only a line and updates with scroll', () => {
  const b = page();
  b.window.scrollY = 500;
  b.window.dispatchEvent(new Event('scroll'));
  expect(b.find('fun-progress').style.width).toBe('50%');
  expect(b.elements.size).toBe(1);
  expect(b.find('fun-progress-cat')).toBeUndefined();
});

test('SPA navigation removes the old progress bar before adding one new bar', () => {
  const b = page();
  const old = b.find('fun-progress');
  b.navigate(true);
  expect(b.elements.size).toBe(1);
  expect(b.elements.has(old)).toBe(false);
  b.navigate(false);
  expect(b.elements.size).toBe(0);
});

test('reduced motion keeps the progress line visible without animation timers', () => {
  const b = page(true);
  b.window.scrollY = 500;
  b.window.dispatchEvent(new Event('scroll'));
  expect(b.find('fun-progress').style.width).toBe('50%');
  expect(b.timers.size).toBe(0);
});
