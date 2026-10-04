import { test, expect } from 'bun:test';
import { browser } from './helpers/browser';

const playground = '<main><img src="/test.png"><p>little kittens carry words <span class="oneko-word">already wrapped</span></p><p>another paragraph with words</p><a id="install-link">install</a></main>';
function cats(options: any = {}) {
  const b = browser({ width: 400, html: playground, ...options });
  // New wrapped words and effects have layout too, without a real layout engine.
  b.window.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 100, right: 260, top: 100, bottom: 180, width: 160, height: 80 }; };
  for (const el of b.document.querySelectorAll('img')) b.rect(el, { height: 100 });
  const paragraphs = [...b.document.querySelectorAll('p')];
  paragraphs.forEach((el: any, i) => b.rect(el, { top: 200 + 100 * i }));
  if (options.pets !== undefined) b.window.localStorage.setItem('oneko.pets', JSON.stringify(options.pets));
  if (options.seen) b.window.localStorage.setItem('oneko.seen', JSON.stringify(b.now() - options.seen));
  if (options.private) b.context.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  b.run('assets/oneko.js');
  const api = b.window.oneko;
  const cat = () => b.document.querySelector('.oneko-cat');
  const yarn = () => b.document.querySelector('.oneko-yarn');
  const tick = (n = 1) => b.advance(n * 100);
  const move = (x: number, y: number) => b.pointer(b.document, 'mousemove', x, y);
  const drag = (x: number, y: number) => {
    const { x: fromX, y: fromY } = api.cats()[0];
    b.pointer(cat(), 'pointerdown', fromX, fromY);
    b.pointer(cat(), 'pointermove', x, y);
    b.pointer(cat(), 'pointerup', x, y);
  };
  const friend = (x = 260, y = 200) => {
    const el = b.document.createElement('div'); b.document.body.append(el);
    const meetings: string[] = [];
    return { x, y, el, meetings, meet: (action: string) => meetings.push(action) };
  };
  return { ...b, api, cat, yarn, tick, move, drag, friend };
}

test('bites cut visible edges and heal, and pictures can tilt and be shoved back into place', () => {
  for (const random of [0.1, 0.5, 0.9]) {
    const b = cats({ html: '<img>', random });
    const image = b.document.querySelector('img');
    expect(b.api.bite()).toBe(true); b.tick(60);
    expect(image.onekoBites).toHaveLength(1);
    expect(image.style.maskImage).toContain('radial-gradient');
    b.tick(300); expect(image.onekoBites).toHaveLength(0);
    expect(image.style.maskImage).toBe('');
    expect(b.api.knock()).toBe(true); b.tick(60);
    expect(image.style.rotate).toContain('deg');
    b.tick(300); expect(image.style.rotate).toBe('');
    expect(b.api.push()).toBe(true); b.tick(60);
    expect(image.onekoShoved).toBe(true);
    expect(image.style.translate).toContain('-400px');
    b.tick(300); expect(image.onekoShoved).toBe(false);
  }
  const b = cats({ html: '<img>' });
  b.rect(b.document.querySelector('img'), { left: 280, width: 100, height: 100 });
  b.api.push(); b.tick(80);
  expect(b.document.querySelector('img').style.translate).toContain('400px');
});

test('stolen words move with the cat and return after a pet or the healing timer', () => {
  for (const pet of [true, false]) {
    const b = cats();
    expect(b.api.steal()).toBe(true); b.tick(90);
    const loot = b.document.querySelector('.oneko-loot');
    expect(loot).not.toBeNull();
    expect(b.api.steal()).toBe(false);
    const hidden = [...b.document.querySelectorAll('.oneko-word')].find((el: any) => el.style.visibility === 'hidden');
    expect(hidden).toBeDefined();
    if (pet) b.api.pet(); else b.tick(310);
    b.tick(6);
    expect(hidden.style.visibility).toBe('');
    expect(b.document.querySelector('.oneko-loot')).toBeNull();
  }
});

