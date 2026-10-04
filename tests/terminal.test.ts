import { test, expect } from 'bun:test';
import { runInContext } from 'node:vm';
import { randomBytes } from 'node:crypto';
import { encryptBuffer } from '../utils/encrypt-commands';
import { browser, settle } from './helpers/browser';

const html = '<div id="terminal-window"><div class="window-title"><span>terminal</span><div class="window-controls"><button class="close"></button><button class="minimize"></button><button class="maximize"></button></div></div><div id="terminal-content"></div></div><button id="terminal-taskbar"></button>';
function terminal({ lazy = false, webgl = true } = {}) {
  const b = browser({ html });
  b.document.title = 'home';
  b.window.__XTERM__ = { js: '/xterm.js', css: '/xterm.css', webgl: '/webgl.js' };
  const create = b.document.createElement.bind(b.document);
  b.document.createElement = (tag: string) => { const el = create(tag); if (tag === 'script') el.type = 'application/json'; return el; };
  Object.defineProperty(b.document.documentElement, 'clientWidth', { value: 800, writable: true });
  Object.defineProperty(b.document.documentElement, 'clientHeight', { value: 600, writable: true });
  const instances: any[] = [];
  let loss: () => void;
  class Xterm {
    element: any;
    cols = 1; rows = 1;
    writes: string[] = [];
    disposed = false;
    data: (s: string) => void = () => {};
    _core: any = { _renderService: { dimensions: { css: { cell: { width: 8, height: 20 } } } } };
    constructor() { instances.push(this); }
    writeln(s: string) { this.writes.push(s); }
    write(s: string) { this.writes.push(s); }
    clear() { this.writes.push('[clear]'); }
    reset() { this.writes.push('[reset]'); }
    open(content: any) { this.element = b.document.createElement('div'); content.append(this.element); }
    focus() {}
    dispose() { this.disposed = true; }
    onData(fn: any) { this.data = fn; }
    resize(cols: number, rows: number) { this.cols = cols; this.rows = rows; }
    loadAddon() { if (!webgl) throw new Error('no WebGL'); }
  }
  const addon = { disposed: false, dispose() { this.disposed = true; }, onContextLoss(fn: any) { loss = fn; } };
  const install = () => { b.window.Terminal = b.context.Terminal = Xterm; b.context.WebglAddon = { WebglAddon: class { constructor() { return addon; } } }; };
  if (!lazy) install();
  b.run('assets/terminal-window/terminal-window.js');
  b.emit(b.document, 'DOMContentLoaded');
  const open = async () => {
    const first = b.window.activateTerminal();
    const second = b.window.activateTerminal();
    if (lazy && !b.window.Terminal) {
      install();
      b.document.querySelector('script').onload();
      await settle();
      b.document.querySelectorAll('script')[1].onload();
    }
    await Promise.all([first, second]);
    b.advance(0);
  };
  const current = () => instances.at(-1);
  const key = (s: string) => current().data(s);
  const type = (s: string) => { for (const char of s) key(char); };
  const command = async (s: string) => { type(s); key('\r'); await settle(); };
  const output = () => current().writes.join('\n');
  return { ...b, open, key, type, command, output, current, instances, addon, loseContext: () => loss!() };
}

test('terminal loads xterm only when needed, opens once, fits its grid and handles controls', async () => {
  const b = terminal({ lazy: true });
  expect(b.document.querySelector('script')).toBeNull();
  await b.open();
  expect(b.instances).toHaveLength(1);
  expect(b.current().cols).toBe(80);
  expect(b.current().rows).toBe(24);
  expect(b.document.querySelector('#terminal-window').style.width).toBe('640px');
  await b.open();
  expect(b.instances).toHaveLength(1);
  b.document.querySelector('.minimize').click();
  expect(b.document.querySelector('#terminal-taskbar').classList.contains('active')).toBe(true);
  b.document.querySelector('#terminal-taskbar').click();
  b.advance(150);
  expect(b.document.querySelector('#terminal-window').classList.contains('minimized')).toBe(false);
  b.document.querySelector('.maximize').click();
  b.advance(150);
  expect(b.current().cols).toBe(100);
  expect(b.current().rows).toBe(28);
  b.document.querySelector('.maximize').click();
  b.advance(150);
  expect(b.current().cols).toBe(80);
  b.loseContext();
  expect(b.addon.disposed).toBe(true);
  b.document.querySelector('.close').click();
  expect(b.current().disposed).toBe(true);
  expect(b.document.title).toBe('home $');
});

