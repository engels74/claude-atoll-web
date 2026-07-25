---
name: sync-release-metadata
description: Reproduce or debug the repository-dispatch workflow that synchronizes Sparkle appcast and website download metadata.
---

# Sync release metadata

Use this procedure only when reproducing or debugging `.github/workflows/update-appcast.yml`.
Normal releases arrive through its `repository_dispatch` event.

1. Start from the repository root. Collect the required dispatch values `VERSION`,
   `BUILD_NUMBER`, and `DOWNLOAD_URL`; `ED_SIGNATURE`, `FILE_SIZE`, and
   `MIN_SYSTEM_VERSION` are optional. The script defaults file size to `0` and minimum macOS to
   `15.6`.
2. Run the same updater as CI:

   ```bash
   VERSION=1.0.0 BUILD_NUMBER=202601251200 DOWNLOAD_URL=https://example.com/app.zip \
     python3 scripts/update-appcast.py
   ```

   This prepends a Sparkle item to `public/appcast.xml` and retains at most ten items.
3. Update `LATEST_VERSION` and `DOWNLOAD_URL` in `src/config.ts` from the same release payload.
   Never update only one of `public/appcast.xml` and `src/config.ts`.
4. Format the generated TypeScript exactly as the workflow does:

   ```bash
   bunx biome format --write src/config.ts
   ```

5. Verify the synchronized output:

   ```bash
   bun run check
   bun test
   bun run build
   ```

6. Stage `public/appcast.xml` and `src/config.ts` together. Confirm the newest appcast item uses
   `BUILD_NUMBER` for `sparkle:version`, `VERSION` for `sparkle:shortVersionString`, and the same
   download URL exported by `src/config.ts`.
