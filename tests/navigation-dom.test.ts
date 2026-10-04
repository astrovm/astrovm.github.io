import { test, expect } from 'bun:test';
import { browser, settle } from './helpers/browser';

const shell = '<header class="header"><div class="menu"><button class="menu__trigger">menu</button><div class="menu__dropdown"></div></div></header><main class="content"><h1>home</h1></main>';
function nav() {
  const b = browser({ html: shell });
  b.document.head.innerHTML = '<meta name="description" content="old"><link rel="canonical" href="https://example.test/en/">';
  const assignments: string[] = [];
  // Observe full-navigation fallback without making a real network request.
  b.context.location = { get href() { return b.window.location.href; }, get origin() { return b.window.location.origin; }, get pathname() { return b.window.location.pathname; }, get search() { return b.window.location.search; }, assign: (url: string) => assignments.push(url) };
  let next = shell.replace('home', 'article');
  let redirected = '';
  b.context.fetch = async (url: string) => ({ ok: true, url: redirected || url, headers: { get: () => 'text/html' }, text: async () => next });
  b.run('assets/navigation.js');
  const click = (path: string) => {
    const link = b.document.createElement('a');
    link.href = path;
    b.document.body.append(link);
    return b.emit(link, 'click', { button: 0 });
  };
  return { ...b, click, assignments, page: (html: string) => next = html, redirect: (url: string) => redirected = url };
}
function protectedEmail(text: string, key = 42) { return key.toString(16) + [...new TextEncoder().encode(text)].map((byte) => (byte ^ key).toString(16).padStart(2, '0')).join(''); }

test('fetched contact pages decode Cloudflare email links and text, leaving malformed bytes alone', async () => {
  const b = nav();
  b.page(`<header class="header"></header><main class="content"><a id="email" href="/cdn-cgi/l/email-protection#${protectedEmail('hello@example.test')}"><span class="__cf_email__" data-cfemail="${protectedEmail('hello@example.test')}">hidden</span></a><a id="bad" href="/cdn-cgi/l/email-protection#00ff"><span class="__cf_email__" data-cfemail="00ff">bad</span></a></main>`);
  b.click('/en/contact/');
  await settle();
  expect(b.document.querySelector('#email').href).toBe('mailto:hello@example.test');
  expect(b.document.querySelector('#email').textContent).toBe('hello@example.test');
  expect(b.document.querySelector('#bad span').textContent).toBe('bad');
  expect(b.assignments).toEqual([]);
});

test('navigation replaces metadata and reruns only the giscus embed with its attributes', async () => {
  const b = nav();
  b.page(`<html><head><meta name="description" content="new"><link rel="canonical" href="https://example.test/en/contact/"></head><body><header class="header"></header><main class="content"><article class="post"><h1>contact</h1><script src="https://giscus.app/client.js" data-repo="example/site" async></script><script>window.unwanted = true</script></article></main></body></html>`);
  b.click('/en/contact/');
  await settle();
  expect(b.document.querySelector('meta[name="description"]').content).toBe('new');
  expect(b.document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  const scripts = b.document.querySelectorAll('.content script');
  expect(scripts).toHaveLength(1);
  expect(scripts[0].getAttribute('data-repo')).toBe('example/site');
  expect(scripts[0].src).toBe('https://giscus.app/client.js');
  expect(b.window.unwanted).toBeUndefined();
});

test('cross-page hashes scroll to decoded IDs, with malformed and absent IDs falling back safely', async () => {
  for (const hash of ['#hello%20world', '#%broken', '#missing']) {
    const b = nav();
    let scrolled = false;
    // DOMParser produces new elements, so observe the element method on its prototype.
    b.window.HTMLElement.prototype.scrollIntoView = function () { scrolled = this.id === 'hello world' || this.id === '%broken'; };
    b.page('<header class="header"></header><main class="content"><h1 id="hello world">Hi</h1><div id="%broken"></div></main>');
    b.click('/en/contact/' + hash);
    await settle();
    expect(scrolled).toBe(hash !== '#missing');
    if (hash === '#missing') expect(b.scrolls.at(-1)).toEqual([0, 0]);
  }
});

test('back navigation follows same-site redirects and replaces the current history entry', async () => {
  const b = nav();
  b.window.location.href = 'https://example.test/en/old/';
  b.redirect('https://example.test/en/new/');
  b.emit(b.window, 'popstate', { state: null });
  await settle();
  expect(b.window.location.pathname).toBe('/en/new/');
  b.window.scrollY = 80;
  b.emit(b.window, 'scroll');
  expect(b.window.history.state.scroll.y).toBe(80);
});

test('incomplete site pages fall back to a full load and aborted requests do not', async () => {
  const b = nav();
  b.page('<main class="content">not a site page</main>');
  b.click('/en/contact/');
  await settle();
  expect(b.assignments).toEqual(['https://example.test/en/contact/']);
  b.context.fetch = async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); };
  b.click('/en/projects/');
  await settle();
  expect(b.assignments).toHaveLength(1);
});

test('navigation remains optional when history or fetch is unavailable and ignores clicks outside links', () => {
  for (const missing of ['fetch', 'history']) {
    const b = browser();
    Object.defineProperty(b.window, missing, { value: undefined, configurable: true });
    b.run('assets/navigation.js');
    expect(b.window.history?.state ?? null).toBeNull();
  }
  const b = nav();
  expect(b.emit(b.document.body, 'click', { button: 0 }).defaultPrevented).toBe(false);
});
