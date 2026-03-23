# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hugo static site with Terminal theme. Personal website with multilingual content (ES canonical, EN/ZH/JA translations). Live at https://4st.li/

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `config.toml` | Hugo site configuration (languages, menus, params) |
| `content/` | Markdown pages and blog posts |
| `content/blog/` | Blog posts (subdirectory per post) |
| `layouts/partials/` | Theme overrides (takes precedence over `themes/terminal/`) |
| `static/` | Static assets (CSS, JS, images, favicons) |
| `themes/terminal/` | Terminal theme (git submodule) |
| `utils/` | TypeScript utilities (encrypt-commands.ts) |
| `public/` | Built output (untracked) |

## Build & Development Commands

```bash
bun install                      # Install TypeScript dependencies
hugo server -D                   # Live preview with drafts
hugo --gc --minify               # Production build
hugo server --panicOnWarning     # Pre-PR validation (catch broken links)
hugo --templateMetrics           # Find unused template blocks
```

## URL Convention

English content lives at `/en/`. After build, GitHub Actions copies `public/en/` → `public/` so English is also at root paths.

- **New English content does NOT need `aliases`** — the copy handles root paths automatically.
- `language.js` detects browser preference and redirects `/{path}` → `/{lang}/{path}`.

## Coding Style

- Front matter keys: `kebab-case`
- One H1 per file; headings descend sequentially
- TypeScript: 2-space indentation, follow `tsconfig.json`
- Keep templates lean; prefer Hugo partials/shortcodes

## Testing

Manual verification via Hugo:
1. Run `hugo server -D` and check multiple viewports
2. Review terminal output for warnings
3. For structural changes, check `public/` HTML output

## Content & Translation Guidelines

### Source Language
**Spanish (`index.es.md`) is canonical** — informal Argentine internet/tech register: voseo (`tenés`, `podés`), short punchy sentences, dry humor, technical jargon mixed with slang. Never formalize.

### Translation Philosophy
Translations must read native, not literal:

| File | Target | Style |
|------|--------|-------|
| `index.es.md` | Argentine Spanish | Informal foro/internet tech (source) |
| `index.en.md` | US English | Casual tech-blog, direct (NYC style) |
| `index.zh.md` | Mainland China | V2EX/Zhihu style, simplified Chinese |
| `index.ja.md` | Japan | Casual tech-blog (だ/である調 OK, prefer katakana loanwords) |

**Rules:**
- Preserve spirit and tone, not word-for-word
- Use local internet idioms, not textbook equivalents
- Find culturally equivalent expressions for slang

## Security

`utils/encrypt-commands.ts` uses AES-256-GCM with PBKDF2 (1M iterations) for terminal command encryption.

## Commits & Pull Requests

- Concise, imperative subjects: `Add social icon overrides`
- Group related changes; add body context for multi-section edits
- PRs: describe change, link issues, note config updates
- Visual changes in `layouts/` or `static/`: attach screenshots