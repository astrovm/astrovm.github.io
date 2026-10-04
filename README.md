# astroweb

Simple, modular, statically generated, easily maintainable, and continuously deployed personal website using the Hugo framework.

Currently using the [Terminal theme](https://github.com/panr/hugo-theme-terminal) with some customization.

## Develop / build

```bash
git submodule update --init --recursive  # get the Terminal theme
bun install                             # xterm (+ webgl) for the floating terminal
hugo server                             # or: hugo --minify
bun run typecheck && bun run test       # 100% line and function coverage
```

CI runs the same `bun install --frozen-lockfile` step before Hugo (see `.github/workflows/gh-pages.yml`).

## Tests and coverage

`bun run test` enforces 100% line and function coverage. Bun measures `utils/`
and the ghost message helpers. Istanbul measures every browser script in `assets/`
and the ghost relay entry point, including code run in isolated VM browsers.
Each browser and relay file must pass on its own. New browser files start at zero
until tested. The runner also rejects new utils or Worker helpers missing from
both reports. Branch and statement coverage are reported too.

Open `coverage/web/index.html` to see the browser and relay report. The same folder
contains `lcov.info`, `coverage-final.json`, and `coverage-summary.json` for tooling.
Bun also writes `coverage/bun/lcov.info`. CI saves both reports even when the gate fails.

Run one test while working with `bun test tests/navigation.test.ts`. Use
`bun run typecheck` and `bun run test` for the complete checks before pushing.
Tests use synthetic DOM pages, controlled clocks, fake service boundaries and
synthetic encrypted bundles. They do not read posts, secrets, or live visitor data.
Vendored code in `themes/terminal` and `static/genesis/Genesis.js` is outside the gate.

## Fun stuff

- `assets/oneko.js`: the cat. Same file as on flatpak.4st.li. Rub it to make it purr, type `fish` for a treat, `pspsps` to call it or `nyan` for a rainbow run. Open the console for more.
- `assets/fun.js`: Buenos Aires time and weather, last commit, special days, sounds, reading cat, 404 and ghost cats.
- Add `?today=2026-10-31` (or `2026-03-03T03:00`) to any page to try another day or time.

### Ghost cats

Other visitors' cats on the same page show up as faded cats, whatever language they read in. On articles they sit on the reading bar at their spot in the post. Cats that meet boop noses, play tag or pass the yarn. Try `oneko.pass()` in the console when another cat is around.

The reading cat remembers unfinished posts. Tap it to return to your place or see the time left, and drag it along the bar to scroll. A paw marks your place when you look back up, and section ticks jump to headings. Select words to copy a quote link. At the end, the cat points to another post.

The relay is a Cloudflare Worker in `workers/ghosts`. CI deploys it on every push to `main`, before the site, using the `CLOUDFLARE_WORKERS_TOKEN` secret (an **Edit Cloudflare Workers** token for the astro account). When the messages change, bump `VERSION` there and `v=` in `fun.js`. To deploy by hand:

```bash
cd workers/ghosts
npx wrangler login
npx wrangler deploy
```

It runs at `wss://ghost-cats.astrolince3811.workers.dev`, set as `ghostsUrl` in `config.toml`. Empty turns them off.
