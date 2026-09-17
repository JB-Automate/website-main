import { siteContent } from "../content/site.ts";
import { serviceLandings } from "../content/ads.ts";

/**
 * Every SEO fact the site publishes lives here, so metadata, structured data,
 * the sitemap, robots.txt, and llms.txt can never drift apart.
 *
 * Nothing in this file may state something the business has not agreed to.
 * Ratings, reviews, founding dates, employee counts, and awards are deliberately
 * absent: invented values are the most common cause of a structured data penalty.
 */

export type RoutePath = "/" | "/workflow-automation/" | "/custom-ai-apps/" | "/about/" | "/privacy/";

export interface SeoSite {
  /** Absolute https origin, no trailing slash. */
  url: string;
  /** Published contact address, or null when the build keeps it private. */
  email: string | null;
  isPreview: boolean;
}

/**
 * Profiles that prove this business is the same entity elsewhere on the web.
 * This is the strongest single signal Google uses to resolve "JB Automate" as a
 * real organisation and to attach a knowledge panel to brand searches.
 *
 * Add absolute https URLs to profiles the business actually controls, for example:
 *   "https://www.linkedin.com/company/<handle>"
 *   "https://www.google.com/maps/place/?q=place_id:<id>"   (Google Business Profile)
 *   "https://github.com/<org>"
 *   "https://www.crunchbase.com/organization/<handle>"
 * Never list a profile the business does not own.
 */
export const sameAs: readonly string[] = [];

/** Names the business is genuinely known by, beyond its full name. */
export const alternateNames = ["JB", "JBAutomate"] as const;

/** Subjects the business actually works in. These drive topical entity association. */
export const knowsAbout = [
  "Artificial intelligence",
  "AI application development",
  "Large language model integration",
  "Business process automation",
  "Workflow automation",
  "Custom software development",
  "Web design and development",
  "Data privacy and retention",
] as const;

/**
 * Crawlers that collect pages to train models, as opposed to answering a question and
 * linking back. Flip `allowAiTraining` to false to opt out; search engines and
 * answer engines keep full access either way.
 */
export const aiTrainingCrawlers = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "Omgilibot",
] as const;

export const allowAiTraining = true;

export const brandImages = {
  logo: { path: "/images/logo.png", width: 512, height: 512 },
  social: {
    path: "/images/social-card.png",
    width: 1200,
    height: 630,
    alt: "JB Automate. Put AI to work. On your terms.",
  },
} as const;

/**
 * Keyword-bearing names for the three published services. These describe the same
 * work as the visible copy in src/content/site.ts, in the words people search for.
 */
export const serviceNames: Record<string, { name: string; serviceType: string }> = {
  apps: { name: "Custom AI application development", serviceType: "AI application development" },
  workflows: { name: "Workflow automation", serviceType: "Business process automation" },
  websites: { name: "Website design and development", serviceType: "Web development" },
};

/**
 * Title and description per route. Titles stay at or under 60 characters and
 * descriptions between 120 and 160 so search engines show them without truncating.
 *
 * `updated` is published as the sitemap's lastmod. Bump it only when the page content
 * genuinely changes: a lastmod that moves on every deploy teaches crawlers to ignore it.
 */
export const routeSeo: Record<
  RoutePath,
  { title: string; description: string; ogType: string; updated: string; changefreq: string; priority: string }
> = {
  "/": {
    title: "Custom AI Apps & Workflow Automation | JB Automate",
    description:
      "JB Automate builds focused AI applications, connected workflows, and websites around the way your business works, with thoughtful data handling and support.",
    ogType: "website",
    updated: "2026-09-16",
    changefreq: "monthly",
    priority: "1.0",
  },
  "/workflow-automation/": {
    title: serviceLandings.workflow.title,
    description: serviceLandings.workflow.description,
    ogType: "website",
    updated: "2026-09-16",
    changefreq: "monthly",
    priority: "0.9",
  },
  "/custom-ai-apps/": {
    title: serviceLandings.aiApps.title,
    description: serviceLandings.aiApps.description,
    ogType: "website",
    updated: "2026-09-16",
    changefreq: "monthly",
    priority: "0.9",
  },
  "/about/": {
    title: "About JB Automate | AI Apps & Automation",
    description:
      "Learn how JB Automate approaches custom AI applications and workflow automation, from defining the business task and data boundaries to support after launch.",
    ogType: "website",
    updated: "2026-09-17",
    changefreq: "yearly",
    priority: "0.7",
  },
  "/privacy/": {
    title: "Privacy Notice | JB Automate",
    description:
      "How JB Automate collects, uses, stores, and deletes the information you send through the enquiry form on this website, in plain language.",
    ogType: "article",
    updated: "2026-09-16",
    changefreq: "yearly",
    priority: "0.3",
  },
};

