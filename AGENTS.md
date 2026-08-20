# AGENTS.md

This file provides guidance to AI coding agents when working with code in this
repository.

Static marketing site for **Claude Atoll**, a macOS menu bar app that lives in a separate repo
(`engels74/claude-atoll`). Astro 6 static output + Svelte 5 islands + UnoCSS, run with Bun,
deployed to GitHub Pages at `claudeatoll.engels74.net`.

## Commands

Bun only (`bun.lock` is committed). Run everything from the repo root.

| Command | Purpose |
| --- | --- |
| `bun install` | Install deps; also runs `prek install` to wire up git hooks. |
| `bun run dev` | Dev server on `http://localhost:4321`. |
| `bun run build` | Static build into `dist/`. **Does not type-check**, despite `README.md`. |
| `bun run check` | `astro check` + `svelte-check`. The only type-check step. |
| `bun run lint` | Biome, read-only. See the `renovate.json` gotcha below. |
| `bun test` | Bun test runner (`src/**/*.test.ts`). |
| `bun test src/placeholder.test.ts` | Single test file. |
| `bun test -t "project builds"` | Single test by name. |
| `SKIP=no-commit-to-branch bunx prek run --all-files --hook-stage manual` | Reproduces the CI job exactly. |

`bun run lint` is safe. `bun run lint:fix` and `bun run format` are not — see below.

## Gotchas

- **Never run `bun run lint:fix` or `bun run format`.** `biome check --write` doubles the blank-line
  block inside every `.astro` frontmatter fence on *every* run (verified: 1 → 2 → 4 → 8 …; the
  ~1030 lines currently in the files are ~10 past runs). Read-only `biome check` does not report or
  fix it. To autofix, run `bunx prek run --all-files --hook-stage manual` instead — its
  `files: \.(js|mjs|ts|json|css|svelte)$` filter excludes `.astro` — or pass explicit non-`.astro`
  paths to `bunx biome check --write`.
- **`.astro` files start with ~1030 blank lines.** Real content begins around line 1025 in
  `src/layouts/Layout.astro` and every `src/components/*.astro` except `Footer.astro`. `head` shows
  nothing; read from line 1020 or read whole. Leave the block alone in unrelated changes — it
  predates the current history and removing it is its own commit.
- **`bun run lint` currently fails on `renovate.json`** (2-space indent vs Biome's tabs). This makes
  `Code Quality` red on `main`, and `deploy.yml` only runs on that workflow's success — so nothing
  is deploying. Pre-existing; don't assume your change caused it.
- **`no-commit-to-branch` blocks direct commits to `main`.** Work on a branch, or set
  `SKIP=no-commit-to-branch` (what the repo's own workflows do) for a deliberate direct commit.
- **The site is dark-only.** `<html class="dark">` is hardcoded in `Layout.astro`, `uno.config.ts`
  sets the body background unconditionally, and `src/` contains zero `dark:` variants. `ThemeToggle`
  flips the class and `localStorage` but no light-mode styles exist; adding a `dark:` variant alone
  produces nothing. Give every component a light base style first.
- **`README.md` is partly stale**: claims Astro 5 (it's Astro 6), claims `bun run build`
  type-checks (it doesn't), and lists a `src/assets/` directory that does not exist. Trust
  `package.json` and the configs.

## Generated files — do not hand-edit

`src/config.ts` and `public/appcast.xml` are rewritten by `.github/workflows/update-appcast.yml`,
triggered by a `repository_dispatch` of type `update-appcast` from the app repo. The workflow
overwrites `src/config.ts` wholesale with `printf`, so any extra export added there is destroyed on
the next release — put site constants in a different module.

Appcast structure lives in `scripts/update-appcast.py` (keeps the 10 newest versions, strips
trailing whitespace so the `trailing-whitespace` / `end-of-file-fixer` hooks stay green). Change it
there, not in the XML.

## Architecture

One page — `src/pages/index.astro` — composes seven `.astro` sections inside
`src/layouts/Layout.astro`, which owns all SEO meta, the anti-FOUC theme script, and the
scroll-reveal `IntersectionObserver`. Astro owns routing and static output; Svelte components exist
only as hydrated islands:

| Island | Directive | Mounted in |
| --- | --- | --- |
| `ThemeToggle.svelte` | `client:load` | `Nav.astro` |
| `DownloadButton.svelte` | `client:visible` | `Hero.astro`, `DownloadCTA.astro` |
| `ScreenshotSlideshow.svelte` | `client:visible` | `Hero.astro` |

`src/pages/api/screenshots.ts` is **not** a runtime API. Output is `static`, so Astro prerenders the
`GET` handler once at build time; it reads `public/screenshots/` from disk and emits
`dist/api/screenshots` as a static JSON array. `ScreenshotSlideshow.svelte` fetches that file and
falls back to a hardcoded four-item list on failure.

To add a screenshot: drop the PNG in `public/screenshots/` with the existing `NNN-kebab-name.png`
prefix (the endpoint sorts by filename, so the prefix is the display order), update the fallback
array in `ScreenshotSlideshow.svelte` to match, and rebuild — the new file is invisible until then.

## Conventions

- **Styling**, in order: an existing `uno.config.ts` shortcut (`card-hover`, `heading-2`,
  `btn-primary`, …) → utility classes → scoped `<style>` using the `--coral` / `--ocean` /
  `--sunset` CSS variables that `uno.config.ts` mirrors into `preflights`. Add a new shortcut only
  when a combination repeats across components; never raw hex.
- **Icons** are pure-CSS classes from `presetIcons` + `@iconify-json/lucide` (`i-lucide-download`).
  No icon components, no SVG imports for UI icons.
- **Svelte 5 runes only** — `$state` / `$derived` / `$effect` / `$props` with a local
  `interface Props`. No stores, no `export let`.
- **Biome formatting**: tabs, single quotes, no trailing commas, 100 columns. Applies to root-level
  `*.json` too (`biome.json` `files.includes` covers `*.json`).
- **Images live in `public/`** and are referenced by absolute path. `astro:assets` is not used and
  `src/assets/` does not exist.

## Reference rules

- `.agents/rules/bun-astro-svelte-pro.md` — Bun/Astro/Svelte 5/UnoCSS stack style guide (hydration
  directive matrix, runes patterns, UnoCSS presets). Read before non-trivial component or config
  work. Two of its sections do not apply here: its "no API routes" rule is contradicted by the
  prerendered `src/pages/api/screenshots.ts`, and its content-collections / path-alias sections
  describe features this repo does not use.
- `.agents/rules/python-314-pro.md` — Python 3.14 style guide. Read only when editing
  `scripts/update-appcast.py`.
- `.pre-commit-config.yaml` — which checks run at commit time vs push/manual stage. Read before
  debugging a hook failure.