test('terminal title blinks, follows SPA titles, and typed titles open it and run commands', async () => {
  const b = terminal({ webgl: false });
  b.advance(530);
  expect(b.document.title).toBe('home $ _');
  b.advance(530);
  expect(b.document.title).toBe('home $');
  b.emit(b.window, 'site:navigate', { detail: { title: 'contact' } });
  b.emit(b.window, 'site:navigate');
  expect(b.document.title).toBe('contact $');
  b.document.title = 'contact $ help';
  b.advance(100);
  await settle();
  b.advance(0);
  expect(b.output()).toContain('Available commands:');
  expect(b.logs[0][0]).toContain('WebGL not available');
  b.type('cat');
  b.advance(530);
  expect(b.document.title).toContain('contact $ cat');
  b.advance(530);
  b.emit(b.window, 'site:navigate', { detail: { title: 'projects' } });
  b.advance(530);
  expect(b.document.title).toContain('projects $ cat');
});

test('normal editing supports insertion, deletion, cursor movement, history, clear and cancellation', async () => {
  const b = terminal(); await b.open();
  b.key('\r'); b.key('\x7f'); b.key('\x1b[D'); b.key('\x1b[C'); b.key('\x00');
  b.type('hlp'); b.key('\x1b[D'); b.key('\x1b[D'); b.type('e'); b.key('\x1b[C'); b.key('\x1b[C');
  b.key('\r'); await settle();
  expect(b.output()).toContain('Available commands:');
  await b.command('ls');
  b.key('\x1b[A'); expect(b.document.title).toEndWith('ls');
  b.key('\x1b[A'); expect(b.document.title).toEndWith('help');
  b.key('\x1b[A'); b.key('\x1b[B'); expect(b.document.title).toEndWith('ls');
  b.key('\x1b[B'); expect(b.document.title).toEndWith('$');
  b.type('hXelp'); for (let i = 0; i < 3; i++) b.key('\x1b[D'); b.key('\x7f');
  b.key('\x0c'); expect(b.output()).toContain('[reset]');
  expect(b.output()).toEndWith('help');
  b.key('\x03'); expect(b.document.title).toEndWith('$');
  await b.command('clear');
  await b.command('exit');
  expect(b.current().disposed).toBe(true);
});

test('completion lists options, completes single commands and offers command arguments', async () => {
  const b = terminal(); await b.open();
  b.key('\t'); expect(b.output()).toContain('help  clear  exit');
  b.type('he'); b.key('\t'); expect(b.output()).toEndWith('help');
  b.key('\x03');
  b.type('su '); b.key('\t'); expect(b.output()).toContain('root  admin'); b.key('\x03');
  b.type('cat '); b.key('\t'); expect(b.output()).toContain('about.txt  neko.txt  secrets.txt'); b.key('\x03');
  b.type('help '); b.key('\t'); b.type('arg'); b.key('\t'); b.key('\x03');
  b.type('zz'); b.key('\t'); b.key('\x03');
});

test('built-in commands print files, system details and cat responses', async () => {
  const b = terminal(); await b.open();
  for (const name of ['about.txt', 'neko.txt', 'secrets.txt']) await b.command('cat ' + name);
  expect(b.output()).toContain('the cat knows tricks:');
  await b.command('cat'); expect(b.output()).toContain('which file?');
  await b.command('cat missing'); expect(b.output()).toContain('No such file');
  await b.command('sudo make me a sandwich'); expect(b.output()).toContain('[=========]');
  await b.command('sudo other'); expect(b.output()).toContain('not in the sudoers file');
  await b.command('neofetch'); expect(b.output()).toContain('Cats: 0');
  await b.command('pet'); expect(b.output()).toContain('no cat here');
  let pets = 0;
  b.window.oneko = { pet: () => pets++, cats: () => [{}, {}] };
  await b.command('pet'); expect(pets).toBe(1);
  await b.command('neofetch'); expect(b.output()).toContain('Cats: 2');
});

