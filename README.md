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
