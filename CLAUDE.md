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
**Spanish (`index.es.md`) is canonical** — informal Argentine internet/tech register: voseo (`tenés`, `podés`), short punchy sentences, dry humor, vulgar when appropriate, technical jargon mixed with slang. Never formalize. The Spanish originals contain profanity (`al pedo`, `la verga`, `boludo`, `corchazo`, `guita`) — translations must match that register, not sanitize it.

### Translation Philosophy
Translations are **localizations**, not literal translations. Each version must read as if a native speaker from the target city wrote it directly. A reader should never think "this was translated."

| File | Target locale | Voice & register |
|------|---------------|------------------|
| `index.es.md` | Buenos Aires | Foro/internet tech, voseo, lunfardo OK (source) |
| `index.en.md` | New York City | Casual US tech-blog — direct, blunt, profanity where the original has it ("shit", "what the fuck", "blowing his brains out"). Think HN comment or personal blog, not Medium. |
| `index.zh.md` | Beijing/Shanghai | V2EX/Zhihu style, simplified Chinese — 口语化, internet slang OK (他妈, 牛逼, 白干, 折腾, 碰壁). Avoid literary/academic Chinese (经受住了时间的考验, 毫发无损, 由于, 穷尽). Split long sentences that feel unnatural in Chinese. |
| `index.ja.md` | Tokyo | Casual tech-blog — だ/である調, prefer katakana loanwords (アドバンテージ, ウォールドガーデン). Use colloquial forms (めちゃくちゃ, ヤバい, ぶっ壊れる, トンズラ). Avoid mixing formal vocabulary with slang in the same sentence. |

### Localization rules

1. **Preserve vulgarity level** — if the Spanish says "al pedo" (pointless/for nothing), don't translate to "in vain." Use "for shit" (EN), 全白干了 (ZH), 全部パー (JA).
2. **Use local idioms, not textbook equivalents** — "boludo" → "idiot" (EN), 傻子 (ZH), バカ (JA). Not "fool", not 愚人.
3. **Find culturally equivalent expressions** — Argentine "me pegó un corchazo" (shot himself) → "blew his brains out" (EN), 一枪崩了自己 (ZH), 自分の頭を撃ち抜いた (JA).
4. **Never mix registers** — don't combine formal grammar with slang. If a sentence uses クソ, the verb should be colloquial too (崩壊する → ぶっ壊れる). If Chinese uses 他妈, don't pair it with 出现了 — use 出现了 with a comma pause or restructure.
5. **Split sentences when the target language needs it** — Spanish and English tolerate long compound sentences. Chinese and Japanese often need them broken into 2-3 shorter ones to sound natural.
6. **Avoid literal calques** — don't translate Spanish structure into the target language. "La parte más divertida de este tipo de laburos empieza" ≠ "The most fun part of doing this kind of gig begins." → "This is where the fun part of these gigs kicks in."
7. **Technical terms stay in English** — `scrypt`, `hashcat`, `exploit`, `brute force`, `CVE`, `AES`, `adb` are not translated. App names, protocol names, and CLI commands are never localized.
8. **Proofread for naturalness** — after translating, re-read each sentence and ask: "Would someone from NYC/Tokyo/Beijing actually say this?" If not, rewrite it.

### Narrative Style (applies to all languages)

Narrative posts (walkthroughs, stories, investigations) follow these additional rules:

9. **First person, present tense** — write as if the reader is living the moment alongside the narrator. "I run the command and nothing happens" not "I ran the command and nothing happened." The reader should feel they're there, not reading a report after the fact.
10. **No spoilers — respect the order of discovery** — don't reveal outcomes or conclusions before the narrative reaches them. If the post ends with "it worked," don't hint at success in the setup. Information appears in the same order it was discovered, not reordered for efficiency.
11. **No repeated explanations** — each concept is explained once, at the point it's first introduced. Don't re-explain something already covered, and don't pre-explain something that will be introduced later. Trust the reader to remember.

## Security

`utils/encrypt-commands.ts` uses AES-256-GCM with PBKDF2 (1M iterations) for terminal command encryption.

## Commits & Pull Requests

- Concise, imperative subjects: `Add social icon overrides`
- Group related changes; add body context for multi-section edits
- PRs: describe change, link issues, note config updates
- Visual changes in `layouts/` or `static/`: attach screenshots
- **Never push without explicit confirmation** — always ask before every `git push`, even if the user just asked to commit