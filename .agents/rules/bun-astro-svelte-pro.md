---
type: "agent_requested"
description: "Modern Bun + Astro 5 + Svelte 5 + UnoCSS Static Site Development Guide"
---

# Modern Bun + Astro 5 + Svelte 5 + UnoCSS Static Site Development Guide

This comprehensive reference documents **2025-ready best practices** for building static-first content sites with islands of interactivity, deployed to GitHub Pages. The stack leverages Astro's zero-JS default philosophy, Svelte 5's Runes reactivity system, and UnoCSS's atomic CSS engine—all powered by Bun's high-performance runtime.

**Key architectural distinction:** Astro handles all routing, builds, and static generation; Svelte 5 components function exclusively as interactive islands within otherwise static pages. No SSR, no API routes, no form actions—pure static output for GitHub Pages.

---

## 1. Project Setup & Configuration

### Initialize with Bun for faster installs and builds

**Rule:** Use `bun create astro` for new projects; Bun is auto-detected and provides **30-70% faster** dependency installation.

```bash
# Initialize project
bun create astro my-site
cd my-site

# Add integrations
bun astro add svelte
bun add -D @types/bun unocss @unocss/astro
```

**Rationale:** The `create-astro` CLI automatically detects Bun via `bun.lockb` and uses it for all operations. Bun's native file I/O and zlib compression accelerate builds compared to Node.js.

### Complete astro.config.mjs for this stack

```javascript
// astro.config.mjs
import { defineConfig, envField } from 'astro/config';
import svelte from '@astrojs/svelte';
import UnoCSS from 'unocss/astro';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // GitHub Pages configuration
  site: 'https://username.github.io',
  base: '/repo-name', // Only for project repos, omit for username.github.io

  // Static output is default in Astro 5 - no config needed

  // Integrations (order matters)
  integrations: [
    UnoCSS({ injectReset: true }), // CSS framework first
    svelte(),                       // UI framework
    sitemap(),                      // Build tools last
  ],

  // Type-safe environment variables (Astro 5+)
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: 'client', access: 'public' }),
      BUILD_TIME: envField.string({ context: 'server', access: 'public', optional: true }),
    },
  },

  // Prefetch for faster navigation
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
});
```

### TypeScript strict configuration

```json
// tsconfig.json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"]
    },
    "verbatimModuleSyntax": true
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

**Rationale:** The `strict` template enables `strictNullChecks` and modern features. Path aliases simplify imports. Run `bun astro sync` to regenerate `.astro/types.d.ts` after schema changes.

### Svelte configuration for Astro

```javascript
// svelte.config.js
import { vitePreprocess } from '@astrojs/svelte';

export default {
  preprocess: vitePreprocess(),
};
```

**When to deviate:** Only create this file when using preprocessors (SCSS, TypeScript in `<script>`). The `astro add svelte` command creates it automatically.

---

## 2. Astro 5 Content Layer API

### Define collections with the new loader pattern

**Rule:** Use `defineCollection` with `glob()` loader from `astro/loaders`—the legacy `type: 'content'` syntax is deprecated.

```typescript
// src/content.config.ts (NOTE: renamed from src/content/config.ts)
import { defineCollection, z, reference } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/data/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    description: z.string().max(160),
    author: reference('authors'), // Cross-collection reference
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/data/authors' }),
  schema: z.object({
    name: z.string(),
    avatar: z.string().url(),
    bio: z.string(),
  }),
});

export const collections = { blog, authors };
```

**Key migration notes (Astro 4 → 5):**
- Config file moved: `src/content/config.ts` → `src/content.config.ts`
- `slug` property replaced with `id` (auto-slugified by glob loader)
- Collections build **up to 5x faster** with **25-50% less memory**

### Query collections type-safely

```astro
---
// src/pages/blog/[slug].astro
import { getCollection, getEntry } from 'astro:content';
import type { GetStaticPaths } from 'astro';
import Layout from '@layouts/Layout.astro';

