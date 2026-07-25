# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Verified commands

Run from the repository root with Bun; `bun.lock` is authoritative.

```bash
bun install
bun run dev
bun run check
bun run lint
bun test
bun run build
```

`bun run build` only runs `astro build`; run `bun run check` separately for Astro and Svelte
diagnostics. CI runs the checks, tests, and build as separate steps.

Run one test file or one test case with:

```bash
bun test src/placeholder.test.ts
bun test src/placeholder.test.ts -t 'project builds successfully'
```

## Boundaries and gotchas

- This is an Astro 6 static build. `src/pages/api/screenshots.ts` runs at build time and emits
  `dist/api/screenshots`; do not introduce runtime server assumptions for that route.
- Add slideshow PNGs under `public/screenshots/`. Also update the hard-coded fallback in
  `src/components/ScreenshotSlideshow.svelte`, because it is used when `/api/screenshots` fails.
- `src/config.ts` and `public/appcast.xml` are release-publication outputs updated together by
  `.github/workflows/update-appcast.yml`. Do not hand-edit one for a release; use the release
  metadata workflow below.
- Shared UnoCSS tokens, shortcuts, icon preset, global animations, and the `reveal` behavior are
  owned by `uno.config.ts`. Add shared styling there rather than duplicating it in components.
- Deployment is chained: `code-quality.yml` must complete successfully on `main`, then
  `deploy.yml` builds and publishes `dist`. A commit containing `[skip ci]` intentionally skips
  the deploy job.
- The `prek` hook rejects commits directly to `main`; use a topic branch for normal changes
  rather than bypassing the hook.
- `README.md` and `.augment/rules/bun-astro-svelte-pro.md` still say Astro 5. The installed
  dependency and source of truth are `package.json`/`bun.lock` (Astro 6); do not copy Astro 5
  boilerplate from that rule without checking current configuration.

## Reference rules

- `.claude/skills/sync-release-metadata/SKILL.md` — reproduce or debug the repository-dispatch
  workflow that updates Sparkle appcast and download metadata. Read before changing release
  version, download URL, signature, file size, or minimum macOS version.
