import { test, expect } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { browserSource, coverage } from './helpers/coverage';
import { browser, settle } from './helpers/browser';

test('language redirects prefer a valid cookie, then the browser, then English', () => {
  const redirect = (path: string, cookie: string, language?: string) => {
    let destination = '';
    const document = { cookie };
    const context: any = { __coverage__: coverage, document, navigator: { language }, window: { location: { pathname: path, replace: (url: string) => destination = url } } };
    runInNewContext(browserSource('assets/language.js') + "; setLanguage('ja'); setLanguage('nope')", context);
    expect(document.cookie).toStartWith('preferredLanguage=ja;');
    return destination;
  };
  expect(redirect('/contact/', 'other=yes; preferredLanguage=es', 'ja-JP')).toBe('/es/contact/');
  expect(redirect('/projects/', 'preferredLanguage=invalid', 'zh-CN')).toBe('/zh/projects/');
  expect(redirect('/', '', 'fr-FR')).toBe('/en/');
  expect(redirect('/', '')).toBe('/en/');
  for (const path of ['/en', '/es/', '/ja/contact/', '/zh/']) expect(redirect(path, '', 'en')).toBe('');
});

const controls = `<div class="container"><div class="menu"><button class="menu__trigger">menu</button><div class="menu__dropdown">links</div></div><div class="menu"><button class="menu__trigger">languages</button><div class="menu__dropdown">languages</div></div><div class="menu"></div></div><div class="highlight"><div class="chroma"><code data-lang="js">example code</code></div></div><code data-lang="sh" class="chroma"></code>`;

test('menus close each other, stay open for dropdown clicks, and close on resize or outside clicks', () => {
  const b = browser({ html: controls });
  b.rect(b.document.querySelector('.container'), { left: 0, width: 300 });
  const menus = [...b.document.querySelectorAll('.menu')];
  b.rect(menus[0].querySelector('.menu__dropdown'), { left: 250, width: 100 });
  b.run('assets/page.js');
  menus[0].querySelector('button').click();
  expect(menus[0].classList.contains('open')).toBe(true);
  expect(menus[0].querySelector('.menu__dropdown').style.right).toBe('0px');
  menus[0].querySelector('.menu__dropdown').click();
  expect(menus[0].classList.contains('open')).toBe(true);
  menus[1].querySelector('button').click();
  expect(menus[0].classList.contains('open')).toBe(false);
  expect(menus[1].classList.contains('open')).toBe(true);
  b.emit(b.window, 'resize');
  expect(menus[1].classList.contains('open')).toBe(false);
  menus[0].querySelector('button').click();
  b.document.body.click();
  expect(menus[0].classList.contains('open')).toBe(false);
  b.emit(b.window, 'site:navigate');
  menus[0].querySelector('button').click();
  expect(menus[0].classList.contains('open')).toBe(true);
  expect(b.document.querySelectorAll('.code-title')).toHaveLength(1);
});

test('code copy reports success and failure and resets its label', async () => {
  const b = browser({ html: controls });
  const copied: string[] = [];
  let fail = false;
  b.window.navigator.clipboard.writeText = async (text: string) => { if (fail) throw new Error('denied'); copied.push(text); };
  b.run('assets/page.js');
  const button = b.document.querySelector('.copy-button');
  button.click();
  await settle();
  expect(copied).toEqual(['example code']);
  expect(button.textContent).toBe('Copied');
  b.advance(1000);
  expect(button.textContent).toBe('Copy');
  fail = true;
  button.click();
  await settle();
  expect(button.textContent).toBe('Copy failed');
});

test('code labels still work when clipboard is unavailable', () => {
  const b = browser({ html: controls });
  Object.defineProperty(b.window.navigator, 'clipboard', { value: undefined });
  b.run('assets/page.js');
  expect(b.document.querySelector('.code-title').textContent).toBe('js');
  expect(b.document.querySelector('.copy-button')).toBeNull();
});

const donation = '<div class="monero-donation"><button hidden class="monero-donation__copy" data-copied="copied" data-failed="failed">copy</button><span class="monero-donation__address">  example-address  </span><span class="monero-donation__status"></span></div>';
test('donation copy trims the address, reports failures and rebinds once after navigation', async () => {
  const b = browser({ html: donation });
  const copied: string[] = [];
  let fail = false;
  b.window.navigator.clipboard.writeText = async (text: string) => { if (fail) throw new Error('denied'); copied.push(text); };
  b.run('assets/monero-donation.js');
  const button = b.document.querySelector('button');
  const status = b.document.querySelector('.monero-donation__status');
  expect(button.hidden).toBe(false);
  b.emit(b.window, 'site:navigate');
  button.click();
  await settle();
  expect(copied).toEqual(['example-address']);
  expect(status.textContent).toBe('copied');
  fail = true;
  button.click();
  expect(status.textContent).toBe('');
  await settle();
  expect(status.textContent).toBe('failed');
});

test('donation copy stays hidden without clipboard access', () => {
  const b = browser({ html: donation });
  Object.defineProperty(b.window.navigator, 'clipboard', { value: undefined });
  b.run('assets/monero-donation.js');
  expect(b.document.querySelector('button').hidden).toBe(true);
});

test('WebMCP registers and runs site tools, and aborts them when leaving', () => {
  const tools: any[] = [];
  let signal: AbortSignal;
  const b = browser();
  b.window.navigator.modelContext = { registerTool: (tool: any, options: any) => { tools.push(tool); signal = options.signal; } };
  const actions: string[] = [];
  b.window.oneko = Object.fromEntries(['pet', 'treat', 'play', 'hunt', 'box', 'nyan', 'pspsps'].map((name) => [name, () => actions.push(name)]));
  b.run('assets/webmcp.js');
  const execute = (name: string, args = {}) => tools.find((tool) => tool.name === name).execute(args);
  expect(execute('list_pages').pages).toContain('/projects/');
  expect(execute('get_site_info').site).toBe('4st.li');
  expect(execute('navigate', { path: '/en/projects/' })).toEqual({ navigated: '/en/projects/' });
  for (const action of ['pet', 'treat', 'yarn', 'hunt', 'box', 'nyan', 'call']) expect(execute('play_with_cat', { action })).toEqual({ played: action });
  expect(actions).toEqual(['pet', 'treat', 'play', 'hunt', 'box', 'nyan', 'pspsps']);
  expect(execute('play_with_cat', { action: 'unknown' })).toEqual({ played: false });
  delete b.window.oneko;
  expect(execute('play_with_cat', { action: 'pet' })).toEqual({ played: false });
  b.emit(b.window, 'beforeunload');
  expect(signal!.aborted).toBe(true);
});

test('WebMCP handles unavailable APIs and registration errors', () => {
  runInNewContext(browserSource('assets/webmcp.js'), { __coverage__: coverage });
  const b = browser();
  b.run('assets/webmcp.js');
  b.window.navigator.modelContext = { registerTool: () => { throw new Error('unsupported'); } };
  b.run('assets/webmcp.js');
  expect(b.logs).toHaveLength(4);
});