export const getStaticPaths = (async () => {
  const posts = await getCollection('blog', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true;
  });
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}) satisfies GetStaticPaths;

const { post } = Astro.props;
const author = await getEntry(post.data.author);
const { Content } = await post.render();
---

<Layout title={post.data.title}>
  <article class="prose prose-lg">
    <h1>{post.data.title}</h1>
    <p>By {author.data.name}</p>
    <Content />
  </article>
</Layout>
```

---

## 3. Islands Architecture & Hydration

### Client directive selection matrix

| Directive | Hydration Timing | Use Case | Performance Impact |
|-----------|------------------|----------|-------------------|
| `client:load` | Immediately on page load | Above-fold critical UI | Highest TTI impact |
| `client:idle` | After page becomes idle | Non-critical interactivity | Moderate |
| `client:visible` | When scrolled into viewport | Below-fold components | Best for long pages |
| `client:media="(query)"` | When media query matches | Responsive components | Conditional |
| `client:only="svelte"` | Client-only, no SSR | Browser API-dependent | No static fallback |

**Rule:** Default to `client:visible` or `client:idle`; use `client:load` only for above-fold interactive elements.

```astro
---
import Header from '@components/Header.svelte';
import SearchBar from '@components/SearchBar.svelte';
import VideoPlayer from '@components/VideoPlayer.svelte';
import Comments from '@components/Comments.svelte';
import MobileMenu from '@components/MobileMenu.svelte';
---

<!-- Above fold, needs immediate interaction -->
<Header client:load />

<!-- Important but can wait for browser idle -->
<SearchBar client:idle />

<!-- Below fold - only load when visible -->
<VideoPlayer client:visible />
<Comments client:visible />

<!-- Only shows on mobile -->
<MobileMenu client:media="(max-width: 768px)" />
```

### Anti-pattern: Over-hydrating components

```astro
<!-- ❌ AVOID: Hydrating purely presentational components -->
<Card client:load title="Static Content" />

<!-- ✅ CORRECT: No directive = zero JavaScript shipped -->
<Card title="Static Content" />
```

**Rationale:** Every `client:*` directive adds JavaScript to the bundle. Astro's power comes from shipping zero JS by default—preserve this advantage.

### Passing props from Astro to Svelte

**Rule:** Only serializable data (strings, numbers, booleans, arrays, plain objects) can be passed as props. Functions cannot be serialized for hydration.

```astro
---
import Counter from '@components/Counter.svelte';
import Chart from '@components/Chart.svelte';

const chartData = await fetchChartData();
---

<!-- ✅ Serializable props work with all directives -->
<Counter initialCount={5} client:visible />
<Chart data={chartData} client:idle />
```

---

## 4. Svelte 5 Runes in Astro Context

### Core Runes patterns for islands

**`$state` for reactive variables:**
```svelte
<script lang="ts">
  // Explicit reactivity - works anywhere (components, .svelte.ts files)
  let count = $state(0);
  let user = $state({ name: 'Guest', loggedIn: false });

  // Direct mutation works (Svelte proxies deeply)
  function login() {
    user.name = 'Alice';
    user.loggedIn = true; // Triggers update
  }
</script>
```

**`$derived` and `$derived.by` for computed values:**
```svelte
<script lang="ts">
  let items = $state<{ price: number; qty: number }[]>([]);

  // Simple expression
  const total = $derived(items.reduce((sum, i) => sum + i.price * i.qty, 0));

  // Complex logic with multiple statements
  const summary = $derived.by(() => {
    if (items.length === 0) return 'Cart empty';
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    return `${items.length} items, $${total.toFixed(2)}`;
  });
</script>
```

**`$effect` for side effects with cleanup:**
```svelte
<script lang="ts">
  let seconds = $state(0);

  $effect(() => {
    const interval = setInterval(() => seconds++, 1000);
    // Cleanup runs before re-run and on unmount
    return () => clearInterval(interval);
  });
