# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website built with Hugo using the Terminal theme. The site is a personal website (astroweb) with bilingual support (English/Spanish) and includes blog posts, projects, contact information, and configurations.

## Architecture

- **Framework**: Hugo static site generator with Terminal theme
- **Structure**: Content-based with multilingual support
- **Theme**: Located in `themes/terminal/` - a Git submodule with terminal/hacker aesthetic
- **Content**: Markdown files in `content/` directory with language-specific versions (.md for English, .es.md for Spanish)
- **Configuration**: Hugo configuration in `config.toml` with multilingual settings
- **Static Assets**: Custom styling, JavaScript, and resources in `static/`

## Key Components

### Content Structure

- `content/blog/` - Blog posts with subdirectories for each post
- `content/` root - Main pages (projects, contact, configs, etc.)
- Bilingual content with `.es.md` extension for Spanish versions

### Theme Customization

- `layouts/partials/` - Custom HTML partials override theme defaults
- `static/style.css` - Custom CSS overriding theme styles
- `static/terminal-window/` - Interactive terminal components with encryption features
- `static/oneko.js` - Desktop pet JavaScript animation

### Special Features

- **Encrypted Commands**: `utils/encrypt-commands.ts` provides multi-password encryption for terminal commands
- **Terminal Theme**: Customized with "astro" color scheme and terminal aesthetic
- **Interactive Elements**: Terminal window simulation and desktop pet

## Development Commands

Since Hugo is not installed locally, development requires:

```bash
# Install Hugo (method depends on system)
# Then run development server:
hugo server -D

# Build static site:
hugo

# Theme development (if needed):
cd themes/terminal/
npm install
```

## Configuration Notes

- Base URL: https://4st.li/
- Theme color: "astro" (custom)
- Languages: Spanish (canonical source), English, Simplified Chinese, Japanese
- Content type: "blog" (shows on index)
- Shows 5 posts per page
- Menu configured for both languages with different URLs

## URL Convention

English lives at `/en/` (same as other languages). Additionally, the GitHub Actions workflow copies the entire `public/en/` directory to `public/` after the build, so all English content is also accessible at root-level paths (e.g. `https://4st.li/blog/slug/` mirrors `/en/blog/slug/`).

**New English content does NOT need `aliases`** — the post-build copy handles root paths automatically.

When a user visits a root-level path (e.g. `/blog/slug/`), `language.js` detects their preferred language and redirects to `/{lang}/blog/slug/`. Without JavaScript, the root path serves English content directly.

## File Organization

- Root config controls site-wide settings and multilingual setup
- Content files use Hugo front matter for metadata
- Static assets in `static/` are served directly
- Custom layouts in `layouts/partials/` extend theme functionality
- Theme assets and configurations are in `themes/terminal/`

## Blog Content Voice

The **Spanish (`index.es.md`) file is always the canonical source** for blog posts. It uses an informal Argentine internet/forum/tech register: voseo, punchy sentences, dry humor, technical and colloquial language mixed.

Translations must NOT be literal. Each version targets a native speaker in a specific city/community:

- **`index.en.md`** — Casual US tech-blog English (think NYC tech community). Direct, slightly informal, no stiff ESL phrasing.
- **`index.zh.md`** — Simplified Chinese for mainland tech readers (V2EX / Zhihu style). Use local internet expressions, not textbook Mandarin.
- **`index.ja.md`** — Casual Japanese tech-blog tone for Tokyo readers. だ/である調 is fine; prefer katakana loanwords for tech terms over obscure native equivalents.

When propagating edits from ES to other languages, adapt the meaning and spirit, not the words. Find the culturally equivalent expression rather than translating literally.

## Security Notes

The `utils/encrypt-commands.ts` script uses AES-256-GCM encryption with PBKDF2 key derivation (1M iterations) for the terminal command encryption feature.