test('perching, peeking, napping, scratching and boxes complete their plans and tidy effects', () => {
  const b = cats();
  expect(b.api.perch()).toBe(true); b.tick(40); b.api.pet();
  expect(b.document.querySelector('.oneko-bubble').textContent).toBe('purr ♡');
  expect(b.api.peek()).toBe(true); b.tick(40);
  expect(b.cat().style.clipPath).toContain('inset');
  b.move(150, 150); expect(b.cat().style.clipPath).toBe('');
  expect(b.api.nap()).toBe(true); b.tick(70);
  expect(b.document.querySelector('.oneko-z')).not.toBeNull();
  b.move(200, 200);
  for (const [x, y] of [[16, 300], [384, 300], [200, 16], [200, 584]]) {
    b.drag(x, y); expect(b.api.scratch()).toBe(true); b.tick(25);
    expect(b.document.querySelector('.oneko-claws')).not.toBeNull();
  }
  b.api.box(); b.tick(220);
  expect(b.document.querySelector('.oneko-box')).toBeNull();
  b.api.box(); b.tick(35); b.api.pet(); b.tick(5);
  expect(b.document.querySelector('.oneko-box')).toBeNull();
  // Removed targets cancel a plan, including its cleanup.
  b.api.peek(); b.document.querySelector('img').remove(); b.tick();
  expect(b.cat().style.clipPath).toBe('');
});

test('pounces reach the pointer and treats are eaten with a sound and removed', () => {
  const b = cats();
  b.move(300, 300); b.api.pounce(); b.tick(35);
  expect(b.api.cats()[0]).toEqual({ x: 300, y: 300 });
  expect(b.cat().style.translate).toBe('');
  let noms = 0; b.window.addEventListener('oneko:nom', () => noms++);
  b.api.treat(); b.tick(55);
  expect(b.document.querySelector('.oneko-fish')).toBeNull(); expect(noms).toBe(1);
  b.api.pspsps(); b.tick(20);
  expect(b.document.querySelector('.oneko-bubble')).not.toBeNull();
  b.api.nyan(); b.tick(8);
  expect(b.document.querySelector('.oneko-rainbow')).not.toBeNull();
  b.api.friend(); b.tick(80); expect(b.api.cats()).toHaveLength(2);
});

test('hunting follows a dodging butterfly, then it flies away', () => {
  for (const random of [0.1, 0.9]) {
    const b = cats({ random });
    expect(b.api.hunt()).toBe(true); expect(b.api.hunt()).toBe(false);
    b.frame(950);
    expect(b.document.querySelector('.oneko-butterfly')).toBeNull();
    expect(b.api.hunt()).toBe(true);
  }
});

test('pets remember milestones, hats, rubs, triple-clicks and returning visits', () => {
  const b = cats({ pets: 99, seen: 7 * 3600000 });
  b.tick(20); expect(b.document.querySelector('.oneko-bubble').textContent).toBe('welcome back ♡');
  b.api.pet(); expect(b.api.pets()).toBe(100);
  expect(b.document.querySelector('.oneko-hat-crown')).not.toBeNull();
  let opened = 0; b.window.activateTerminal = () => opened++;
  b.cat().click(); b.cat().click(); expect(opened).toBe(1);
  b.api.hat('pumpkin'); expect(b.document.querySelector('.oneko-hat-pumpkin')).not.toBeNull();
  b.api.hat(null); expect(b.document.querySelector('.oneko-hat-pumpkin')).toBeNull();
  let purrs = 0; b.window.addEventListener('oneko:purr', () => purrs++);
  b.pointer(b.cat(), 'pointermove', 10, 10);
  for (let i = 0; i < 9; i++) b.pointer(b.cat(), 'pointermove', i % 2 ? 30 : 10, 10);
  expect(purrs).toBe(1); b.tick(5);
  b.emit(b.cat(), 'pointerleave');
  Object.defineProperty(b.document, 'hidden', { value: true, configurable: true }); b.emit(b.document, 'visibilitychange');
  b.tick(120);
  Object.defineProperty(b.document, 'hidden', { value: false, configurable: true }); b.emit(b.document, 'visibilitychange');
  expect(b.document.querySelector('.oneko-bubble').textContent).toBe("you're back! ♡");
  const returning = cats({ pets: 100 }); expect(returning.document.querySelector('.oneko-hat-crown')).not.toBeNull();
});

