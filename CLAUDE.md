# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Static marketing site for **Claude Atoll**, a macOS menu bar app that lives in a separate repository
(`engels74/claude-atoll`). Astro 6 static output + Svelte 5 islands + UnoCSS, run with Bun, deployed
to GitHub Pages at `claudeatoll.engels74.net`.

## Essential Commands

Bun is the only supported package manager (`bun.lock` is committed). Run everything from the repo root.

| Command | Purpose |
| --- | --- |
| `bun install` | Install deps. Also runs `prek install`, wiring up the git hooks. |
| `bun run dev` | Dev server on `http://localhost:4321`. |
| `bun run build` | Static build into `dist/`. **Does not type-check** despite what `README.md` says. |
| `bun run preview` | Serve the built `dist/`. |
| `bun run check` | `astro check` + `svelte-check`. This is the only type-check step. |
| `bun run lint` / `bun run lint:fix` | Biome check / autofix. |
| `bun test` | Bun's test runner (`src/**/*.test.ts`). |
| `bun test src/placeholder.test.ts` | Single test file. |
| `bun test -t "project builds"` | Filter by test name. |
| `bunx prek run --all-files --hook-stage manual` | Reproduces the CI job exactly. |

The `prek` command is the full pre-push gate: Biome (`--write`, so it rewrites files in place),
`bun run check`, and `bun test`. Use it before pushing; use `bun run lint` + `bun run check` for
fast iteration.

## Architecture Overview

One page, `src/pages/index.astro`, composes seven `.astro` section components inside
`src/layouts/Layout.astro` (all SEO meta, the anti-FOUC theme script, and the scroll-reveal
`IntersectionObserver` live in the layout). Everything is static HTML except four hydrated islands:

| Island | Directive | Where |
| --- | --- | --- |
| `ThemeToggle.svelte` | `client:load` | `Nav.astro` |
| `DownloadButton.svelte` | `client:visible` | `Hero.astro`, `DownloadCTA.astro` |
| `ScreenshotSlideshow.svelte` | `client:visible` | `Hero.astro` |

`src/pages/api/screenshots.ts` is **not** a runtime API. The build is `output: "static"`, so Astro
prerenders the `GET` handler once at build time; it reads `public/screenshots/` from disk and emits
`dist/api/screenshots` as a static JSON array. `ScreenshotSlideshow.svelte` fetches that file at
runtime and falls back to a hardcoded four-item list if the fetch fails.

Deployment is chained, not direct: `code-quality.yml` runs on push to `main`, and `deploy.yml`
triggers on that workflow's *successful completion* (`workflow_run`) to build and publish `dist/`
via `peaceiris/actions-gh-pages`. A red `Code Quality` run means nothing deploys.

## Generated Files — Do Not Hand-Edit

`src/config.ts` and `public/appcast.xml` are both rewritten by `.github/workflows/update-appcast.yml`,
which fires on a `repository_dispatch` of type `update-appcast` sent from the app repository. The
workflow overwrites `src/config.ts` wholesale with a `printf` heredoc, so any extra export added
there is silently destroyed on the next release. Put site constants somewhere else.

`scripts/update-appcast.py` builds the Sparkle appcast item, keeps the 10 most recent versions, and
strips trailing whitespace so the `trailing-whitespace` / `end-of-file-fixer` hooks stay green. Change
appcast structure there, not in the XML.

## Common Change Workflows

**Adding a screenshot to the slideshow**

1. Add the PNG to `public/screenshots/` using the existing `NNN-kebab-name.png` prefix — the endpoint
   sorts by filename, so the prefix determines display order.
2. Update the fallback array in `src/components/ScreenshotSlideshow.svelte` to match; it is only used
   when the fetch fails, but a stale list will silently show the wrong set.
3. Rebuild — `dist/api/screenshots` is generated at build time, so a new file is invisible until then.

**Adding a new page section**

1. Create `src/components/<Name>.astro`; ship no `client:*` directive unless it genuinely needs JS.
2. Import and place it in `src/pages/index.astro`.
3. Use the UnoCSS shortcuts and theme colors from `uno.config.ts` (`card-hover`, `heading-2`,
   `btn-primary`, `coral`, `ocean`, `sunset`, `notch-black`, …) rather than raw hex values; the same
   palette is duplicated as CSS variables in the `preflights` block for use inside `<style>` blocks.

## Repository Conventions

- **Styling order of preference:** existing `uno.config.ts` shortcut → utility classes → scoped
  `<style>` block using the `--coral` / `--ocean` / `--sunset` CSS variables. Add a new shortcut to
  `uno.config.ts` only when a combination repeats across components.
- **Icons** come from `presetIcons` + `@iconify-json/lucide` as pure-CSS classes (`i-lucide-github`,
  `i-lucide-download`). No icon components, no SVG imports for UI icons.
- **Svelte 5 runes only** — `$state` / `$derived` / `$effect` / `$props` with a local `interface Props`.
  There are no Svelte stores and no `export let` in this repo.
- **Formatting is Biome with tabs**, single quotes, no trailing commas, 100-column lines. This applies
  to root-level `*.json` too (`biome.json` `files.includes` covers `*.json`).
- **Images live in `public/`**, not `src/assets/`, and are referenced by absolute path. `astro:assets`
  is not used anywhere; `src/assets/` does not exist despite the `README.md` tree.

## Critical Gotchas

- **`.astro` files start with ~1020 blank lines inside the frontmatter fence.** Real content begins at
  line 1025 in `Layout.astro` and every `src/components/*.astro` except `Footer.astro`. Reading the
  head of these files shows nothing; jump to line 1020+ or read the whole file. Do not "clean up" the
  blank block in an unrelated change — it has been there since the initial landing-page commit.
- **`no-commit-to-branch` blocks direct commits to `main`.** Work on a branch, or set
  `SKIP=no-commit-to-branch` (what CI does) when a direct commit is genuinely intended.
- **The site is dark-only.** `<html class="dark">` is hardcoded, `uno.config.ts` sets the body
  background unconditionally, and there is not a single `dark:` variant in `src/`. `ThemeToggle`
  toggles the class and `localStorage`, but no light-mode styles exist. Adding a `dark:` variant will
  not produce a working light theme without also giving every component a light base style.
- **`bun run lint` currently fails on `renovate.json`** (2-space indentation vs. Biome's tabs), which
  is why `Code Quality` is red on `main` and deploys are being skipped. Expect this pre-existing
  failure; fix it deliberately with `bun run lint:fix` rather than assuming your change broke CI.
- **`README.md` is partly stale**: it claims Astro 5 (the repo is on Astro 6), that `bun run build`
  type-checks (it does not), and lists a `src/assets/` directory that does not exist. Trust
  `package.json` and the configs over the README.

## Additional Documentation

- `.augment/rules/bun-astro-svelte-pro.md` — Read before non-trivial Astro/Svelte/UnoCSS work; it is
  the stack style guide (hydration-directive matrix, runes patterns, UnoCSS presets). Note that its
  "no API routes" rule is contradicted by the prerendered `src/pages/api/screenshots.ts` endpoint, and
  its content-collections and path-alias sections describe features this repo does not use.
- `.augment/rules/python-314-pro.md` — Read only when editing `scripts/update-appcast.py`.
- `.pre-commit-config.yaml` — Read to see which checks run at commit time versus push time before
  debugging a hook failure.
