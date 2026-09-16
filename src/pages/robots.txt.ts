import { siteConfig } from "../lib/site-config";
import { aiTrainingCrawlers, allowAiTraining } from "../lib/seo";

export function GET() {
  if (siteConfig.isPreview) {
    return text("User-agent: *\nDisallow: /\n");
  }

  const sitemap = new URL("/sitemap.xml", siteConfig.url).href;
  // Answer engines such as OAI-SearchBot, PerplexityBot, and Claude-SearchBot are
  // covered by the wildcard group below, so the site stays quotable in AI answers.
  const lines = [
    "# JB Automate",
    `# ${new URL("/", siteConfig.url).href}`,
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
  ];

  if (!allowAiTraining) {
    // A named group replaces the wildcard group for that crawler, so each one
    // repeats the full rule set rather than inheriting it.
    lines.push("# Model training collection is not permitted.");
    for (const crawler of aiTrainingCrawlers) {
      lines.push(`User-agent: ${crawler}`, "Disallow: /", "");
    }
  }

  lines.push(`Sitemap: ${sitemap}`, "");
  return text(lines.join("\n"));
}

function text(body: string) {
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
