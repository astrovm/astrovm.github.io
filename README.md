# astroweb

Simple, modular, statically generated, easily maintainable, and continuously deployed personal website using the Hugo framework.

Currently using the [Terminal theme](https://github.com/panr/hugo-theme-terminal) with some customization.

## Develop / build

```bash
git submodule update --init --recursive  # get the Terminal theme
bun install                             # xterm (+ webgl) for the floating terminal
hugo server                             # or: hugo --minify
bun run typecheck && bun run test       # utils/ tests, 100% coverage gate
```

CI runs the same `bun install --frozen-lockfile` step before Hugo (see `.github/workflows/gh-pages.yml`).

## Fun stuff

- `assets/oneko.js`: the cat. Same file as on flatpak.4st.li.
- `assets/fun.js`: Buenos Aires time and weather, last commit, special days, sounds, reading cat, 404 and ghost cats.
- Add `?today=2026-10-31` (or `2026-03-03T03:00`) to any page to try another day or time.

### Ghost cats

Other visitors on the same page show up as faded cats. The relay is a Cloudflare Worker in `workers/ghosts`:

```bash
cd workers/ghosts
npx wrangler login
npx wrangler deploy
```

It runs at `wss://ghost-cats.astrolince3811.workers.dev`, set as `ghostsUrl` in `config.toml`. Empty turns them off.

