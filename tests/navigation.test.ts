import { test, expect } from 'bun:test';
import { browserSource, coverage } from './helpers/coverage';
import { runInNewContext } from 'node:vm';

const source = browserSource('assets/navigation.js');
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function browser() {
  const listeners = new Map<string, (event: any) => void>();
  const capturing = new Set<string>();
  const location = {
    href: 'https://example.test/en/',
    get origin() { return new URL(this.href).origin; },
    get pathname() { return new URL(this.href).pathname; },
    get search() { return new URL(this.href).search; },
    assign: (href: string) => { fallback.push(href); },
  };
  const fallback: string[] = [];
  const visits: string[] = [];
  const requests: { url: string; signal: AbortSignal; resolve: (value: any) => void; reject: (error: Error) => void }[] = [];
  const events: string[] = [];
  const titles: string[] = [];
  const scrolls: [number, number][] = [];
  const attributes = new Map();
  let focused = false;
  let rendered = 'home';
  let replacedHeader = false;
  // A theme menu: the trigger and dropdown carry the theme's click handlers.
  function menu(label: string, open = false) {
    const classes = new Set(open ? ['menu', 'open'] : ['menu']);
    const part = (items: string[]) => ({ childNodes: items, replaceChildren(...nodes: string[]) { this.childNodes = nodes; } });
    const parts: Record<string, any> = { '.menu__trigger': part([label]), '.menu__dropdown': part([`${label} links`]) };
    return {
      label, swappedFor: null as any, classes,
      classList: { remove: (name: string) => classes.delete(name) },
      querySelector: (selector: string) => parts[selector],
      replaceWith(other: any) { this.swappedFor = other; },
    };
  }
  let menus = [menu('english', true)];
  let nextMenus = [menu('español')];
  const header = { querySelectorAll: () => menus, replaceWith() { replacedHeader = true; } };
  const content = {
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    removeAttribute: (key: string) => attributes.delete(key),
    replaceChildren: (text: string) => { rendered = text; },
    querySelectorAll: () => [],
    querySelector: () => ({ setAttribute() {}, focus() { focused = true; } }),
  };
  const history = {
    state: null as any,
    scrollRestoration: 'auto',
    replaceState: (state: any, _: string, href: string) => { history.state = state; location.href = href; },
    pushState: (state: any, _: string, href: string) => { history.state = state; location.href = href; visits.push(href); },
  };
  const document = {
    documentElement: { lang: 'en' },
    head: { querySelectorAll: () => [], append() {} },
    getElementById: () => null,
    querySelector: (selector: string) => selector === '.content' ? content : header,
    addEventListener: (name: string, fn: (event: any) => void, capture?: boolean) => {
      listeners.set(name, fn);
      if (capture) capturing.add(name);
    },
  };
  const window = {
    history, scrollX: 0, scrollY: 0,
    fetch: (url: string, { signal }: any) => new Promise((resolve, reject) => requests.push({ url, signal, resolve, reject })),
    addEventListener: document.addEventListener,
    dispatchEvent: (event: CustomEvent) => { events.push(event.type); titles.push(event.detail?.title); },
    scrollTo: (x: number, y: number) => scrolls.push([x, y]),
  };
  class DOMParser {
    parseFromString(text: string) {
      return {
        documentElement: { lang: text === 'spanish' ? 'es' : 'en' },
        title: `${text} :: astro@web`,
        head: document.head,
        querySelector: (selector: string) => selector === '.content' ? { childNodes: [text] } : { querySelectorAll: () => nextMenus },
      };
    }
  }
  runInNewContext(source, { __coverage__: coverage, window, document, location, history, fetch: window.fetch, DOMParser, URL, AbortController, Event, CustomEvent });
  function click(path: string, extra: any = {}) {
    let prevented = false;
    const link = { href: new URL(path, location.href).href, target: '', hasAttribute: () => false, ...extra.link };
    listeners.get('click')!({ target: { closest: () => link }, button: 0, preventDefault: () => { prevented = true; }, ...extra });
    return prevented;
  }
  function respond(index = 0, text = 'article', overrides: any = {}) {
    requests[index].resolve({ ok: true, url: requests[index].url, headers: { get: () => 'text/html' }, text: async () => text, ...overrides });
  }
  const setMenus = (now: any[], next: any[]) => { menus = now; nextMenus = next; };
  return { click, respond, requests, location, history, window, listeners, capturing, menu, setMenus, menus: () => menus, nextMenus: () => nextMenus, fallback, visits, events, titles, scrolls, document,
    state: () => ({ rendered, focused, replacedHeader, busy: attributes.has('aria-busy') }) };
}