function bundle(entries: [string, string][]) {
  const salt = randomBytes(32), iv = randomBytes(16);
  const parts = entries.map(([password, source]) => {
    const { encrypted, authTag } = encryptBuffer(Buffer.from(source), password, salt, iv);
    const size = Buffer.alloc(4); size.writeUInt32BE(encrypted.length);
    return Buffer.concat([size, encrypted, authTag]);
  });
  const data = Buffer.concat([salt, iv, ...parts]);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.length);
}
let syntheticBundle: ArrayBuffer;
function secrets() {
  return syntheticBundle ||= bundle([
    ['other', "terminal.print('different payload');"],
    ['secret', "commands.secret = (args) => { terminal.print('synthetic secret'); terminal.minimize(); terminal.restore(); terminal.maximize(); if (args[0] === 'explicit') terminal.prompt(); };"],
    ['su:test:pass', "terminal.print('synthetic login'); commands.added = () => terminal.print('added');"],
  ]);
}
async function waitForOutput(b: ReturnType<typeof terminal>, text: string) {
  for (let i = 0; i < 500 && !b.output().includes(text); i++) await settle();
  expect(b.output()).toContain(text);
}

test('password editing stays masked and synthetic bundles unlock only matching commands and logins', async () => {
  const b = terminal(); await b.open();
  const data = secrets();
  b.context.fetch = async () => ({ ok: true, arrayBuffer: async () => data });
  await b.command('secret');
  await waitForOutput(b, 'synthetic secret');
  expect(b.document.querySelector('#terminal-window').classList.contains('maximized')).toBe(true);
  await b.command('secret explicit');
  await b.command('su test');
  b.advance(530);
  b.key('\t'); b.key('\x00'); b.key('\x1b[D'); b.key('\x1b[C'); b.key('\x7f');
  b.type('pXss'); b.key('\x1b[D'); b.key('\x1b[D'); b.key('\x7f'); b.type('a'); b.key('\x1b[C'); b.key('\x1b[C'); b.key('\r');
  await waitForOutput(b, 'synthetic login');
  expect(b.output()).toContain('Access granted for user test');
  await b.command('added'); expect(b.output()).toContain('added');
  await b.command('other'); await waitForOutput(b, 'Command not found: other');
  expect(b.output()).toContain('different payload');
});

test('authentication reports network, wrong-password and unexpected failures and can be cancelled', async () => {
  const b = terminal(); await b.open();
  await b.command('su'); b.type('cancel'); b.key('\x03');
  expect(b.document.title).toEndWith('$');
  b.context.fetch = async () => ({ ok: false, status: 503 });
  await b.command('su'); await b.command('pass');
  expect(b.output()).toContain('Could not load secret commands');
  await b.command('unknown'); expect(b.output()).toContain('Command not found: unknown');
  b.context.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(48) });
  await b.command('su'); await b.command('wrong');
  await waitForOutput(b, 'Authentication failure for user root');
  b.context.fetch = async () => { throw new Error('offline'); };
  await b.command('su'); await b.command('pass');
  expect(b.output()).toContain('Unknown error occurred');
  await b.command('unknown'); expect(b.output()).toContain('Command not found: unknown');
});

test('window drag, viewport limits and lifecycle cleanup use measured cell sizes', async () => {
  const b = terminal(); await b.open();
  const elem = b.document.querySelector('#terminal-window');
  const title = b.document.querySelector('.window-title');
  b.pointer(title, 'mousedown', 110, 110);
  b.pointer(b.document, 'mousemove', 210, 220);
  expect(elem.style.left).toBe('200px'); expect(elem.style.top).toBe('210px');
  b.emit(b.document, 'mouseup');
  expect(elem.classList.contains('dragging')).toBe(false);
  b.pointer(title.querySelector('span'), 'mousedown', 110, 110);
  b.emit(b.window, 'resize'); b.advance(150); b.emit(b.document, 'mouseup');
  b.document.querySelector('.maximize').click();
  b.pointer(title, 'mousedown', 100, 100);
  expect(elem.classList.contains('dragging')).toBe(false);
  b.document.querySelector('.maximize').click(); b.advance(150);
  b.rect(elem, { left: -1 }); b.emit(b.window, 'resize'); b.advance(150);
  expect(elem.style.left).toBe('50%');
  b.current()._core = {}; b.emit(b.window, 'resize'); b.advance(150);
  b.current()._core = { _renderService: { dimensions: { css: { cell: { width: 10000, height: 10000 } } } } };
  b.emit(b.window, 'resize'); b.advance(150);
  expect(b.current().cols).toBe(80);
  // Exercise the standalone state lifecycle with a registered resize callback.
  const result = runInContext(`(() => { const state = new TerminalState(); const ui = new TerminalUI(state); const missing = ui.proposeTerminalSize(0); state.resizeHandler = () => {}; state.cleanup(); return missing; })()`, b.context);
  expect(result).toBeNull();
  b.document.querySelector('.close').click();
});
