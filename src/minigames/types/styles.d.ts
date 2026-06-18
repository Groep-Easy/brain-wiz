// Ambient declarations for Vite-handled imports (CSS side-effects and `?url`
// assets). Mirrors src/shared/types/styles.d.ts. Without these, `tsc -b` cannot
// resolve the `.css` / `.svg?url` imports in the minigame components.
declare module '*.css'

declare module '*.svg?url' {
  const url: string
  export default url
}