</script>
```

### TypeScript-first `$props` pattern

```svelte
<script lang="ts">
  interface Props {
    title: string;
    count?: number;
    class?: string;               // Reserved word needs renaming
    onAction?: (id: string) => void;  // Callback prop (replaces events)
  }

  let {
    title,
    count = 0,
    class: className = '',
    onAction,
    ...rest
  }: Props = $props();
</script>

<div class={className} {...rest}>
  <h1>{title}</h1>
  <button onclick={() => onAction?.(title)}>
    Clicked {count} times
  </button>
</div>
```

### Performance: `$state.raw` for immutable data

**Rule:** Use `$state.raw()` for large datasets you replace wholesale; use `$state()` for data you mutate.

```svelte
<script lang="ts">
  // ✅ API responses - replaced entirely, never mutated
  let chartData = $state.raw<DataPoint[]>([]);

  async function refresh() {
    chartData = await fetch('/api/data').then(r => r.json());
  }

  // ❌ chartData.push(newPoint) won't trigger updates with $state.raw!

  // ✅ Form state - mutated in place
  let formFields = $state({ name: '', email: '' });
  formFields.name = 'Alice'; // Works - triggers update
</script>
```

### Snippets replace slots in Svelte 5

```svelte
<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    header?: Snippet;
    footer?: Snippet<[{ count: number }]>;
  }

  let { children, header, footer }: Props = $props();
  let count = $state(0);
</script>

