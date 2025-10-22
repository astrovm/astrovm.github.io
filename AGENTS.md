# Repository Guidelines

## Project Structure & Module Organization
The Hugo site configuration lives in `config.toml`, while content pages and blog posts belong in `content/`. Layout overrides and partials are stored in `layouts/`, which take precedence over the Terminal theme inside `themes/terminal/`. Static assets such as images or favicons go in `static/`. Built artifacts land in `public/` and should remain untracked. TypeScript utilities that support shortcodes live under `utils/`.

## Build, Test, and Development Commands
Run `bun install` after pulling to ensure TypeScript definitions stay current. Start a live preview with `hugo server -D`, which watches for changes and includes drafts. Produce an optimized build with `hugo --gc --minify`, cleaning unused resources and writing to `public/`. Use `hugo server --panicOnWarning` before opening a PR to surface broken links or templates.

## Coding Style & Naming Conventions
Author Markdown content with front matter keys in `kebab-case` to match existing pages. Favor short titles and one H1 per file; subsequent headings should descend sequentially. Keep templates lean, using Hugo partials or shortcodes defined in `layouts/partials/`. Format TypeScript helpers with 2-space indentation and align with the project's `tsconfig.json`.

## Testing Guidelines
The project relies on manual verification through Hugo. Before submitting changes, load the site in multiple viewports using `hugo server -D` and review the terminal output for warnings. For structural edits, run `hugo --templateMetrics` to spot unused blocks, and skim the generated HTML in `public/` to confirm data renders as expected.

## Commit & Pull Request Guidelines
Follow the existing log by writing concise, imperative commit subjects (e.g., `Add social icon overrides`). Group related changes per commit and include brief body context when touching multiple sections. Pull requests should describe the change, link any tracked issues, note configuration updates, and attach screenshots for visual tweaks, especially when modifying `layouts/` or `static/` assets.
