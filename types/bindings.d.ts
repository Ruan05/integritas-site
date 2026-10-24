// Matches the existing Site D1 binding declared in .openai/hosting.json and vite.config.ts.
declare namespace Cloudflare {
  interface Env { DB: D1Database }
}
