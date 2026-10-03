// Things that make the site feel alive: Buenos Aires time and weather, the
// last commit, special days, sounds, a reading cat, the lost
// 404 page and ghost cats of other visitors.
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

  const words = {
    en: {
      clock: "time in Buenos Aires",
      asleep: "astro is probably asleep",
      commit: (when, repo) => `git: ${repo}, ${when}`,
      sound: (on) => `♪ sound: ${on ? "on" : "off"}`,
    },
    es: {
      clock: "hora en Buenos Aires",
      asleep: "astro seguro está durmiendo",
      commit: (when, repo) => `git: ${repo}, ${when}`,
      sound: (on) => `♪ sonido: ${on ? "sí" : "no"}`,
    },
    ja: {
      clock: "ブエノスアイレスの時刻",
      asleep: "astroはたぶん寝てる",
      commit: (when, repo) => `git: ${repo} ${when}`,
      sound: (on) => `♪ 音：${on ? "オン" : "オフ"}`,
    },
    zh: {
      clock: "布宜诺斯艾利斯时间",
      asleep: "astro大概在睡觉",
      commit: (when, repo) => `git: ${repo} ${when}`,
      sound: (on) => `♪ 声音：${on ? "开" : "关"}`,
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
  // Sounds, off unless you turn them on.

  let audio = null;
  const sound = {
    on: store.get("sound", true),
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
  };
  window.addEventListener("oneko:meow", () => sound.meow());

  // Buenos Aires time and weather next to the menu, and the last commit in the footer.

  function statusLine() {
    const status = $("#site-status");
    if (!status || !words) {
      return;
    }

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
      // Short so it fits next to the menu. The full name is in the tooltip.
      const asleep = hour >= 1 && hour < 6;
      clock.textContent = `${time} BA${asleep ? " 💤" : ""}`;
      clock.title = asleep ? `${say.clock} :: ${say.asleep}` : say.clock;
    };
    tick();
    setInterval(tick, 30000);

    weather();
    lastCommit();
  }

  // Open-Meteo is free and needs no key. Weather codes: https://open-meteo.com/en/docs
  // Each weather has a plain glyph and an emoji. Clicking the icon swaps them.
  function weatherIcon(code, isDay) {
    const text = "\uFE0E";
    if (code <= 1) {
      return isDay ? [`☀${text}`, "☀️"] : [`☾`, "🌙"];
    }
    if (code === 2) {
      return [`⛅${text}`, isDay ? "⛅" : "☁️"];
    }
    if (code === 3) {
      return [`☁${text}`, "☁️"];
    }
    if (code === 45 || code === 48) {
      return ["≋", "🌫️"];
    }
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
      return [`❄${text}`, "❄️"];
    }
    if (code >= 95) {
      return [`⚡${text}`, "⛈️"];
    }
    return [`☂${text}`, "🌧️"];
  }

  async function weather() {
    const el = $("#status-weather");
    let now = null;
    try {
      now = JSON.parse(sessionStorage.getItem("fun.weather"));
    } catch {
      now = null;
    }
    if (!now || now.code === undefined || Date.now() - now.checked > 30 * 60 * 1000) {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=-34.61&longitude=-58.38&current=temperature_2m,weather_code,is_day",
        );
        if (!response.ok) {
          return;
        }
        const { current } = await response.json();
        now = {
          temperature: Math.round(current.temperature_2m),
          code: current.weather_code,
          isDay: current.is_day === 1,
          checked: Date.now(),
        };
        sessionStorage.setItem("fun.weather", JSON.stringify(now));
      } catch {
        return;
      }
    }
    const [glyph, emoji] = weatherIcon(now.code, now.isDay);
    const icon = document.createElement("button");
    icon.type = "button";
    icon.className = "weather-icon";
    const show = () => {
      icon.textContent = store.get("weatherEmoji", false) ? emoji : glyph;
    };
    icon.addEventListener("click", () => {
      store.set("weatherEmoji", !store.get("weatherEmoji", false));
      show();
    });
    show();
    el.replaceChildren(icon, ` ${now.temperature}°C`);
    el.hidden = false;
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
    const relative = new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" });
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

  // Footer: sound.

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
      sound.meow();
    });
  }

  // A tiny cat runs along the top while you read a post.

  function readingCat() {
    // Only on blog posts, not on pages like projects or the 404.
    const article = window.location.pathname.includes("/blog/") && $(".post:not(.on-list) .post-content");
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
      // At the very top it would sit on the neko, so it waits until you scroll.
      kitty.hidden = done < 0.02;
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
    seasons();
    soundToggle();
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
