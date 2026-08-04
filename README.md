# astroweb

Simple, modular, statically generated, easily maintainable, and continuously deployed personal website using the Hugo framework.

Currently using the [Terminal theme](https://github.com/panr/hugo-theme-terminal) with some customization.

## Develop / build

```bash
bun install          # xterm (+ webgl) for the floating terminal
hugo server          # or: hugo --minify
```

CI runs the same `bun install --frozen-lockfile` step before Hugo (see `.github/workflows/gh-pages.yml`).
