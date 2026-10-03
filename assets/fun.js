// Things that make the site feel alive: a Buenos Aires clock, the last commit,
// rings to collect, the Konami code, seasons, a hit counter, sounds, a reading
// cat, the lost 404 page and ghost cats of other visitors.
// Add ?today=2026-10-31 to the URL to pretend it is another day.
(function fun() {
  const lang = (document.documentElement.lang || "en").slice(0, 2);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = !window.matchMedia("(pointer: fine)").matches;
  // A plain date means noon that day here, not midnight in London.
  const asked = new URLSearchParams(window.location.search).get("today");
  const pretend = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? `${asked}T12:00` : asked;
  const today = pretend && !Number.isNaN(Date.parse(pretend)) ? new Date(pretend) : new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const dayKey = today.toISOString().slice(0, 10);

  const words = {
    en: {
      clock: (time) => `${time} in Buenos Aires`,
      asleep: "astro is probably asleep",
      commit: (when, repo) => `last commit ${when} in ${repo}`,
      visitor: (n) => `you are visitor #${n}`,
      sound: (on) => `♪ sound: ${on ? "on" : "off"}`,
      gold: (on) => `◯ gold theme: ${on ? "on" : "off"}`,
      unlocked: "100 rings! the cat got a crown, and you got a gold theme",
      konami: "ring rain! don't let the cat touch you",
      ouch: "ouch!",
    },
    es: {
      clock: (time) => `${time} en Buenos Aires`,
      asleep: "astro seguro está durmiendo",
      commit: (when, repo) => `último commit ${when} en ${repo}`,
      visitor: (n) => `sos el visitante #${n}`,
      sound: (on) => `♪ sonido: ${on ? "sí" : "no"}`,
      gold: (on) => `◯ tema dorado: ${on ? "sí" : "no"}`,
      unlocked: "¡100 anillos! el gato ganó una corona y vos un tema dorado",
      konami: "¡lluvia de anillos! que no te toque el gato",
      ouch: "¡auch!",
    },
    ja: {
      clock: (time) => `ブエノスアイレスは${time}`,
      asleep: "astroはたぶん寝てる",
      commit: (when, repo) => `${repo}に最後のコミット：${when}`,
      visitor: (n) => `あなたは${n}人目の訪問者`,
      sound: (on) => `♪ 音：${on ? "オン" : "オフ"}`,
      gold: (on) => `◯ ゴールドテーマ：${on ? "オン" : "オフ"}`,
      unlocked: "リング100個！ネコは王冠を、あなたはゴールドテーマを手に入れた",
      konami: "リングの雨！ネコに触られないで",
      ouch: "いたっ！",
    },
    zh: {
      clock: (time) => `布宜诺斯艾利斯 ${time}`,
      asleep: "astro大概在睡觉",
      commit: (when, repo) => `最近一次提交：${when}，${repo}`,
      visitor: (n) => `你是第${n}位访客`,
      sound: (on) => `♪ 声音：${on ? "开" : "关"}`,
      gold: (on) => `◯ 金色主题：${on ? "开" : "关"}`,
      unlocked: "100个金环！猫咪得到王冠，你得到金色主题",
      konami: "金环雨！别被猫碰到",
      ouch: "哎哟！",
    },
  }[lang] || null;
  const say = words || {};

  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`fun.${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`fun.${key}`, JSON.stringify(value));
      } catch {
        // Private mode: nothing is remembered, which is fine.
      }
    },
  };

  const $ = (selector) => document.querySelector(selector);
  const between = (min, max) => min + Math.random() * (max - min);
  let pointer = null;
  document.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });

  function toast(text) {
    const el = document.createElement("div");
    el.className = "fun-toast";
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  // Sounds, off unless you turn them on.

  let audio = null;
  const sound = {
    on: store.get("sound", false),
    tone(type, notes, volume = 0.06) {
      if (!this.on) {
        return;
      }
      audio = audio || new AudioContext();
      const start = audio.currentTime;
      notes.forEach(([frequency, at, length, slideTo]) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start + at);
        if (slideTo) {
          osc.frequency.linearRampToValueAtTime(slideTo, start + at + length);
        }
        gain.gain.setValueAtTime(volume, start + at);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + at + length);
        osc.connect(gain).connect(audio.destination);
        osc.start(start + at);
        osc.stop(start + at + length);
      });
    },
    ring() {
      this.tone("square", [
        [1319, 0, 0.07],
        [1976, 0.07, 0.25],
      ]);
    },
    meow() {
      this.tone(
        "triangle",
        [
          [520, 0, 0.18, 900],
          [900, 0.18, 0.28, 560],
        ],
        0.1,
      );
    },
    drop() {
      this.tone("square", [
        [1600, 0, 0.06, 1200],
        [1200, 0.06, 0.06, 900],
        [900, 0.12, 0.1, 600],
      ]);
    },
  };
  window.addEventListener("oneko:meow", () => sound.meow());

  // Status line in the header: clock, last commit and rings.

  function statusLine() {
    const status = $("#site-status");
    if (!status || !words) {
      return;
    }
    status.hidden = false;

    const clock = $("#status-clock");
    const tick = () => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(pretend ? today : new Date());
      const hour = Number(parts.find((part) => part.type === "hour").value);
      const minute = parts.find((part) => part.type === "minute").value;
      const time = `${String(hour).padStart(2, "0")}:${minute}`;
      clock.textContent = say.clock(time) + (hour >= 1 && hour < 6 ? ` :: ${say.asleep}` : "");
    };
    tick();
    setInterval(tick, 30000);

    lastCommit();
  }

  async function lastCommit() {
    const el = $("#status-commit");
    let push = null;
    try {
      push = JSON.parse(sessionStorage.getItem("fun.commit"));
    } catch {
      push = null;
    }
    if (!push || Date.now() - push.checked > 10 * 60 * 1000) {
      try {
        const response = await fetch("https://api.github.com/users/astrovm/events/public?per_page=30");
        if (!response.ok) {
          return;
        }
        const event = (await response.json()).find((item) => item.type === "PushEvent");
        if (!event) {
          return;
        }
        push = { repo: event.repo.name, at: event.created_at, checked: Date.now() };
        sessionStorage.setItem("fun.commit", JSON.stringify(push));
      } catch {
        return;
      }
    }
    const minutes = Math.round((Date.parse(push.at) - Date.now()) / 60000);
    const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const when =
      Math.abs(minutes) < 60
        ? relative.format(minutes, "minute")
        : Math.abs(minutes) < 60 * 48
          ? relative.format(Math.round(minutes / 60), "hour")
          : relative.format(Math.round(minutes / 1440), "day");
    const link = document.createElement("a");
    link.href = `https://github.com/${push.repo}`;
    link.textContent = push.repo.replace(/^astrovm\//, "");
    const [before, after] = say.commit(when, "\u0000").split("\u0000");
    el.replaceChildren(before, link, after);
    el.hidden = false;
  }

  // Rings: a few hide on every page each day. Collect them all.

  const rings = {
    total: store.get("rings", 0),
    collected: new Set(store.get("collected", []).filter((id) => id.startsWith(dayKey))),
    unlocked: store.get("unlocked", false),

    show() {
      const count = $("#ring-count");
      if (count) {
        count.textContent = this.total;
        count.parentElement.hidden = false;
      }
    },

    add(n, x, y) {
      this.total = Math.max(0, this.total + n);
      store.set("rings", this.total);
      this.show();
      if (n > 0) {
        sound.ring();
        sparkle(x, y);
      }
      if (!this.unlocked && this.total >= 100) {
        this.unlocked = true;
        store.set("unlocked", true);
        toast(say.unlocked);
        crown();
        goldToggle();
      }
    },

    collect(id) {
      this.collected.add(id);
      store.set("collected", [...this.collected]);
    },
  };

  function seededRandom(seed) {
    let h = 1779033703;
    for (const char of seed) {
      h = Math.imul(h ^ char.charCodeAt(0), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function makeRing(className = "") {
    const ring = document.createElement("span");
    ring.className = `fun-ring ${className}`.trim();
    ring.setAttribute("aria-hidden", "true");
    return ring;
  }

  // Hover with a mouse, tap with a finger.
  function onGrab(ring, grab) {
    let taken = false;
    const take = (event) => {
      if (taken) {
        return;
      }
      taken = true;
      event.preventDefault();
      const rect = ring.getBoundingClientRect();
      grab(rect.left + rect.width / 2, rect.top + rect.height / 2);
      ring.remove();
    };
    ring.addEventListener(touch ? "pointerdown" : "pointerenter", take);
  }

  function sparkle(x, y) {
    for (let i = 0; i < 4; i += 1) {
      const star = document.createElement("span");
      star.className = "fun-sparkle";
      star.textContent = "✦";
      star.style.left = `${x}px`;
      star.style.top = `${y}px`;
      star.style.setProperty("--dx", `${between(-18, 18)}px`);
      star.style.setProperty("--dy", `${between(-22, -6)}px`);
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 600);
    }
  }

  function hideRings() {
    const area = $(".content") || document.body;
    const box = area.getBoundingClientRect();
    const top = box.top + window.scrollY;
    const height = Math.max(400, area.scrollHeight);
    const rand = seededRandom(`${dayKey}${window.location.pathname}`);
    for (let i = 0; i < 5; i += 1) {
      const x = box.left + window.scrollX + rand() * (box.width - 24);
      const y = top + 40 + rand() * (height - 80);
      const id = `${dayKey}:${window.location.pathname}:${i}`;
      if (rings.collected.has(id)) {
        continue;
      }
      const ring = makeRing();
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.body.appendChild(ring);
      onGrab(ring, (cx, cy) => {
        rings.collect(id);
        rings.add(1, cx, cy);
      });
    }
  }

  // Rings that fly or fall on screen for a moment.
  function looseRing(x, y, vx, vy, life) {
    const ring = makeRing("fun-ring-loose");
    document.body.appendChild(ring);
    let px = x;
    let py = y;
    const born = performance.now();
    onGrab(ring, (cx, cy) => rings.add(1, cx, cy));
    const fly = (now) => {
      if (!ring.isConnected) {
        return;
      }
      px += vx;
      py += vy;
      vy += 0.15;
      vx *= 0.99;
      if (py > window.innerHeight - 20 && vy > 0) {
        vy = -vy * 0.6;
      }
      ring.style.left = `${px}px`;
      ring.style.top = `${py}px`;
      if (now - born > life) {
        ring.remove();
        return;
      }
      ring.style.opacity = now - born > life - 800 ? "0.4" : "1";
      requestAnimationFrame(fly);
    };
    requestAnimationFrame(fly);
  }

  function crown() {
    if (window.oneko && rings.unlocked && !seasonalHat) {
      window.oneko.hat("crown");
    }
  }

  // Up up down down left right left right B A.

  function listenForKonami() {
    const code = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
    let at = 0;
    document.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      at = key === code[at] ? at + 1 : key === code[0] ? 1 : 0;
      if (at === code.length) {
        at = 0;
        ringRain();
      }
    });
  }

  let ringModeUntil = 0;
  let lastHit = 0;

  function ringRain() {
    toast(say.konami);
    for (let i = 0; i < 30; i += 1) {
      setTimeout(
        () => looseRing(between(20, window.innerWidth - 20), -20, between(-1, 1), between(1, 3), 6000),
        i * 100,
      );
    }
    ringModeUntil = Date.now() + 20000;
    const check = () => {
      if (Date.now() > ringModeUntil) {
        return;
      }
      if (window.oneko && pointer && Date.now() - lastHit > 2000) {
        const hit = window.oneko.cats().some((cat) => Math.hypot(cat.x - pointer.x, cat.y - pointer.y) < 26);
        if (hit && rings.total > 0) {
          lastHit = Date.now();
          const lost = Math.min(rings.total, 10);
          rings.add(-lost);
          sound.drop();
          toast(say.ouch);
          for (let i = 0; i < lost; i += 1) {
            const angle = (i / lost) * Math.PI * 2;
            looseRing(pointer.x, pointer.y, Math.cos(angle) * 5, Math.sin(angle) * 5 - 3, 2500);
          }
        }
      }
      setTimeout(check, 100);
    };
    check();
  }

  // Seasons and special days.

  let seasonalHat = null;

  function accent(color) {
    document.documentElement.style.setProperty("--accent", color);
  }

  function seasons() {
    const halloween = month === 10 && day === 31;
    const christmas = month === 12 && day === 25;
    const argentina = (month === 5 && day === 25) || (month === 6 && day === 20) || (month === 7 && day === 9);
    const sonicDay = month === 6 && day === 23;

    if (halloween) {
      seasonalHat = "pumpkin";
      accent("#ff8c1a");
      if (!calm) {
        setInterval(bat, 9000);
        setTimeout(bat, 2000);
      }
    }
    if (christmas) {
      seasonalHat = "santa";
      if (!calm) {
        snow();
      }
    }
    if (argentina) {
      accent("#74acdf");
      document.documentElement.classList.add("fun-argentina");
    }
    if (sonicDay && !calm) {
      setTimeout(sonicRun, 3000);
      setInterval(sonicRun, 20000);
    }
    if (seasonalHat && window.oneko) {
      window.oneko.hat(seasonalHat);
    }
  }

  function bat() {
    const el = document.createElement("span");
    el.className = "fun-bat";
    el.setAttribute("aria-hidden", "true");
    const fromLeft = Math.random() < 0.5;
    const y = between(60, window.innerHeight * 0.6);
    el.style.top = `${y}px`;
    el.style.left = fromLeft ? "-30px" : `${window.innerWidth + 30}px`;
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(${fromLeft ? window.innerWidth + 60 : -window.innerWidth - 60}px, ${between(-80, 80)}px)`;
    });
    setTimeout(() => el.remove(), 7000);
  }

  // Snow falls, piles up on the logo and post titles, and the cat knocks it off.
  function snow() {
    const flakes = [];
    const caps = new Map();
    const perches = () => [...document.querySelectorAll(".logo, .post-title")];
    const capFor = (el) => {
      if (!caps.has(el)) {
        const cap = document.createElement("span");
        cap.className = "fun-snowcap";
        document.body.appendChild(cap);
        caps.set(el, { cap, depth: 0 });
      }
      return caps.get(el);
    };
    const frame = () => {
      if (flakes.length < 45 && Math.random() < 0.3) {
        const flake = document.createElement("span");
        flake.className = "fun-flake";
        document.body.appendChild(flake);
        flakes.push({ el: flake, x: between(0, window.innerWidth), y: -10, vy: between(0.6, 1.4), sway: between(0, 6) });
      }
      const rects = perches().map((el) => [el, el.getBoundingClientRect()]);
      const cats = window.oneko ? window.oneko.cats() : [];
      for (let i = flakes.length - 1; i >= 0; i -= 1) {
        const flake = flakes[i];
        flake.y += flake.vy;
        flake.sway += 0.03;
        const x = flake.x + Math.sin(flake.sway) * 12;
        flake.el.style.transform = `translate(${x}px, ${flake.y}px)`;
        let landed = flake.y > window.innerHeight;
        for (const [el, rect] of rects) {
          if (x > rect.left && x < rect.right && Math.abs(flake.y - rect.top) < 1.5) {
            const pile = capFor(el);
            pile.depth = Math.min(10, pile.depth + 0.35);
            landed = true;
          }
        }
        if (landed) {
          flake.el.remove();
          flakes.splice(i, 1);
        }
      }
      for (const [el, rect] of rects) {
        const pile = caps.get(el);
        if (!pile) {
          continue;
        }
        const bumped = cats.some(
          (cat) => cat.x > rect.left - 8 && cat.x < rect.right + 8 && Math.abs(cat.y - rect.top) < 26,
        );
        if (bumped && pile.depth > 2) {
          // Knocked off: let the old cap fall and start a new one.
          const old = pile.cap;
          old.classList.add("fun-snowcap-falling");
          setTimeout(() => old.remove(), 900);
          caps.delete(el);
          continue;
        }
        pile.cap.style.left = `${rect.left + window.scrollX}px`;
        pile.cap.style.top = `${rect.top + window.scrollY - pile.depth}px`;
        pile.cap.style.width = `${rect.width}px`;
        pile.cap.style.height = `${pile.depth}px`;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function sonicRun() {
    const sonic = document.createElement("img");
    sonic.className = "fun-sonic";
    sonic.src = "/apple-touch-icon.png";
    sonic.alt = "";
    const fromLeft = Math.random() < 0.5;
    const y = window.innerHeight - 70;
    let x = fromLeft ? -60 : window.innerWidth + 60;
    sonic.style.top = `${y}px`;
    sonic.style.scale = fromLeft ? "1 1" : "-1 1";
    document.body.appendChild(sonic);
    const speed = (window.innerWidth + 120) / 150;
    const run = () => {
      x += fromLeft ? speed : -speed;
      sonic.style.left = `${x}px`;
      if (x < -80 || x > window.innerWidth + 80) {
        sonic.remove();
        return;
      }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    if (window.oneko) {
      window.oneko.chase(() => (sonic.isConnected ? { x: x + 28, y: y + 40 } : null), 3000);
    }
  }

  // Footer: hit counter, sound and the gold theme.

  async function visitorCount() {
    const el = $("#visitor-count");
    if (!el || !words) {
      return;
    }
    // Count each visit once, then keep showing the same number.
    let number = sessionStorage.getItem("fun.visitor");
    if (!number) {
      try {
        const response = await fetch("https://abacus.jasoncameron.dev/hit/4st.li/visits");
        if (!response.ok) {
          return;
        }
        number = String((await response.json()).value);
        sessionStorage.setItem("fun.visitor", number);
      } catch {
        // The counter is decoration; without it the footer just has the buttons.
        return;
      }
    }
    el.textContent = say.visitor(number.padStart(6, "0"));
    el.hidden = false;
  }

  function soundToggle() {
    const button = $("#sound-toggle");
    if (!button || !words) {
      return;
    }
    const label = () => {
      button.textContent = say.sound(sound.on);
      button.setAttribute("aria-pressed", String(sound.on));
    };
    label();
    button.hidden = false;
    button.addEventListener("click", () => {
      sound.on = !sound.on;
      store.set("sound", sound.on);
      label();
      sound.ring();
    });
  }

  function goldToggle() {
    const button = $("#gold-toggle");
    if (!button || !words || !rings.unlocked) {
      return;
    }
    let on = store.get("gold", false);
    const apply = () => {
      button.textContent = say.gold(on);
      button.setAttribute("aria-pressed", String(on));
      if (on) {
        accent("#ffcc00");
      } else {
        document.documentElement.style.removeProperty("--accent");
        seasonsAccent();
      }
    };
    apply();
    button.hidden = false;
    button.onclick = () => {
      on = !on;
      store.set("gold", on);
      apply();
    };
  }

  function seasonsAccent() {
    if (month === 10 && day === 31) {
      accent("#ff8c1a");
    } else if (document.documentElement.classList.contains("fun-argentina")) {
      accent("#74acdf");
    }
  }

  // A tiny cat runs along the top while you read a post.

  function readingCat() {
    const article = $(".post:not(.on-list):not(.lost-page) .post-content");
    if (!article || calm) {
      return;
    }
    const bar = document.createElement("div");
    bar.className = "fun-progress";
    const kitty = document.createElement("div");
    kitty.className = "fun-progress-cat";
    document.body.append(bar, kitty);
    const frames = { idle: [[-3, -3]], E: [[-3, 0], [-3, -1]], sleeping: [[-2, 0], [-2, -1]] };
    let lastScroll = 0;
    let frame = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const done = max > 0 ? Math.min(1, window.scrollY / max) : 1;
      bar.style.width = `${done * 100}%`;
      kitty.style.left = `${Math.max(0, done * window.innerWidth - 24)}px`;
    };
    window.addEventListener("scroll", () => {
      lastScroll = Date.now();
      update();
    }, { passive: true });
    update();
    setInterval(() => {
      frame += 1;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const finished = window.scrollY >= max - 4;
      const name = finished ? "sleeping" : Date.now() - lastScroll < 300 ? "E" : "idle";
      const set = frames[name];
      const [fx, fy] = set[Math.floor(frame / (name === "sleeping" ? 4 : 1)) % set.length];
      kitty.style.backgroundPosition = `${fx * 32}px ${fy * 32}px`;
    }, 120);
  }

  // The 404 page: the go home button runs away a few times.

  function lostPage() {
    const button = $(".lost-home");
    if (!button) {
      return;
    }
    let dodges = 0;
    const dodge = () => {
      dodges += 1;
      const box = button.parentElement.getBoundingClientRect();
      button.style.transform = `translate(${between(-box.width / 3, box.width / 3)}px, ${between(-40, 60)}px)`;
    };
    if (touch) {
      button.addEventListener("click", (event) => {
        if (dodges < 2) {
          event.preventDefault();
          dodge();
        }
      });
    } else {
      document.addEventListener("pointermove", (event) => {
        if (dodges >= 5) {
          return;
        }
        const rect = button.getBoundingClientRect();
        const near = Math.hypot(event.clientX - (rect.left + rect.width / 2), event.clientY - (rect.top + rect.height / 2));
        if (near < 70) {
          dodge();
        }
      });
    }
    if (window.oneko && !calm) {
      window.oneko.play();
      setInterval(() => window.oneko.play(), 7000);
    }
  }

  // Ghost cats: other people reading the same page right now.

  function ghosts() {
    const url = window.__GHOSTS_URL__;
    if (!url || calm || !("WebSocket" in window)) {
      return;
    }
    const area = () => ($(".container") || document.body).getBoundingClientRect();
    const others = new Map();
    let socket = null;
    let sent = 0;
    let mine = null;

    const connect = () => {
      socket = new WebSocket(`${url}?room=${encodeURIComponent(window.location.pathname)}`);
      socket.addEventListener("message", (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        if (data.gone) {
          const ghost = others.get(data.id);
          if (ghost) {
            ghost.el.remove();
            others.delete(data.id);
          }
          return;
        }
        let ghost = others.get(data.id);
        if (!ghost) {
          if (others.size >= 30) {
            return;
          }
          const el = document.createElement("div");
          el.className = "fun-ghost";
          document.body.appendChild(el);
          ghost = { el, x: null, y: null, tx: 0, ty: 0 };
          others.set(data.id, ghost);
        }
        const box = area();
        ghost.tx = box.left + data.x * box.width;
        ghost.ty = data.y - window.scrollY;
        ghost.docY = data.y;
        ghost.seen = Date.now();
      });
      socket.addEventListener("close", () => setTimeout(connect, 5000));
    };
    connect();

    if (!touch) {
      document.addEventListener("pointermove", (event) => {
        const box = area();
        mine = { x: (event.clientX - box.left) / box.width, y: event.clientY + window.scrollY };
      });
      setInterval(() => {
        if (mine && socket.readyState === WebSocket.OPEN && Date.now() - sent > 150) {
          socket.send(JSON.stringify({ x: Number(mine.x.toFixed(4)), y: Math.round(mine.y) }));
          sent = Date.now();
          mine = null;
        }
      }, 150);
    }

    let frame = 0;
    setInterval(() => {
      frame += 1;
      for (const [id, ghost] of others) {
        if (Date.now() - ghost.seen > 15000) {
          ghost.el.remove();
          others.delete(id);
          continue;
        }
        const ty = ghost.docY - window.scrollY;
        if (ghost.x === null) {
          ghost.x = ghost.tx;
          ghost.y = ty;
        }
        const dx = ghost.tx - ghost.x;
        const dy = ty - ghost.y;
        const distance = Math.hypot(dx, dy);
        let sprite = [-3, -3];
        if (distance > 12) {
          const step = Math.min(10, distance);
          ghost.x += (dx / distance) * step;
          ghost.y += (dy / distance) * step;
          const east = dx > 0;
          sprite = Math.abs(dx) > Math.abs(dy) ? (east ? [-3, frame % 2 ? 0 : -1] : [-4, frame % 2 ? -2 : -3]) : dy > 0 ? [-6, -3] : [-1, -2];
        }
        ghost.el.style.left = `${ghost.x - 16}px`;
        ghost.el.style.top = `${ghost.y - 16}px`;
        ghost.el.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
      }
    }, 100);
  }

  function main() {
    statusLine();
    rings.show();
    if (!calm) {
      hideRings();
    }
    listenForKonami();
    seasons();
    crown();
    visitorCount();
    soundToggle();
    goldToggle();
    readingCat();
    lostPage();
    ghosts();
  }

  // oneko.js loads with defer too; wait for it so hats and chases work.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