<div class="card">
  {#if header}
    <header>{@render header()}</header>
  {/if}

  <main>{@render children()}</main>

  {#if footer}
    <footer>{@render footer({ count })}</footer>
  {/if}
</div>

<!-- Usage -->
<Card>
  {#snippet header()}
    <h2>My Card</h2>
  {/snippet}

  <p>This is default content (children)</p>

  {#snippet footer({ count })}
    <button onclick={() => count++}>Clicked {count}</button>
  {/snippet}
</Card>
```

### State sharing between islands

**Rule:** Islands are isolated component trees—context doesn't bridge them. Use Nano Stores or `.svelte.ts` files for cross-island state.

```typescript
// src/stores/cart.svelte.ts
let cartItems = $state<Map<string, number>>(new Map());
const cartCount = $derived([...cartItems.values()].reduce((a, b) => a + b, 0));

export const cart = {
  get items() { return cartItems; },
  get count() { return cartCount; },
  add(productId: string) {
    const items = new Map(cartItems);
    items.set(productId, (items.get(productId) || 0) + 1);
    cartItems = items;
  },
  clear() { cartItems = new Map(); }
};
```

```svelte
<!-- AddToCart.svelte (Island 1) -->
<script lang="ts">
  import { cart } from '@/stores/cart.svelte';
  let { productId }: { productId: string } = $props();
</script>

<button onclick={() => cart.add(productId)}>Add to Cart</button>

<!-- CartIcon.svelte (Island 2) -->
<script lang="ts">
  import { cart } from '@/stores/cart.svelte';
</script>

<span class="i-mdi-cart" /> {cart.count}
```

---

## 5. UnoCSS Configuration

### Complete uno.config.ts for this stack

```typescript
// uno.config.ts
import {
  defineConfig,
  presetWind3,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetAttributify,
  transformerVariantGroup,
  transformerDirectives,
} from 'unocss';
import extractorSvelte from '@unocss/extractor-svelte';

export default defineConfig({
  // Required for Svelte class: directive support
  extractors: [extractorSvelte()],

  presets: [
    presetWind3({ dark: 'class' }), // Tailwind 3 compatibility
    presetAttributify({ prefix: 'un-' }),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetTypography(),
    presetWebFonts({
      provider: 'bunny', // GDPR-compliant alternative
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'Fira Code:400,500',
      },
    }),
  ],

  transformers: [
    transformerVariantGroup(),  // hover:(bg-blue-500 text-white)
    transformerDirectives(),     // @apply support
  ],

  // Custom shortcuts
  shortcuts: {
    'btn': 'px-4 py-2 rounded-lg font-medium transition-colors',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary/90',
    'card': 'p-6 rounded-xl bg-white dark:bg-gray-800 shadow-lg',
    'input': 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary',
    'flex-center': 'flex items-center justify-center',
  },

  // Theme with CSS variables for runtime theming
  theme: {
    colors: {
      primary: 'hsl(var(--primary) / <alpha-value>)',
      secondary: 'hsl(var(--secondary) / <alpha-value>)',
    },
  },

  // CSS variable definitions
  preflights: [{
    getCSS: () => `
      :root {
        --primary: 221 83% 53%;
        --secondary: 142 76% 36%;
      }
      .dark {
        --primary: 217 91% 60%;
        --secondary: 142 71% 45%;
      }
    `,
  }],

  // Safelist for dynamic classes
  safelist: ['prose', 'prose-lg', 'prose-invert'],
});
```

### Icon usage with presetIcons

```bash
# Install only the icon collections you need
bun add -D @iconify-json/mdi @iconify-json/heroicons @iconify-json/lucide
```

```html
<!-- Pure CSS icons - no JavaScript -->
<div class="i-mdi-home text-2xl" />
<button class="i-heroicons-sun dark:i-heroicons-moon" />
```

### Variant groups for cleaner markup

```html
<!-- Before: Repetitive prefixes -->
<div class="hover:bg-gray-100 hover:text-gray-900 hover:font-bold" />

<!-- After: Grouped variants -->
<div class="hover:(bg-gray-100 text-gray-900 font-bold)" />

<!-- Nested groups -->
<div class="dark:(bg-gray-800 hover:(bg-gray-700 text-white))" />
```

### Attributify mode for readable components

```html
<button
  bg="blue-500 hover:blue-600"
  text="white sm"
  p="x-4 y-2"
  rounded="lg"
>
  Click me
</button>
```

**TypeScript declarations for attributify:**
```typescript
// src/env.d.ts
declare namespace astroHTML.JSX {
  interface HTMLAttributes extends import('@unocss/preset-attributify').AttributifyAttributes {}
}

declare namespace svelteHTML {
  import type { AttributifyAttributes } from '@unocss/preset-attributify';
  type HTMLAttributes = AttributifyAttributes;
}
```

---

## 6. GitHub Pages Deployment

### GitHub Actions workflow for Bun

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Build with Astro
        uses: withastro/action@v5
        with:
          package-manager: bun@latest
        # env:
        #   PUBLIC_API_URL: 'https://api.example.com'

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

### Site configuration matrix

| Scenario | `site` | `base` |
|----------|--------|--------|
| `username.github.io` repo | `https://username.github.io` | Not needed |
| Project repo (`user/my-repo`) | `https://username.github.io` | `/my-repo` |
| Custom domain | `https://example.com` | Not needed |

### Essential deployment files

```
public/
├── .nojekyll    # Required - prevents Jekyll processing of _astro folder
├── CNAME        # Optional - for custom domains
└── favicon.svg
```

### Base path usage in components

```astro
---
const base = import.meta.env.BASE_URL;
---

<a href={`${base}about`}>About</a>
<img src={`${base}images/logo.png`} alt="Logo" />
```

---

## 7. Performance Optimization

### Zero-JS is the default—preserve it

**Rule:** Start every component as static; add `client:*` only when interactivity is genuinely needed. This achieves **40% faster load times** with **90% less JavaScript** than typical React frameworks.

### Image optimization with astro:assets

```astro
---
import { Image } from 'astro:assets';
import heroImage from '@/assets/hero.jpg';
---

<!-- Automatic WebP conversion, dimension inference, lazy loading -->
<Image
  src={heroImage}
  alt="Hero"
  width={800}
  height={600}
  format="webp"
/>
```

**Rule:** Store optimizable images in `src/assets/`, not `public/`. Images in `public/` are served as-is without optimization.

### Critical CSS and prefetching

```javascript
// astro.config.mjs
export default defineConfig({
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport', // 'hover' | 'viewport' | 'load'
  },
});
```

UnoCSS generates atomic CSS on-demand—only used classes are included, keeping stylesheets minimal.

---

## 8. Tooling & Developer Experience

### Biome for unified linting and formatting

**Rule:** Use Biome 2.3+ with experimental HTML support for 10-20x faster linting than ESLint+Prettier.

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.3.0/schema.json",
  "html": { "experimentalFullSupportEnabled": true },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "overrides": [{
    "includes": ["**/*.svelte", "**/*.astro"],
    "linter": {
      "rules": {
        "style": { "useConst": "off" },
        "correctness": { "noUnusedVariables": "off" }
      }
    }
  }]
}
```

### Type checking in CI

```json
// package.json
{
  "scripts": {
    "check": "astro check && svelte-check --tsconfig ./tsconfig.json",
    "build": "bun run check && astro build"
  }
}
```

### VS Code extensions

- `astro-build.astro-vscode` - Astro language support
- `svelte.svelte-vscode` - Svelte 5 language support  
- `antfu.unocss` - UnoCSS IntelliSense
- `biomejs.biome` - Biome formatting/linting

### Testing stack

```typescript
// vitest.config.ts
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
```

```typescript
// Component test with @testing-library/svelte
import { render } from '@testing-library/svelte';
import Counter from './Counter.svelte';

test('renders counter', () => {
  const { getByRole } = render(Counter, { props: { count: 5 }});
  expect(getByRole('button')).toBeInTheDocument();
});
```

---

## 9. Content Management

### Markdown with Shiki syntax highlighting

```javascript
// astro.config.mjs
export default defineConfig({
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      langs: ['javascript', 'typescript', 'svelte', 'astro'],
    },
  },
});
```

### RSS and sitemap generation

```typescript
// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: 'My Blog',
    description: 'A blog about things',
    site: context.site,
    items: posts.map(post => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
    })),
  });
}
```

---

## 10. Migration Reference

### Svelte 4 → Svelte 5 quick reference

| Svelte 4 | Svelte 5 |
|----------|----------|
| `let x = 0` (top-level) | `let x = $state(0)` |
| `$: doubled = x * 2` | `const doubled = $derived(x * 2)` |
| `$: console.log(x)` | `$effect(() => console.log(x))` |
| `export let prop` | `let { prop } = $props()` |
| `export let prop = $bindable()` | `let { prop = $bindable() } = $props()` |
| `on:click={handler}` | `onclick={handler}` |
| `createEventDispatcher()` | Callback props: `onEvent?.(data)` |
| `<slot />` | `{@render children()}` |
| `<slot name="x" />` | `{@render x?.()}` |

### Tailwind → UnoCSS equivalents

| Tailwind | UnoCSS |
|----------|--------|
| `tailwind.config.js` | `uno.config.ts` |
| `@tailwind base/utilities` | Automatic via presets |
| `@apply` | `@apply` (with transformerDirectives) |
| JIT mode | On-demand by default |
| `content: []` | Automatic detection |
| `@tailwindcss/typography` | `presetTypography()` |

### npm → Bun commands

| npm | Bun |
|-----|-----|
| `npm create astro` | `bun create astro` |
| `npm install` | `bun install` |
| `npm run dev` | `bun run dev` |
| `npx astro add` | `bun astro add` |
| `npm test` | `bun test` |

---

## Anti-patterns to Avoid

1. **Using Svelte stores in new code** → Use Runes (`$state`, `$derived`, `$effect`)
2. **Using `$:` reactive statements** → Use `$derived` for values, `$effect` for side effects
3. **Hydrating presentational components** → Omit `client:*` directive for static content
4. **Using `client:load` everywhere** → Default to `client:visible` or `client:idle`
5. **npm/pnpm commands** → Use Bun equivalents for consistency
6. **Legacy content collections** → Use Content Layer API with `glob()` loader
7. **`type: 'content'` in collections** → Use explicit `loader` configuration
8. **Storing images in `public/`** → Store in `src/assets/` for optimization
9. **Dynamic class concatenation** → Use static class maps or safelist