export const indexableRoutes = Object.keys(routeSeo) as RoutePath[];

/**
 * Maps a file under src/pages to the URL it will be served at, or null when the file
 * is not an indexable page. Driving the sitemap off this means a new page cannot be
 * silently left out.
 */
export function pageFileToRoute(file: string): string | null {
  const relative = file.replace(/^.*?src[\\/]pages[\\/]/, "").replace(/^\.\//, "").replaceAll("\\", "/");
  const withoutExtension = relative.replace(/\.(astro|md|mdx|html)$/, "");
  if (withoutExtension === relative) return null; // endpoints such as sitemap.xml.ts
  const segments = withoutExtension.split("/");
  // Astro treats a leading underscore as private, and bracket segments need real params.
  if (segments.some((segment) => segment.startsWith("_") || segment.includes("["))) return null;
  if (["404", "500"].includes(segments.at(-1) ?? "")) return null;
  if (segments[0] === "api") return null;
  const path = segments.at(-1) === "index" ? segments.slice(0, -1).join("/") : withoutExtension;
  return path === "" ? "/" : `/${path}/`;
}

/** Normalises any request path to the one canonical, trailing-slash form. */
export function canonicalPath(pathname: string): string {
  const trimmed = pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return trimmed === "" ? "/" : `${trimmed}/`;
}

export function isRoutePath(path: string): path is RoutePath {
  return Object.hasOwn(routeSeo, path);
}

export function seoForPath(pathname: string) {
  const path = canonicalPath(pathname);
  return isRoutePath(path) ? routeSeo[path] : routeSeo["/"];
}

function origin(site: SeoSite): string {
  return site.url.replace(/\/+$/, "");
}

export function absoluteUrl(site: SeoSite, path: string): string {
  return `${origin(site)}${path.startsWith("/") ? path : `/${path}`}`;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Drops undefined values and empty arrays so optional facts never emit as null. */
export function pruneJsonLd(value: unknown): JsonValue | undefined {
  if (Array.isArray(value)) {
    const items = value.map(pruneJsonLd).filter((item) => item !== undefined) as JsonValue[];
    return items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, pruneJsonLd(item)] as const)
      .filter(([, item]) => item !== undefined) as [string, JsonValue][];
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  if (value === undefined || value === null || value === "") return undefined;
  return value as JsonValue;
}

/**
 * Serialises a graph for an inline script tag. Escaping the angle brackets stops a
 * value from closing the script element, and escaping the line separators keeps the
 * output valid JavaScript as well as valid JSON.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(pruneJsonLd(value) ?? {})
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Builds one connected @graph for a page. Cross-referenced @id values let search
 * engines resolve a single organisation rather than several disconnected records.
 */
export function buildJsonLdGraph(site: SeoSite, pathname: string) {
  const base = origin(site);
  const path = canonicalPath(pathname);
  const meta = seoForPath(path);
  const pageUrl = `${base}${path}`;
  const orgId = `${base}/#organization`;
  const websiteId = `${base}/#website`;
  const logoId = `${base}/#logo`;
  const pageId = `${pageUrl}#webpage`;
  const isHome = path === "/";
  const servicePage =
    path === "/workflow-automation/"
      ? { id: "workflows", content: serviceLandings.workflow }
      : path === "/custom-ai-apps/"
        ? { id: "apps", content: serviceLandings.aiApps }
        : null;
  const pageServiceId = servicePage ? `${pageUrl}#service` : null;

  const logo = {
    "@type": "ImageObject",
    "@id": logoId,
    url: `${base}${brandImages.logo.path}`,
    contentUrl: `${base}${brandImages.logo.path}`,
    width: brandImages.logo.width,
    height: brandImages.logo.height,
    caption: siteContent.name,
  };

  const organization = {
    "@type": "Organization",
    "@id": orgId,
    name: siteContent.name,
    alternateName: [...alternateNames],
    legalName: siteContent.name,
    url: `${base}/`,
    logo: { "@id": logoId },
    image: { "@id": logoId },
    description: siteContent.description,
    slogan: `${siteContent.hero.heading[0]} ${siteContent.hero.heading[1]}`,
    email: site.email ?? undefined,
    knowsAbout: [...knowsAbout],
    sameAs: sameAs.length ? [...sameAs] : undefined,
    contactPoint: site.email
      ? {
          "@type": "ContactPoint",
          contactType: "sales",
          email: site.email,
          availableLanguage: { "@type": "Language", name: "English" },
        }
      : undefined,
    // The catalog is only declared alongside the Service nodes it points at, so no
    // page can ship a reference to a node that is not in its own graph.
    hasOfferCatalog: isHome
      ? {
          "@type": "OfferCatalog",
          "@id": `${base}/#service-catalog`,
          name: "AI and automation services",
          itemListElement: siteContent.services.items.map((service) => ({
            "@type": "Offer",
            itemOffered: { "@id": `${base}/#service-${service.id}` },
          })),
        }
      : undefined,
  };

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${base}/`,
    name: siteContent.name,
    alternateName: [...alternateNames],
    description: siteContent.description,
    publisher: { "@id": orgId },
    inLanguage: "en-CA",
    // No SearchAction: this site has no search endpoint, and claiming one is a spam signal.
  };

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
      ...(isHome ? [] : [{ "@type": "ListItem", position: 2, name: meta.title.split(" | ")[0], item: pageUrl }]),
    ],
  };

  const webPage = {
    // schema.org has no PrivacyPolicy type; WebPage is the correct, validating choice.
    "@type": "WebPage",
    "@id": pageId,
    url: pageUrl,
    name: meta.title,
    description: meta.description,
    isPartOf: { "@id": websiteId },
    about: { "@id": orgId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: `${base}${brandImages.social.path}`,
      width: brandImages.social.width,
      height: brandImages.social.height,
      caption: brandImages.social.alt,
    },
    breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
    mainEntity: pageServiceId ? { "@id": pageServiceId } : undefined,
    inLanguage: "en-CA",
  };

  const servicePageNodes = servicePage
    ? [
        {
          "@type": "Service",
          "@id": pageServiceId,
          name: serviceNames[servicePage.id]?.name ?? servicePage.content.label,
          serviceType: serviceNames[servicePage.id]?.serviceType ?? servicePage.content.label,
          description: servicePage.content.description,
          provider: { "@id": orgId },
          url: pageUrl,
          mainEntityOfPage: { "@id": pageId },
        },
        {
          "@type": "FAQPage",
          "@id": `${pageUrl}#faq`,
          isPartOf: { "@id": pageId },
          inLanguage: "en-CA",
          mainEntity: servicePage.content.faqs.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        },
      ]
    : [];

  const homeOnly = isHome
    ? [
        ...siteContent.services.items.map((service) => ({
          "@type": "Service",
          "@id": `${base}/#service-${service.id}`,
          name: serviceNames[service.id]?.name ?? service.label,
          serviceType: serviceNames[service.id]?.serviceType ?? service.label,
          description: service.description,
          provider: { "@id": orgId },
          url: `${base}/#services`,
        })),
        {
          "@type": "FAQPage",
          "@id": `${pageUrl}#faq`,
          isPartOf: { "@id": pageId },
          inLanguage: "en-CA",
          mainEntity: siteContent.faq.items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        },
      ]
    : [];

  return {
    "@context": "https://schema.org",
    "@graph": [organization, logo, website, webPage, breadcrumb, ...homeOnly, ...servicePageNodes],
  };
}
