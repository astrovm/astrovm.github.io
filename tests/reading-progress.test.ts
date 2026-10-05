import { test, expect } from 'bun:test';
import { browserSource, coverage } from './helpers/coverage';
import { runInNewContext } from 'node:vm';

const source = browserSource('assets/fun.js');

type Options = { headings?: [string, number][]; next?: boolean; saved?: number };

function page({ headings = [], next = false, saved }: Options = {}) {
  class Element extends EventTarget {
    className = '';
    style: Record<string, any> = { setProperty() {} };
    hidden = false;
    title = '';
    textContent = '';
    attributes: Record<string, string> = {};
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    remove() { elements.delete(this); }
    click() { this.dispatchEvent(new Event('click')); }
  }
  const elements = new Set<Element>();
  let article = true;
  const window: any = Object.assign(new EventTarget(), {
    location: { origin: 'https://4st.li', pathname: '/en/blog/story/', search: '?today=2026-04-01' },
    innerWidth: 800, innerHeight: 500, scrollY: 0,
    matchMedia: () => ({ matches: true }),
    setInterval: (fn: () => void) => { timers.set(++id, fn); return id; },
    clearInterval: (key: number) => timers.delete(key),
    setTimeout: (fn: () => void) => { timeouts.set(++id, fn); return id; },
    clearTimeout: (key: number) => timeouts.delete(key),
    cancelAnimationFrame() {},
    scrollTo: ({ top }: { top: number }) => scroll(top),
  });
  const scroll = (top: number) => { window.scrollY = top; window.dispatchEvent(new Event('scroll')); };
  const heading = ([text, top]: [string, number]) => ({
    childNodes: [{ textContent: text }, { textContent: '#', classList: { contains: (name: string) => name === 'hanchor' } }],
    getBoundingClientRect: () => ({ top: top - window.scrollY }),
  });
  const content = { querySelectorAll: () => headings.map(heading), contains: () => true };
  const nextLink = Object.assign(new Element(), { getBoundingClientRect: () => ({ top: 300, left: 100, width: 200 }) });
  let selection = '';
  let range = {};
  const document = Object.assign(new EventTarget(), {
    readyState: 'complete',
    documentElement: { lang: 'en', scrollHeight: 1500, classList: { remove() {} }, style: { removeProperty() {} } },
    body: { append: (...els: Element[]) => els.forEach((el) => elements.add(el)) },
    createElement: () => new Element(),
    querySelector: (selector: string) => {
      if (selector.includes('.post:not')) return article ? content : null;
      if (selector === '.post-reading-time') return { textContent: '10 min read (2100 words)' };
      if (selector === '.pagination__buttons a.next' || selector === '.pagination__buttons a') return next ? nextLink : null;
      return null;
    },
    querySelectorAll: () => [...elements],
    getSelection: () => ({
      toString: () => selection, rangeCount: selection ? 1 : 0,
      getRangeAt: () => ({ commonAncestorContainer: {}, getClientRects: () => [{ right: 300, bottom: 200 }], ...range }),
    }),
  });
  const timers = new Map<number, () => void>();
  const timeouts = new Map<number, () => void>();
  let id = 0;
  const notes: string[] = [];
  let guide: null | (() => any) = null;
  window.oneko = { note: (text: string) => notes.push(text), guide: (spot: any) => { guide = spot; } };
  const storage = new Map<string, string>();
  if (saved !== undefined) storage.set('fun.place./en/blog/story/', JSON.stringify(saved));
  const copied: string[] = [];
  const clipboard = { writeText: async (text: string) => { copied.push(text); } };
  runInNewContext(source, { __coverage__: coverage,
    window, document, AbortController, URLSearchParams, Intl, CustomEvent,
    navigator: { clipboard },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    console: { log() {} },
  });
  const find = (name: string) => [...elements].find((el) => el.className === name)!;
  const all = (name: string) => [...elements].filter((el) => el.className === name);
  // Run whatever timeouts are waiting, like time passing.
  const wait = () => { const due = [...timeouts.values()]; timeouts.clear(); due.forEach((fn) => fn()); };
  const tapCat = () => window.dispatchEvent(new CustomEvent('oneko:reader-tap', { cancelable: true }));
  // The text nodes around the selection, to know if a word got cut at either end.
  const select = (text: string, around = { before: ' ', after: ' ' }) => {
    selection = text;
    const start = { nodeType: 3, data: around.before + text };
    const end = { nodeType: 3, data: text + around.after };
    range = { startContainer: start, startOffset: around.before.length, endContainer: end, endOffset: text.length };
    document.dispatchEvent(new Event('selectionchange'));
    wait();
  };
  return { window, document, timers, elements, find, all, scroll, wait, notes, tapCat, select, copied, storage, nextLink,
    clipboard, guide: () => guide?.(),
    navigate: (toArticle: boolean) => { article = toArticle; window.dispatchEvent(new Event('site:navigate')); } };
}