test('home cats nap until woken by a pet, call or treat, and follow their home after navigation', () => {
  for (const action of ['pet', 'pspsps', 'treat']) {
    const b = cats({ html: '<a data-oneko-home>home</a>', width: 800 });
    const home = b.document.querySelector('[data-oneko-home]');
    b.tick(65);
    expect(b.api.cats()[0]).toEqual({ x: 180, y: 120 });
    expect(b.yarn()).toBeNull(); b.api[action]();
    expect(home.classList.contains('oneko-away')).toBe(true);
    expect(b.yarn()).not.toBeNull();
    b.emit(b.window, 'site:navigate'); b.tick();
    expect(home.classList.contains('oneko-home')).toBe(true);
  }
});

test('quiet articles keep the reader cat at its guide and hide friends and play, with taps asking for help', () => {
  const b = cats({ html: '<article class="post"><div class="post-content">article</div></article>', url: 'https://example.test/en/blog/test/?today=2026-04-01', width: 800 });
  let taps = 0;
  b.window.addEventListener('oneko:reader-tap', (event: any) => { taps++; event.preventDefault(); });
  b.api.pet(); expect(taps).toBe(1); expect(b.api.pets()).toBe(0);
  b.api.guide(() => ({ x: 400, y: 100 })); b.tick(20);
  expect(b.api.cats()[0]).toEqual({ x: 400, y: 100 });
  expect(b.api.me().reading).toBe(false);
  b.api.note('reading help'); expect(b.document.querySelector('.oneko-bubble').textContent).toBe('reading help');
  b.api.guide(null); b.api.friend(); b.tick(20);
  expect(b.document.querySelectorAll('.oneko-cat')[1].hidden).toBe(true);
  const friend = b.friend();
  expect(b.api.visit(friend)).toBe(false); expect(b.api.passed(friend)).toBe(false);
  b.api.booped(friend); b.api.tagged(friend); b.api.noticed(friend);
  b.api.hide(); expect(b.api.me().hidden).toBe(true); b.api.pet();
  b.api.note('hidden'); b.tick(); b.api.show(); expect(b.api.me().hidden).toBe(false);
});

test('keyboard secrets ignore editing fields and work on cat day, late nights and touch pages', () => {
  const b = cats({ url: 'https://example.test/en/?today=2026-08-08' });
  expect(b.api.cats()).toHaveLength(2);
  for (const tag of ['input', 'textarea', 'select', 'div']) {
    const el = b.document.createElement(tag); if (tag === 'div') el.contentEditable = 'true'; b.document.body.append(el);
    for (const key of 'fish') b.emit(el, 'keydown', { key });
  }
  expect(b.document.querySelector('.oneko-fish')).toBeNull();
  for (const text of ['pspsps', 'nyan', 'fish']) for (const key of text) b.emit(b.document.body, 'keydown', { key });
  expect(b.document.querySelector('.oneko-fish')).not.toBeNull();
  const night = cats({ url: 'https://example.test/en/?today=2026-04-01T03:00' });
  night.tick(30); expect(night.document.querySelector('.oneko-bubble').textContent).toBe('*yawn*');
  night.api.pet(); expect(night.document.querySelector('.oneko-bubble').textContent).toContain('go to sleep');
  const phone = cats({ touch: true });
  expect(phone.api.cats()[0]).toEqual({ x: 360, y: 560 });
  phone.pointer(phone.document.body, 'pointerdown', 200, 200, { pointerType: 'touch' }); phone.tick(55);
  expect(Math.hypot(phone.api.cats()[0].x - 200, phone.api.cats()[0].y - 200)).toBeLessThan(12);
  phone.api.play(); phone.frame(800); phone.tick(80);
  expect(phone.yarn().hidden).toBe(true);
});

