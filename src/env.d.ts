/// <reference types="astro/client" />
/// <reference types="bun" />

declare namespace astroHTML.JSX {
  interface HTMLAttributes extends import('@unocss/preset-attributify').AttributifyAttributes {}
}

declare namespace svelteHTML {
  import type { AttributifyAttributes } from '@unocss/preset-attributify';
  type HTMLAttributes = AttributifyAttributes;
}