test('article progress draws a line that updates with scroll', () => {
  const b = page();
  b.scroll(500);
  expect(b.find('fun-progress').style.width).toBe('50%');
  expect(b.find('fun-progress-cat')).toBeUndefined();
});

test('SPA navigation removes the old progress bar before adding one new bar', () => {
  const b = page();
  const old = b.find('fun-progress');
  b.navigate(true);
  expect(b.all('fun-progress')).toHaveLength(1);
  expect(b.elements.has(old)).toBe(false);
  b.navigate(false);
  expect(b.elements.size).toBe(0);
});

test('the place is saved, and next time the cat waits there until you tap it', () => {
  const first = page();
  first.scroll(600);
  expect(first.storage.get('fun.place./en/blog/story/')).toBe('0.6');

  const b = page({ saved: 0.6 });
  const paw = b.find('fun-paw');
  expect(paw.hidden).toBe(false);
  expect(paw.style.left).toBe('60%');
  expect(b.guide()).toEqual({ x: 468, y: 19 });
  b.wait();
  expect(b.notes).toContain('you were here');
  b.tapCat();
  expect(b.window.scrollY).toBe(600);
  expect(paw.hidden).toBe(true);
  expect(b.guide()).toBeUndefined();
});

test('finished posts start over next time', () => {
  const b = page();
  b.scroll(600);
  b.scroll(1000);
  expect(b.storage.has('fun.place./en/blog/story/')).toBe(false);
});

test('resuming before the saved-place hint hides the stale hint', () => {
  const b = page({ saved: 0.6 });
  b.tapCat();
  b.wait();
  expect(b.notes).not.toContain('you were here');
});

test('scrolling way back up marks where you were, and the paw takes you back', () => {
  const b = page();
  b.scroll(900);
  b.wait();
  b.scroll(0);
  expect(b.find('fun-paw').hidden).toBe(true);
  b.wait();
  expect(b.find('fun-paw').hidden).toBe(false);
  expect(b.notes).toContain('you were here');
  b.find('fun-paw').click();
  expect(b.window.scrollY).toBe(900);
  expect(b.find('fun-paw').hidden).toBe(true);
});

test('a short look back up is not worth a paw', () => {
  const b = page();
  b.scroll(900);
  b.scroll(700);
  b.scroll(900);
  b.wait();
  expect(b.find('fun-paw').hidden).toBe(true);
});

test('tapping the cat tells how much is left', () => {
  const b = page();
  b.tapCat();
  expect(b.notes.at(-1)).toBe('~10 min left');
  b.scroll(800);
  b.tapCat();
  expect(b.notes.at(-1)).toBe('~2 min left');
  b.scroll(960);
  b.tapCat();
  expect(b.notes.at(-1)).toBe('almost done');
  b.scroll(1000);
  b.tapCat();
  expect(b.notes.at(-1)).toBe('all done ♡');
});

test('article headings do not add section markers or announce sections while scrolling', () => {
  const b = page({ headings: [['Intro', 100], ['Middle', 600], ['Last', 1400]] });
  expect(b.all('fun-tick')).toHaveLength(0);
  for (const top of [300, 600, 1000]) {
    b.scroll(top);
    b.wait();
    expect(b.notes).toEqual([]);
  }
  expect(b.find('fun-progress').style.width).toBe('100%');
  b.navigate(true);
  b.scroll(600);
  b.wait();
  expect(b.all('fun-tick')).toHaveLength(0);
  expect(b.notes).toEqual([]);
});