test('selected text can be swatted, while empty or protected selections are ignored', () => {
  const b = cats({ random: 0.9 });
  let collapsed = false;
  b.document.getSelection = () => ({ isCollapsed: collapsed, toString: () => collapsed ? '' : 'selected words', getRangeAt: () => ({ getClientRects: () => [{ left: 100, right: 260, top: 100, bottom: 140, width: 160, height: 40 }] }) });
  b.emit(b.document, 'selectionchange'); b.tick(45);
  expect(b.api.cats()[0].x).toBe(254);
  collapsed = true; b.emit(b.document, 'selectionchange'); b.tick(10);
  b.api.box(); collapsed = false; b.emit(b.document, 'selectionchange'); b.tick(10);
  expect(b.document.querySelector('.oneko-box')).not.toBeNull();
});

test('visitor cats are noticed, booped, tagged, chased and fled from', () => {
  const b = cats({ random: 0.1 });
  const friend = b.friend();
  b.api.friends(() => [friend]); b.api.noticed(friend); b.tick(70);
  expect(friend.meetings).toContain('tag');
  b.random(0.9); b.api.visit(friend); b.tick(60);
  expect(friend.meetings).toContain('boop');
  b.api.booped(friend); b.tick(12);
  b.api.tagged(friend); b.tick(15); friend.x = 100; friend.y = 100; b.tick(15);
  friend.el.remove(); b.tick(30);
  b.api.chase(() => ({ x: 80, y: 80 }), 2000); b.tick(40);
  expect(b.api.cats()[0]).toEqual({ x: 80, y: 80 });
  b.api.friends(null); expect(b.api.visit()).toBe(false);
});

test('yarn passes to a visitor, returns, marks busy catchers and recovers if nobody sends it back', () => {
  const b = cats({ width: 800 });
  const friend = b.friend(240, 350);
  b.api.friends(() => [friend]);
  expect(b.api.pass()).toBe(true); b.tick(70); b.frame(90);
  expect(friend.meetings).toContain('pass');
  expect(b.api.passed(friend)).toBe(true);
  b.frame(60);
  b.api.pass(); b.tick(60); b.frame(100); b.tick(210); b.frame(50);
  expect(b.yarn().hidden).toBe(false);
  const gone = b.friend(500, 400);
  b.api.friends(() => [gone]); b.api.pass(); b.tick(70); gone.el.remove(); b.frame(80);
  expect(b.yarn().hidden).toBe(false);
  b.api.hide(); expect(b.api.passed(friend)).toBe(false);
  b.api.show();
});

