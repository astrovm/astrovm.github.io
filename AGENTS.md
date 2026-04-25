# Repository Guidelines

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

## Approach

- Read before editing. Test before declaring done.
- Prefer small edits over rewrites.
- Reproduce before fixing runtime or external issues.
- Unproven concerns are risks, not bugs. Say so if not reproduced.
- Simplest working solution. No over-engineering, speculative features, or single-use abstractions.

## Coding Style

- Front matter keys: `kebab-case`
- One H1 per file; headings descend sequentially
- TypeScript: 2-space indentation, follow `tsconfig.json`
- Keep templates lean; prefer Hugo partials/shortcodes
- Remove unused imports, variables, parameters, dead branches, and dead functions from edited files.
- All imports at top of file. None inside functions unless strictly required to break circular dependencies.
- Code and comments in English. User-facing strings stay in their original language.

## Output

- Code first. Explain only non-obvious logic.
- No filler, boilerplate, or out-of-scope suggestions.

## Debugging

- Read code before explaining. Prove with direct evidence: failing test, reproduced run, or concrete probe.
- State what you found, where, and the fix. If unclear, say so.

## Verification

- Smallest proof first, then broader checks.
- Use the standard toolchain. Default checks: format, lint (warnings as errors), tests. Skip only with stated reason.
- No "fixed/safe/ready" claims without fresh command output.
- Fix every issue you encounter. There are no pre-existing bugs or errors to ignore.

## Maintenance

- Remove old code when introducing replacements. No backward compatibility shims without explicit authorization.
- Do not preserve feature flags for shipped features or abstractions that serve a single caller.

## Configuration

- Environment variables only for secrets and external credentials.
- Prioritize sane defaults, zero-config, and easy maintenance. Hardcode sensible defaults for internal URLs, ports, and feature flags.
- When adding a dependency, verify the actual latest version from the registry or official source. Never rely on model memory.

## Formatting

- Plain hyphens and straight quotes only. No decorative Unicode. Code output copy-paste safe.

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
4. **Never mix registers** — don't combine formal grammar with slang. If a sentence uses クソ, the verb should be colloquial too (崩壊する → ぶっ壊れる). For Chinese, don't flow directly from slang into a neutral verb without a pause — e.g., don't write 他妈出现了; either add a comma (他妈，出现了...) or restructure the sentence entirely.
5. **Split sentences when the target language needs it** — Spanish and English tolerate long compound sentences. Chinese and Japanese often need them broken into 2-3 shorter ones to sound natural.
6. **Avoid literal calques** — don't translate Spanish structure into the target language. "La parte más divertida de este tipo de laburos empieza" ≠ "The most fun part of doing this kind of gig begins." → "This is where the fun part of these gigs kicks in."
7. **Technical terms stay in English** — `scrypt`, `hashcat`, `exploit`, `brute force`, `CVE`, `AES`, `adb` are not translated. App names, protocol names, and CLI commands are never localized.
8. **Proofread for naturalness** — after translating, re-read each sentence and ask: "Would someone from NYC/Tokyo/Beijing actually say this?" If not, rewrite it.

### Anti-AI patterns (applies to all languages)

AI-generated text has recognizable tells. Any of these in a draft is a red flag — rewrite the sentence.

**Universal**
- No em dashes (—). Use a comma, a period, or restructure the sentence. `"X — which is important — because"` → `"X, which matters because"` or just split into two sentences.
- No AI filler transitions: "furthermore", "moreover", "additionally", "it's worth noting", "in conclusion", "to summarize", "it is important to highlight", "it's important to remember"
- No formulaic openers: don't start multiple paragraphs with the same structure
- Active voice by default. Passive only when the agent genuinely doesn't matter.
- Don't over-explain. If something is obvious from context, cut it.
- Vary sentence length. AI defaults to uniform medium-length sentences. Mix short punchy ones with longer ones.
- No unnatural symmetry. AI loves balanced parallel structures that humans don't naturally write.

**Spanish**
- No: "es importante destacar", "cabe señalar", "en este sentido", "a su vez", "asimismo", "por ende", "no obstante", "en definitiva", "cabe mencionar"
- No: mid-sentence em dash elaborations ("algo —que resulta interesante— porque")

**English**
- No: "delve into", "leverage" (as a verb), "navigate the complexities of", "tap into", "shed light on", "it's worth noting", "this allows us to"
- No: mid-sentence em dash elaborations ("this is key — and often overlooked — because")

**Chinese**
- No rigid 首先/其次/再次/最后 structure for every paragraph
- No: 值得注意的是, 综上所述, 总的来说, 毋庸置疑 — too formal, AI-default
- Avoid overusing 此外, 然而, 因此 as paragraph openers

**Japanese**
- No rigid まず/次に/そして/最後に structure
- Avoid overusing なお, また, さらに, したがって as sentence openers
- Prefer short verb forms: できる not することができる, わかる not 理解することができる

### Narrative Style (applies to all languages)

Narrative posts (walkthroughs, stories, investigations) follow these additional rules:

9. **First person, present tense** — present tense applies to the flow of discovery and action. Framing, retrospective commentary, and essay structure can use past tense where it sounds natural. "I run the command and nothing happens" not "I ran the command and nothing happened." The reader should feel they're there, not reading a report after the fact.
10. **No spoilers — respect the order of discovery** — don't reveal outcomes or conclusions before the narrative reaches them. Structural signposting in technical posts is fine ("the work splits into two phases") — the restriction is about hinting at outcomes before the narrative gets there. If the post ends with "it worked," don't hint at success in the setup. Information appears in the same order it was discovered, not reordered for efficiency.
11. **No repeated explanations** — each concept is explained once, at the point it's first introduced. Don't re-explain something already covered, and don't pre-explain something that will be introduced later. Trust the reader to remember.

## Security

`utils/encrypt-commands.ts` uses AES-256-GCM with PBKDF2 (1M iterations) for terminal command encryption.

## Commits & Pull Requests

- Concise, imperative subjects: `Add social icon overrides`
- Group related changes; add body context for multi-section edits
- PRs: describe change, link issues, note config updates
- Visual changes in `layouts/` or `static/`: attach screenshots
- **Never push without explicit confirmation** — always ask before every `git push`, even if the user just asked to commit
