import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

export default defineConfig({
  site: env.PUBLIC_SITE_URL || "https://jbautomate.ca",
  output: "static",
  adapter: vercel(),
  // One canonical URL shape. Without this, /privacy and /privacy/ can both be
  // indexed and split their own ranking signals.
  trailingSlash: "always",
  markdown: { syntaxHighlight: false },
  vite: {
    // Keep every asset as a separate file. Inlining would emit data: URIs, and the
    // font-src 'self' policy below blocks those, so raising this breaks font loading.
    build: { assetsInlineLimit: 0 },
  },
  devToolbar: { enabled: false },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
});