test('internal navigation keeps the document, renders the page, focuses its heading and updates history', async () => {
  const b = browser();
  expect(b.click('/en/blog/story/')).toBe(true);
  expect(b.state().busy).toBe(true);
  b.respond();
  await settle();
  expect(b.state()).toEqual({ rendered: 'article', focused: true, replacedHeader: true, busy: false });
  expect(b.location.pathname).toBe('/en/blog/story/');
  expect(b.events).toEqual(['site:navigate']);
  // The terminal owns the tab title, so the new one rides on the event.
  expect(b.titles).toEqual(['article :: astro@web']);
  expect(b.scrolls).toEqual([[0, 0]]);
});

test('links in the theme dropdowns are caught before the theme stops the click', () => {
  expect(browser().capturing.has('click')).toBe(true);
});

test('the header keeps the theme menus and their handlers, with the new page inside', async () => {
  const b = browser();
  const [kept] = b.menus();
  const [incoming] = b.nextMenus();
  b.click('/es/contact/');
  b.respond();
  await settle();
  expect(incoming.swappedFor).toBe(kept);
  expect(kept.classes.has('open')).toBe(false);
  expect(kept.querySelector('.menu__trigger').childNodes).toEqual(['español']);
  expect(kept.querySelector('.menu__dropdown').childNodes).toEqual(['español links']);
});

test('a header with different menus is replaced whole', async () => {
  const b = browser();
  const extra = b.menu('extra');
  b.setMenus([], [extra]);
  b.click('/en/contact/');
  b.respond();
  await settle();
  expect(extra.swappedFor).toBe(null);
  expect(b.state().replacedHeader).toBe(true);
});

test('language navigation updates the page language', async () => {
  const b = browser();
  b.click('/es/contact/');
  b.respond(0, 'spanish');
  await settle();
  expect(b.document.documentElement.lang).toBe('es');
});

test('external links, files, same-page anchors, downloads and modified clicks keep browser behavior', () => {
  const b = browser();
  for (const path of ['https://elsewhere.test/en/', '/en/blog/index.xml', '/en/#section', '/image.png']) {
    expect(b.click(path)).toBe(false);
  }
  expect(b.click('/en/contact/', { ctrlKey: true })).toBe(false);
  expect(b.click('/en/contact/', { button: 1 })).toBe(false);
  expect(b.click('/en/contact/', { defaultPrevented: true })).toBe(false);
  expect(b.click('/en/contact/', { link: { target: '_blank' } })).toBe(false);
  expect(b.click('/en/contact/', { link: { hasAttribute: () => true } })).toBe(false);
  expect(b.requests).toHaveLength(0);
});

test('failed requests and non-HTML responses fall back to full navigation', async () => {
  for (const failure of ['network', 'status', 'mime', 'redirect']) {
    const b = browser();
    b.click('/en/contact/');
    if (failure === 'network') b.requests[0].reject(new Error('offline'));
    else b.respond(0, 'page', failure === 'status' ? { ok: false } : failure === 'mime' ? { headers: { get: () => 'application/json' } } : { url: 'https://elsewhere.test/' });
    await settle();
    expect(b.fallback).toEqual(['https://example.test/en/contact/']);
    expect(b.state().busy).toBe(false);
  }
});

test('a slow earlier response cannot overwrite the latest navigation', async () => {
  const b = browser();
  b.click('/en/projects/');
  b.click('/en/contact/');
  expect(b.requests[0].signal.aborted).toBe(true);
  b.respond(1, 'contact');
  await settle();
  b.respond(0, 'projects');
  await settle();
  expect(b.state().rendered).toBe('contact');
  expect(b.visits).toEqual(['https://example.test/en/contact/']);
  expect(b.fallback).toEqual([]);
});

test('back/forward restores the saved scroll without adding history entries', async () => {
  const b = browser();
  b.location.href = 'https://example.test/en/projects/';
  b.listeners.get('popstate')!({ state: { scroll: { x: 0, y: 320 } } });
  b.respond();
  await settle();
  expect(b.scrolls).toEqual([[0, 320]]);
  expect(b.visits).toEqual([]);
});

test('a current-page anchor cancels an unfinished page navigation', async () => {
  const b = browser();
  b.click('/en/contact/');
  expect(b.click('/en/#section')).toBe(false);
  expect(b.requests[0].signal.aborted).toBe(true);
  b.respond(0, 'contact');
  await settle();
  expect(b.state().rendered).toBe('home');
  expect(b.visits).toEqual([]);
  expect(b.state().busy).toBe(false);
});