test('mischief chooses each trick when idle and falls back to grooming when a target is missing', () => {
  const choices = [0.08, 0.20, 0.28, 0.38, 0.47, 0.56, 0.65, 0.74, 0.84, 0.91, 0.98];
  for (const roll of choices) {
    const b = cats(); b.tick(12);
    const values = [0, 0.9, roll]; b.random(() => values.length ? values.shift() : 0.5);
    b.tick();
    if (roll === 0.98) {
      expect(b.cat().style.backgroundPosition).toBe('-160px 0px');
    } else {
      b.tick(60);
      const image = b.document.querySelector('img');
      if (roll === 0.08) expect(image.onekoBites).toHaveLength(1);
      if (roll === 0.20) expect(image.style.rotate).not.toBe('');
      if (roll === 0.28) expect(image.onekoShoved).toBe(true);
      if (roll === 0.38) expect(b.document.querySelector('.oneko-loot')).not.toBeNull();
      if (roll === 0.47) expect(b.api.cats()[0]).toEqual({ x: 180, y: 120 });
      if (roll === 0.56) expect(b.document.querySelector('.oneko-claws')).not.toBeNull();
      if (roll === 0.65) expect(b.cat().style.clipPath).not.toBe('');
      if (roll === 0.74) expect(['-64px 0px', '-64px -32px']).toContain(b.cat().style.backgroundPosition);
      if (roll === 0.84) expect(b.document.querySelector('.oneko-butterfly')).not.toBeNull();
      if (roll === 0.91) expect(b.document.querySelector('.oneko-box')).not.toBeNull();
    }
    b.tick(250);
  }
  const empty = cats({ html: '' }); empty.tick(12);
  const values = [0, 0.9, 0.08]; empty.random(() => values.length ? values.shift() : 0.5);
  empty.tick(15);
  expect(empty.api.me().sprite).toHaveLength(2);
  for (const action of ['bite', 'knock', 'push', 'steal', 'perch', 'peek', 'nap', 'pass', 'visit']) expect(empty.api[action]()).toBe(false);
  const night = cats({ url: 'https://example.test/en/?today=2026-04-01T03:00' }); night.tick(12);
  night.random(0.01); night.tick(205); expect(night.api.me().sprite).toHaveLength(2);
});

test('unavailable storage forgets pets gracefully and idle cats pounce at a distant pointer', () => {
  const b = cats({ private: true, html: '' });
  b.api.pet(); expect(b.api.pets()).toBe(0);
  b.tick(30); b.random(0.1); b.move(300, 300); b.tick();
  expect(b.cat().style.translate).toBe('');
  b.tick(40); expect(b.api.cats()[0]).toEqual({ x: 300, y: 300 });
  b.pointer(b.document.body, 'pointerdown', 100, 100);
});

test('hard yarn throws cap their speed, bounce vertically, settle and stay inside after a resize', () => {
  const b = cats({ width: 800 });
  const yarn = b.yarn();
  b.pointer(yarn, 'pointerup', 28, 572);
  b.pointer(yarn, 'pointerdown', 28, 572);
  b.advance(16); b.pointer(yarn, 'pointermove', 600, 100);
  b.pointer(yarn, 'pointerup', 600, 100);
  const start = { x: parseFloat(yarn.style.left), y: parseFloat(yarn.style.top) };
  b.frame();
  expect(Math.hypot(parseFloat(yarn.style.left) - start.x, parseFloat(yarn.style.top) - start.y)).toBeLessThanOrEqual(40.01);
  b.frame(600);
  expect(parseFloat(yarn.style.top)).toBeGreaterThanOrEqual(12);
  expect(parseFloat(yarn.style.top)).toBeLessThanOrEqual(588);
  b.window.innerWidth = 100; b.window.innerHeight = 100; b.emit(b.window, 'resize');
  expect(parseFloat(yarn.style.left)).toBeLessThanOrEqual(88);
  expect(parseFloat(yarn.style.top)).toBeLessThanOrEqual(88);
});

test('a nearby still yarn is batted to a friend and returns automatically if they keep it', () => {
  const b = cats({ width: 800, random: 0.1 });
  const friend = b.friend(300, 200); b.api.friends(() => [friend]);
  const yarn = b.yarn();
  b.pointer(yarn, 'pointerdown', 28, 572);
  b.pointer(yarn, 'pointermove', 40, 40);
  b.advance(100); b.pointer(yarn, 'pointerup', 40, 40);
  b.tick(); b.frame(120);
  expect(friend.meetings).toContain('pass');
  b.tick(210); b.frame(60);
  expect(yarn.hidden).toBe(false);
});

test('a butterfly left alone times out and flies off without its hunting cat', () => {
  const b = cats();
  b.api.hunt(); b.api.pspsps(); b.frame(1300);
  expect(b.document.querySelector('.oneko-butterfly')).toBeNull();
});
