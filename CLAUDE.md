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
- Languages: English (default) and Spanish
- Content type: "blog" (shows on index)
- Shows 5 posts per page
- Menu configured for both languages with different URLs

## File Organization

- Root config controls site-wide settings and multilingual setup
- Content files use Hugo front matter for metadata
- Static assets in `static/` are served directly
- Custom layouts in `layouts/partials/` extend theme functionality
- Theme assets and configurations are in `themes/terminal/`

## Security Notes

The `utils/encrypt-commands.ts` script uses AES-256-GCM encryption with PBKDF2 key derivation (1M iterations) for the terminal command encryption feature.
