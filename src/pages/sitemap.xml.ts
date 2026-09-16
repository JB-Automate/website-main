import { siteConfig } from "../lib/site-config";
import { absoluteUrl, brandImages, indexableRoutes, pageFileToRoute, routeSeo } from "../lib/seo";

// Routes are discovered from the pages directory rather than listed by hand, so a new
// page cannot be published without also appearing in the sitemap.
const discovered = Object.keys(import.meta.glob("./**/*.{astro,md,mdx,html}"))
  .map(pageFileToRoute)
  .filter((route): route is string => route !== null);

export function GET() {
  const site = { url: siteConfig.url, email: null, isPreview: siteConfig.isPreview };
  const routes = [...new Set([...discovered, ...indexableRoutes])].sort();
  const urls = siteConfig.isPreview
    ? ""
    : routes
        .map((route) => {
          const meta = routeSeo[route as keyof typeof routeSeo];
          const image =
            route === "/"
              ? `<image:image><image:loc>${absoluteUrl(site, brandImages.social.path)}</image:loc><image:title>${brandImages.social.alt}</image:title></image:image>`
              : "";
          return (
            `<url><loc>${absoluteUrl(site, route)}</loc>` +
            (meta ? `<lastmod>${meta.updated}</lastmod><changefreq>${meta.changefreq}</changefreq><priority>${meta.priority}</priority>` : "") +
            `${image}</url>`
          );
        })
        .join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
