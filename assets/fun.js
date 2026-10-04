// Things that make the site feel alive: Buenos Aires time and weather, the
// special days, sounds, reading progress, the lost
// 404 page and ghost cats of other visitors.
// Add ?today=2026-10-31 to the URL to pretend it is another day.
(function fun() {
  const controller = new AbortController();
  const disposers = [];
  const timers = new Set();
  const frames = new Set();
  const setInterval = (fn, delay) => {
    const id = window.setInterval(fn, delay);
    timers.add(id);
    return id;
  };
  const setTimeout = (fn, delay) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      if (!controller.signal.aborted) fn();
    }, delay);
    timers.add(id);
    return id;
  };
  const requestAnimationFrame = (fn) => {
    const id = window.requestAnimationFrame(() => {
      frames.delete(id);
      if (!controller.signal.aborted) fn();
    });
    frames.add(id);
    return id;
  };
  const listen = (target, name, fn, options = {}) =>
    target.addEventListener(name, fn, { ...options, signal: controller.signal });
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
      sound: (on) => `♪ sound: ${on ? "on" : "off"}`,
      back: "back to where you were",
      quote: "copy link",
    },
    es: {
      clock: "hora en Buenos Aires",
      asleep: "astro seguro está durmiendo",
      sound: (on) => `♪ sonido: ${on ? "sí" : "no"}`,
      back: "volver a donde estabas",
      quote: "copiar link",
    },
    ja: {
      clock: "ブエノスアイレスの時刻",
      asleep: "astroはたぶん寝てる",
      sound: (on) => `♪ 音：${on ? "オン" : "オフ"}`,
      back: "読んでいた場所に戻る",
      quote: "リンクをコピー",
    },
    zh: {
      clock: "布宜诺斯艾利斯时间",
      asleep: "astro大概在睡觉",
      sound: (on) => `♪ 声音：${on ? "开" : "关"}`,
      back: "回到刚才读的地方",
      quote: "复制链接",
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
  listen(window, "oneko:meow", () => sound.meow());
  // A low rumble that wobbles, like a purr.
  listen(window, "oneko:purr", () =>
    sound.tone("sawtooth", [0, 0.25, 0.5, 0.75, 1].map((at) => [32, at, 0.2, 26]), 0.05),
  );
  listen(window, "oneko:nom", () =>
    sound.tone("square", [
      [660, 0, 0.08],
      [880, 0.1, 0.12],
    ]),
  );

  // Buenos Aires time and weather next to the menu.

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
          { signal: controller.signal },
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
    if (controller.signal.aborted) return;
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
    // Spring starts on September 21 in Argentina.
    const spring = month === 9 && day >= 21 && day <= 23;

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
    if (spring && !calm) {
      setInterval(petal, 700);
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

  function petal() {
    if (document.hidden) {
      return;
    }
    const el = document.createElement("span");
    el.className = "fun-petal";
    el.setAttribute("aria-hidden", "true");
    const time = between(6, 10);
    el.style.left = `${between(0, window.innerWidth)}px`;
    el.style.setProperty("--drift", `${between(-120, 120)}px`);
    el.style.animationDuration = `${time}s, ${between(0.8, 1.6)}s`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), time * 1000);
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

  // A thin line shows how far through a post you are, with the reading cat on it (oneko.js).
  // The cat helps: it keeps your place, marks where you were when you scroll back up,
  // marks the sections, tells you how much is left and walks over to the next post.
  function readingProgress() {
    const article = window.location.pathname.includes("/blog/") && $(".post:not(.on-list) .post-content");
    if (!article) return;
    const oneko = window.oneko;
    const bar = document.createElement("div");
    bar.className = "fun-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.append(bar);
    disposers.push(() => {
      bar.remove();
      oneko?.guide(null);
    });

    const max = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const done = () => (max() > 0 ? Math.min(1, window.scrollY / max()) : 1);
    const jump = (top) => window.scrollTo({ top, behavior: calm ? "instant" : "smooth" });
    // Where the reading cat sits for a given progress (same as oneko.js).
    const barSpot = (fraction) => ({ x: Math.max(16, Math.min(window.innerWidth - 16, fraction * window.innerWidth - 12)), y: 19 });

    // A paw on the bar marks where you were. Tap it, or the cat, to go back.
    const key = `place.${window.location.pathname}`;
    const saved = store.get(key, null);
    let deepest = done();
    let back = null;
    let waiting = false;
    let farTimer = null;
    let stored = saved;
    const paw = document.createElement("button");
    paw.className = "fun-paw";
    paw.hidden = true;
    paw.setAttribute("aria-label", say.back || "back");
    paw.title = say.back || "";
    document.body.append(paw);
    const goBack = () => {
      if (back === null) return;
      jump(back * max());
      mark(null);
    };
    listen(paw, "click", goBack);

    // At the end, the cat walks over to the next post.
    const next = $(".pagination__buttons a.next") || $(".pagination__buttons a");
    const nextSpot = () => {
      const rect = next.getBoundingClientRect();
      return rect.top > 40 && rect.top < window.innerHeight ? { x: rect.left + Math.min(rect.width / 2, 40), y: rect.top - 14 } : null;
    };
    let pointedNext = false;

    const steer = () => {
      if (waiting && back !== null) oneko?.guide(() => barSpot(back));
      else if (next && done() >= 0.98) oneko?.guide(nextSpot);
      else oneko?.guide(null);
    };
    const mark = (fraction, wait = false) => {
      back = fraction;
      waiting = wait;
      paw.hidden = fraction === null;
      if (fraction !== null) paw.style.left = `${fraction * 100}%`;
      steer();
    };

    // Ticks on the bar for each section. Tap one to jump there.
    const headings = [...article.querySelectorAll("h2, h3")];
    // Without the # anchor link at the end.
    const title = (heading) => [...heading.childNodes].filter((node) => !node.classList?.contains("hanchor")).map((node) => node.textContent).join("").trim();
    const ticks = headings.length < 2 ? [] : headings.map((heading) => {
      const tick = document.createElement("button");
      tick.className = "fun-tick";
      tick.setAttribute("aria-label", title(heading));
      tick.title = title(heading);
      listen(tick, "click", () => jump(heading.getBoundingClientRect().top + window.scrollY - 16));
      document.body.append(tick);
      return tick;
    });
    let section = -1;
    const placeTicks = () => {
      ticks.forEach((tick, i) => {
        const top = headings[i].getBoundingClientRect().top + window.scrollY - 16;
        tick.style.left = `${Math.min(1, Math.max(0, top / (max() || 1))) * 100}%`;
      });
    };

    const update = () => {
      const now = done();
      bar.style.width = `${now * 100}%`;
      deepest = Math.max(deepest, now);
      // Back where the paw is: no need for it anymore.
      if (back !== null && now >= back - 0.02) mark(null);
      // Scrolled way back up: once you stop there a moment, mark where you were.
      window.clearTimeout(farTimer);
      if (back === null && (deepest - now) * max() > window.innerHeight * 1.5) {
        farTimer = setTimeout(() => {
          mark(deepest);
          oneko?.note("you were here");
        }, 1500);
      }
      // Remember the place for next time. Finished posts start over.
      const place = deepest >= 0.95 ? null : Math.round(Math.max(deepest, waiting ? back : 0) * 100) / 100;
      if (place !== stored) {
        stored = place;
        store.set(key, place);
      }
      // Say which section it is when you get to a new one.
      const reached = headings.findLastIndex((heading) => heading.getBoundingClientRect().top < window.innerHeight * 0.3);
      if (ticks.length && reached > section && section !== -1) {
        const name = title(headings[reached]);
        oneko?.note(name.length > 28 ? `${name.slice(0, 27)}…` : name);
      }
      section = Math.max(section, reached, 0);
      if (next && now >= 0.98 && !pointedNext) {
        pointedNext = true;
        setTimeout(() => { if (done() >= 0.98) oneko?.note("read next?"); }, 1200);
      }
      if (now < 0.95) pointedNext = false;
      steer();
    };

    // Tapping the reading cat: back to your place, or how much is left.
    listen(window, "oneko:reader-tap", (event) => {
      event.preventDefault();
      if (back !== null) {
        goBack();
        return;
      }
      if (next && done() >= 0.98) {
        next.click();
        return;
      }
      const minutes = parseInt($(".post-reading-time")?.textContent, 10) || 1;
      const left = Math.ceil(minutes * (1 - done()));
      oneko?.note(done() >= 0.98 ? "all done ♡" : left <= 1 ? "almost done" : `~${left} min left`);
    });

    quoteLinks(article);
    listen(window, "scroll", update, { passive: true });
    listen(window, "resize", () => {
      placeTicks();
      update();
    });
    // Pictures change the page height as they load.
    listen(window, "load", placeTicks);
    placeTicks();
    if (saved > 0.05 && saved < 0.95 && done() < saved - 0.05) {
      mark(saved, true);
      setTimeout(() => { if (waiting) oneko?.note("you were here"); }, 2500);
    }
    update();
  }

  // Select some words in a post and the cat offers a link that opens right at them.
  function quoteLinks(article) {
    const button = document.createElement("button");
    button.className = "fun-quote";
    button.hidden = true;
    button.textContent = say.quote || "copy link";
    document.body.append(button);
    let quote = "";
    let timer = null;
    listen(document, "selectionchange", () => {
      window.clearTimeout(timer);
      timer = setTimeout(() => {
        const selection = document.getSelection();
        quote = selection?.toString().trim() || "";
        const inside = selection?.rangeCount && article.contains(selection.getRangeAt(0).commonAncestorContainer);
        button.hidden = !quote || !inside;
        if (button.hidden) return;
        const rects = selection.getRangeAt(0).getClientRects();
        const rect = rects[rects.length - 1];
        if (!rect) { button.hidden = true; return; }
        button.style.left = `${Math.min(window.innerWidth - 120, Math.max(8, rect.right - 40))}px`;
        button.style.top = `${Math.min(window.innerHeight - 40, rect.bottom + 8)}px`;
      }, 300);
    });
    // The menu button would scroll away from the words, so it just hides.
    listen(window, "scroll", () => (button.hidden = true), { passive: true });
    listen(button, "pointerdown", (event) => event.preventDefault());
    listen(button, "click", async () => {
      const url = `${window.location.origin}${window.location.pathname}#:~:text=${textFragment(quote)}`;
      button.hidden = true;
      try {
        await navigator.clipboard.writeText(url);
        window.oneko?.note("copied ♡");
      } catch {
        window.oneko?.note("couldn't copy (=ↀωↀ=)");
      }
    });
  }

  // A text fragment for the words: the start and end of long quotes is enough.
  function textFragment(text) {
    const encode = (part) => encodeURIComponent(part).replace(/-/g, "%2D");
    const words = text.replace(/\s+/g, " ").split(" ");
    if (words.length > 8) return `${encode(words.slice(0, 4).join(" "))},${encode(words.slice(-4).join(" "))}`;
    if (words.length === 1 && text.length > 40) return `${encode(text.slice(0, 15))},${encode(text.slice(-15))}`;
    return encode(words.join(" "));
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
      listen(document, "pointermove", (event) => {
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

  // A hello for people who open the console.

  function hello() {
    console.log(
      "%c  ∧,,,∧\n ( ̳•·•̳)  hi! the cat takes orders here:\n /    づ♡ oneko.treat(), hunt(), box(), pounce(), nyan(), pspsps(), friend(), play()",
      "color: #f462c6; font: 700 13px/1.5 monospace",
    );
  }

  // Ghost cats: the cats of other people on this page right now, in any language.
  // Each visitor shares where their cat is (as a share of their window) and what it's doing.
  // On articles they sit on the reading bar. Cats that meet say hi or play tag (oneko.js).

  function ghosts() {
    const url = window.__GHOSTS_URL__;
    const oneko = window.oneko;
    if (!url || !oneko?.me || !("WebSocket" in window)) {
      return;
    }
    const others = new Map();
    let socket = null;
    let fails = 0;
    let retry = null;
    let shared = "";
    let sharedAt = 0;
    let cuddledAt = 0;

    const clamp = (n, max) => Math.max(16, Math.min(max - 16, n));
    const spot = (cat) => ({
      x: clamp(cat.x * window.innerWidth, window.innerWidth),
      // Same height as the reading cat in oneko.js.
      y: cat.r ? 19 : clamp(cat.y * window.innerHeight, window.innerHeight),
    });
    const forget = (id) => {
      others.get(id)?.el.remove();
      others.delete(id);
    };
    const nudge = (id, a) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ to: id, a }));
    };
    // Only cats walking around can be visited, not the ones on the reading bar.
    oneko.friends(() => [...others.values()].filter((ghost) => !ghost.cat.h && !ghost.cat.r));

    const hear = (data) => {
      // Without motion we still share our cat, but don't show moving ones.
      if (calm) return;
      if (data.from) {
        const ghost = others.get(data.from);
        const react = { boop: "booped", tag: "tagged", pass: "passed" }[data.a];
        if (ghost && react) oneko[react]?.(ghost);
        return;
      }
      if (data.gone) {
        forget(data.id);
        return;
      }
      // Only cats in the shape we know, in case the relay is older or newer than us.
      if (!Array.isArray(data.s)) return;
      let ghost = others.get(data.id);
      if (!ghost && others.size < 30) {
        const el = document.createElement("div");
        el.className = "fun-ghost";
        el.setAttribute("aria-hidden", "true");
        document.body.appendChild(el);
        ghost = { el, ...spot(data), meet: (a) => nudge(data.id, a) };
        others.set(data.id, ghost);
        if (!data.h && !data.r) setTimeout(() => oneko.noticed(ghost), 1000);
      }
      if (ghost) {
        ghost.cat = data;
        ghost.seen = Date.now();
      }
    };

    const connect = () => {
      retry = null;
      if (socket || document.hidden || controller.signal.aborted) return;
      const ws = new WebSocket(`${url}?v=3&room=${encodeURIComponent(window.location.pathname)}`);
      socket = ws;
      ws.addEventListener("open", () => {
        fails = 0;
        shared = "";
      });
      ws.addEventListener("message", (event) => {
        try {
          hear(JSON.parse(event.data));
        } catch {
          // Not for us.
        }
      });
      ws.addEventListener("close", () => {
        if (socket !== ws) return;
        socket = null;
        others.forEach((_, id) => forget(id));
        // Wait longer after each failure, up to a minute.
        fails += 1;
        if (!document.hidden) retry = setTimeout(connect, Math.min(60000, 2500 * 2 ** fails));
      });
    };
    const leave = () => {
      const ws = socket;
      socket = null;
      ws?.close();
      others.forEach((_, id) => forget(id));
    };
    // Hidden tabs leave the room, so their cats don't sit there forever.
    listen(document, "visibilitychange", () => {
      if (document.hidden) leave();
      else if (!retry) connect();
    });
    disposers.push(() => {
      leave();
      oneko.friends(null);
    });
    connect();

    // Share our cat when it changes, and now and then so others know we're still here.
    setInterval(() => {
      const cat = oneko.me();
      if (!cat?.sprite || socket?.readyState !== WebSocket.OPEN) return;
      const text = JSON.stringify({
        x: Number((cat.x / window.innerWidth).toFixed(3)),
        y: Number((cat.y / window.innerHeight).toFixed(3)),
        s: cat.sprite,
        r: cat.reading ? 1 : 0,
        h: cat.hidden ? 1 : 0,
      });
      if (text === shared && Date.now() - sharedAt < 10000) return;
      socket.send(text);
      shared = text;
      sharedAt = Date.now();
    }, 150);

    setInterval(() => {
      const me = oneko.me();
      for (const [id, ghost] of others) {
        if (Date.now() - ghost.seen > 30000) {
          forget(id);
          continue;
        }
        const to = spot(ghost.cat);
        const dx = to.x - ghost.x;
        const dy = to.y - ghost.y;
        const distance = Math.hypot(dx, dy);
        // Glide there, quicker the farther it is.
        const move = Math.min(distance, Math.max(12, distance / 3));
        if (distance > 0) {
          ghost.x += (dx / distance) * move;
          ghost.y += (dy / distance) * move;
        }
        ghost.el.hidden = Boolean(ghost.cat.h);
        ghost.el.style.left = `${ghost.x - 16}px`;
        ghost.el.style.top = `${ghost.y - 16}px`;
        ghost.el.style.backgroundPosition = `${ghost.cat.s[0] * 32}px ${ghost.cat.s[1] * 32}px`;
        // Reading the same part of an article together.
        if (me?.reading && ghost.cat.r && Math.abs(ghost.x - me.x) < 40 && Date.now() - cuddledAt > 8000) {
          cuddledAt = Date.now();
          oneko.booped(ghost);
        }
      }
    }, 100);
  }

  function main() {
    statusLine();
    seasons();
    soundToggle();
    readingProgress();
    lostPage();
    hello();
    ghosts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main, { once: true, signal: controller.signal });
  } else {
    main();
  }
  window.addEventListener("site:navigate", () => {
    controller.abort();
    audio?.close().catch(() => {});
    timers.forEach((id) => window.clearInterval(id));
    frames.forEach((id) => window.cancelAnimationFrame(id));
    disposers.forEach((dispose) => dispose());
    document.querySelectorAll('[class^="fun-"]:not(.footer-fun)').forEach((el) => el.remove());
    document.documentElement.classList.remove("fun-argentina");
    document.documentElement.style.removeProperty("--accent");
    fun();
  }, { once: true });
})();
