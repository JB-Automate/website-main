import { siteConfig } from "../lib/site-config";

export function GET() {
  const body = siteConfig.isPreview
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${new URL("/sitemap.xml", siteConfig.url).href}\n`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