test('at the end the cat walks to the next post, and a tap opens it', () => {
  const b = page({ next: true });
  let opened = false;
  b.nextLink.addEventListener('click', () => { opened = true; });
  b.scroll(1000);
  expect(b.guide()).toEqual({ x: 140, y: 286 });
  b.wait();
  expect(b.notes).toContain('read next?');
  b.tapCat();
  expect(opened).toBe(true);
  b.scroll(100);
  expect(b.guide()).toBeUndefined();
});

test('selected words get a link that opens the post right at them', async () => {
  const b = page();
  const button = b.find('fun-quote');
  expect(button.hidden).toBe(true);
  b.select('a short quote-like bit');
  expect(button.hidden).toBe(false);
  button.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.copied).toEqual(['https://4st.li/en/blog/story/#:~:text=a%20short%20quote%2Dlike%20bit']);
  expect(button.hidden).toBe(true);
  expect(b.notes).toContain('copied ♡');
});

test('long quotes link by their first and last words', async () => {
  const b = page();
  b.select('one two three four five six seven eight nine ten');
  b.find('fun-quote').click();
  b.select('長'.repeat(50));
  b.find('fun-quote').click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.copied[0]).toEndWith('#:~:text=one%20two%20three%20four,seven%20eight%20nine%20ten');
  expect(b.copied[1]).toEndWith(`#:~:text=${encodeURIComponent('長'.repeat(15))},${encodeURIComponent('長'.repeat(15))}`);
});

test('quotes across paragraphs link by where they start and end', async () => {
  const b = page();
  b.select('Short title\n\nfirst words of the next one');
  b.find('fun-quote').click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.copied[0]).toEndWith('#:~:text=Short%20title,of%20the%20next%20one');
});

test('words cut in half at either end are left out, since links only match whole words', async () => {
  const b = page();
  b.select('ng was a sunny day. I noticed that the C', { before: 'It wa', after: 'D box' });
  b.find('fun-quote').click();
  b.select('ly fine', { before: 'real', after: '.' });
  b.find('fun-quote').click();
  b.select('長'.repeat(5), { before: '長', after: '長' });
  b.find('fun-quote').click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.copied[0]).toEndWith('#:~:text=was%20a%20sunny%20day.%20I%20noticed%20that%20the');
  expect(b.copied[1]).toEndWith('#:~:text=fine');
  expect(b.copied[2]).toEndWith(`#:~:text=${encodeURIComponent('長'.repeat(5))}`);
});

test('Japanese across paragraphs keeps both paragraphs, with nothing to cut', async () => {
  const b = page();
  b.select('長い段落です。\n\n二つめの段落', { before: 'これは', after: 'です' });
  b.find('fun-quote').click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.copied[0]).toEndWith(`#:~:text=${encodeURIComponent('長い段落です。')},${encodeURIComponent('二つめの段落')}`);
});

test('the quote link hides when nothing is selected or the page scrolls', () => {
  const b = page();
  b.select('words');
  b.scroll(10);
  expect(b.find('fun-quote').hidden).toBe(true);
  b.select('');
  expect(b.find('fun-quote').hidden).toBe(true);
});

test('resize updates reading progress and quote presses preserve selection, with copy failures reported', async () => {
  const b = page();
  b.scroll(500);
  b.document.documentElement.scrollHeight = 2000;
  b.window.dispatchEvent(new Event('resize'));
  expect(b.find('fun-progress').style.width).toBe(`${500 / 1500 * 100}%`);
  b.select('selected words');
  const button = b.find('fun-quote');
  const press = new Event('pointerdown', { cancelable: true });
  button.dispatchEvent(press);
  expect(press.defaultPrevented).toBe(true);
  b.clipboard.writeText = async () => { throw new Error('denied'); };
  button.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(b.notes).toContain("couldn't copy (=ↀωↀ=)");
});

test('a selection without visible rectangles cannot place the quote button', () => {
  const b = page();
  b.document.getSelection = () => ({ toString: () => 'words', rangeCount: 1, getRangeAt: () => ({ commonAncestorContainer: {}, getClientRects: () => [] }) }) as any;
  b.document.dispatchEvent(new Event('selectionchange'));
  b.wait();
  expect(b.find('fun-quote').hidden).toBe(true);
});
