# 4st.li

astro's personal website: blog posts, projects, configs and contact. Hugo with the Terminal theme, deployed to GitHub Pages.

## What's here

- `content/`: pages and posts in 4 languages (en, es, ja, zh). Every change goes to all four.
- `layouts/`: overrides of the theme in `themes/terminal` (a git submodule).
- `assets/oneko.js`: the pixel cat. Same file as on flatpak.4st.li (`astrovm/flatpak`, `static/oneko.js`), so copy changes over there.
- `assets/fun.js`: clock, weather, last commit, special days, sounds, reading cat, 404 and ghost cats.
- `static/style.css`: site styles, including the `fun-` classes.
- `workers/ghosts`: Cloudflare Worker that relays ghost cats between visitors.

## Context that looks odd out of context

- **The terminal** (`assets/terminal-window/`) is an easter egg, styled as a "restricted access terminal" for fun. Its commands are encrypted so visitors have to discover them, not to hide anything. `utils/encrypt-commands.ts` builds that file and needs astro's password.
- **The terminal opens whenever the tab title changes.** Typing in the title is part of the game, so no other script should touch `document.title`.
- **The TronLink post** is about recovering a paying client's own wallet, on their own phone, with their consent.
- **The configs pages** are astro's own workstation setup. Security tools like hashcat and nmap are just installed apps.

## Run it

```bash
git submodule update --init --recursive
bun install
hugo server
```

Pages live under the language prefix: `http://localhost:1313/en/`, not `/`.

Add `?today=2026-10-31` (or `2026-03-03T03:00`) to any page to try another day or time.

## Checks

Same as CI (`.github/workflows/test.yml`). Run them before every push:

```bash
bun run typecheck
bun run test   # 100% line and function coverage on utils/
```

## Style

- Comments and copy: short, plain words, like talking to a friend.
- No em dashes.
- The cat talks in English cat-speak on every language.
- Respect `prefers-reduced-motion`.
