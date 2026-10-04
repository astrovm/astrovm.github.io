import { test, expect } from 'bun:test';
import { encryptRomBuffer } from '../utils/encrypt-rom';
import { browser, settle } from './helpers/browser';

function sonic({ icon = true, ready = true } = {}) {
  const b = browser();
  if (icon) b.document.head.innerHTML = '<link rel="icon" href="/favicon.png">';
  const draws: any[] = [];
  b.window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage: (...args: any[]) => draws.push(args) });
  b.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,synthetic-frame';
  const rom = Buffer.from('synthetic test ROM');
  const encrypted = encryptRomBuffer(rom);
  b.context.fetch = async () => ({ arrayBuffer: async () => encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) });
  let started: any;
  b.window.embedGenesis = (options: any) => { started = options; options.cbStarted(); };
  b.window.picoRuntimeReady = ready;
  b.run('assets/sonic-favicon.js');
  const type = (text: string, target = b.document.body) => { for (const key of text) b.emit(target, 'keydown', { key }); };
  const load = async () => {
    b.document.querySelector('script').onload();
    if (!ready) b.window.onPicoReady();
    for (let i = 0; i < 60 && !started; i++) await settle();
    expect(started).toBeDefined();
    expect(new TextDecoder().decode(started.rom)).toBe(rom.toString());
  };
  return { ...b, type, load, draws };
}

test('Sonic ignores form inputs, accepts a rolling keyboard secret and restores the favicon on Escape', async () => {
  const b = sonic();
  for (const tag of ['input', 'textarea', 'select', 'div']) {
    const el = b.document.createElement(tag);
    if (tag === 'div') el.contentEditable = 'true';
    b.document.body.append(el);
    b.type('sonic', el);
  }
  expect(b.document.querySelector('#sonic-fav')).toBeNull();
  b.type('x'.repeat(40) + 'SoNiC');
  expect(b.document.querySelector('#sonic-fav')).not.toBeNull();
  await b.load();
  b.frame(3);
  expect(b.draws).toHaveLength(0);
  b.window.GENESIS_CANVAS = b.document.createElement('canvas');
  b.window.GENESIS_ANIM_FRAME_ID = 999;
  b.frame(4);
  expect(b.draws.length).toBeGreaterThan(0);
  expect(b.document.querySelector('link[rel="icon"]').href).toStartWith('data:image/png');
  b.type('x');
  b.emit(b.document, 'keydown', { key: 'Escape' });
  b.frame();
  expect(b.document.querySelector('#sonic-fav')).toBeNull();
  expect(b.document.querySelector('link[rel="icon"]').href).toBe('https://example.test/favicon.png');
  expect(b.window.GENESIS_GAME_BOOTED).toBe(false);
  b.type('sonic');
  expect(b.document.querySelector('#sonic-fav')).not.toBeNull();
});

test('Sonic creates a missing favicon and waits for the emulator runtime', async () => {
  const b = sonic({ icon: false, ready: false });
  b.type('sonic');
  await b.load();
  expect(b.window.onPicoReady).toBeFunction();
  b.emit(b.document, 'keydown', { key: 'Escape' });
  expect(b.document.querySelector('link[rel="icon"]')).not.toBeNull();
});
