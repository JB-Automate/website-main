import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { siteContent } from "../src/content/site.ts";
import {
  absoluteUrl,
  aiTrainingCrawlers,
  alternateNames,
  brandImages,
  buildJsonLdGraph,
  canonicalPath,
  indexableRoutes,
  knowsAbout,
  pageFileToRoute,
  pruneJsonLd,
  routeSeo,
  sameAs,
  serializeJsonLd,
  serviceNames,
} from "../src/lib/seo.ts";

const site = { url: "https://jbautomate.ca", email: "admin@jbautomate.ca", isPreview: false };

function graphFor(path: string) {
  // Parse what a crawler actually receives, not the object we happened to build.
  const escaped = serializeJsonLd(buildJsonLdGraph(site, path));
  const html = escaped
    .replaceAll("\\u003c", "<")
    .replaceAll("\\u003e", ">")
    .replaceAll("\\u0026", "&");
  return JSON.parse(html) as { "@context": string; "@graph": Record<string, unknown>[] };
}

function nodesOfType(path: string, type: string) {
  return graphFor(path)["@graph"].filter((node) => node["@type"] === type);
}

test("titles and descriptions stay within what search engines display", () => {
  for (const [route, meta] of Object.entries(routeSeo)) {
    assert.ok(meta.title.length <= 60, `${route} title is ${meta.title.length} characters`);
    assert.ok(meta.title.includes(siteContent.name), `${route} title must carry the brand`);
    assert.ok(
      meta.description.length >= 120 && meta.description.length <= 160,
      `${route} description is ${meta.description.length} characters`,
    );
  }
});

test("every route declares a lastmod that is a real, non-future date", () => {
  const today = new Date().toISOString().slice(0, 10);
  for (const [route, meta] of Object.entries(routeSeo)) {
    assert.match(meta.updated, /^\d{4}-\d{2}-\d{2}$/, route);
    assert.ok(!Number.isNaN(Date.parse(meta.updated)), route);
    assert.ok(meta.updated <= today, `${route} lastmod is in the future`);
  }
});

test("canonical paths collapse every spelling of a URL into one", () => {
  assert.equal(canonicalPath("/"), "/");
  assert.equal(canonicalPath(""), "/");
  assert.equal(canonicalPath("/privacy"), "/privacy/");
  assert.equal(canonicalPath("/privacy/"), "/privacy/");
  assert.equal(canonicalPath("//privacy//"), "/privacy/");
});

test("the sitemap covers every page that exists on disk", () => {
  const pagesDir = fileURLToPath(new URL("../src/pages", import.meta.url));
  const discovered = readdirSync(pagesDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => pageFileToRoute(entry.name))
    .filter((route): route is string => route !== null);

  assert.ok(discovered.length > 0, "no pages were discovered");
  for (const route of discovered) {
    assert.ok(indexableRoutes.includes(route as never), `${route} has no SEO metadata in routeSeo`);
  }
  for (const route of indexableRoutes) {
    assert.ok(discovered.includes(route), `${route} has metadata but no page file`);
  }
});

test("page file paths map to the URLs Astro actually serves", () => {
  assert.equal(pageFileToRoute("index.astro"), "/");
  assert.equal(pageFileToRoute("privacy.astro"), "/privacy/");
  assert.equal(pageFileToRoute("blog/index.astro"), "/blog/");
  // Endpoints, private files, dynamic routes, error pages, and the API are never listed.
  assert.equal(pageFileToRoute("sitemap.xml.ts"), null);
  assert.equal(pageFileToRoute("robots.txt.ts"), null);
  assert.equal(pageFileToRoute("_draft.astro"), null);
  assert.equal(pageFileToRoute("blog/[slug].astro"), null);
  assert.equal(pageFileToRoute("404.astro"), null);
  assert.equal(pageFileToRoute("api/contact.ts"), null);
});

test("structured data is valid JSON once escaped for an inline script", () => {
  for (const route of indexableRoutes) {
    const graph = graphFor(route);
    assert.equal(graph["@context"], "https://schema.org");
    assert.ok(graph["@graph"].length >= 4, route);
  }
  // Angle brackets must never survive, or a value could close the script element.
  const escaped = serializeJsonLd({ danger: "</script><img src=x onerror=alert(1)>" });
  assert.ok(!escaped.includes("<") && !escaped.includes(">"));
  assert.equal(JSON.parse(escaped.replaceAll("\\u003c", "<").replaceAll("\\u003e", ">")).danger, "</script><img src=x onerror=alert(1)>");
});

test("every @id reference in the graph resolves to a node in the same graph", () => {
  for (const route of indexableRoutes) {
    const graph = graphFor(route);
    const declared = new Set(graph["@graph"].map((node) => node["@id"] as string));
    const referenced: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== "object") return;
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (keys.length === 1 && keys[0] === "@id") referenced.push(record["@id"] as string);
      else Object.values(record).forEach(walk);
    };
    graph["@graph"].forEach(walk);
    assert.ok(referenced.length > 0, route);
    for (const id of referenced) {
      assert.ok(declared.has(id), `${route} references ${id}, which no node declares`);
    }
  }
});

test("no undefined, null, or empty value ever reaches the rendered graph", () => {
  for (const route of indexableRoutes) {
    const raw = serializeJsonLd(buildJsonLdGraph(site, route));
    assert.ok(!raw.includes("undefined"), route);
    assert.ok(!raw.includes(":null"), route);
    assert.ok(!raw.includes(':""'), route);
  }
  assert.deepEqual(pruneJsonLd({ keep: "yes", drop: undefined, empty: "", blank: [] }), { keep: "yes" });
  assert.equal(pruneJsonLd({ all: undefined }), undefined);
});

test("optional facts are omitted rather than published as placeholders", () => {
  // sameAs ships empty until the business supplies real profiles it controls.
  const withoutProfiles = graphFor("/")["@graph"].find((node) => node["@type"] === "Organization")!;
  assert.equal(sameAs.length === 0, !("sameAs" in withoutProfiles));

  // A build that keeps the address private must not invent a contact point.
  const privateGraph = buildJsonLdGraph({ ...site, email: null }, "/");
  const organization = privateGraph["@graph"].find((node) => node["@type"] === "Organization") as Record<string, unknown>;
  assert.equal(pruneJsonLd(organization.email), undefined);
  assert.equal(pruneJsonLd(organization.contactPoint), undefined);
});

test("the graph never claims ratings, reviews, or other unverified credentials", () => {
  // Checked as property names, not as raw substrings: the FAQ copy legitimately uses
  // words like "review" in its answers.
  const banned = new Set([
    "aggregateRating",
    "review",
    "reviews",
    "ratingValue",
    "reviewCount",
    "award",
    "awards",
    "foundingDate",
    "numberOfEmployees",
    "priceRange",
    "telephone",
    "address",
  ]);
  const keysIn = (value: unknown, found: string[] = []): string[] => {
    if (Array.isArray(value)) value.forEach((item) => keysIn(item, found));
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        found.push(key);
        keysIn(item, found);
      }
    }
    return found;
  };

  for (const route of indexableRoutes) {
    for (const key of keysIn(graphFor(route))) {
      assert.ok(!banned.has(key), `${route} must not publish ${key}`);
    }
  }
});

test("the organisation is described well enough to be resolved as an entity", () => {
  const organization = nodesOfType("/", "Organization")[0];
  assert.equal(organization["@id"], "https://jbautomate.ca/#organization");
  assert.equal(organization.name, siteContent.name);
  // "JB" is what the brand is searched for, so it has to be a declared alternate name.
  assert.deepEqual(organization.alternateName, [...alternateNames]);
  assert.ok((organization.alternateName as string[]).includes("JB"));
  assert.deepEqual(organization.knowsAbout, [...knowsAbout]);
  const areas = JSON.stringify(organization.areaServed);
  assert.ok(areas.includes("Edmonton") && areas.includes("Alberta") && areas.includes("Canada"));

  // The logo is its own node so both logo and image can point at one image record.
  assert.deepEqual(organization.logo, { "@id": "https://jbautomate.ca/#logo" });
  assert.deepEqual(organization.image, { "@id": "https://jbautomate.ca/#logo" });
  const logo = nodesOfType("/", "ImageObject").find((node) => node["@id"] === "https://jbautomate.ca/#logo");
  assert.ok(logo, "the logo image node is missing");
  assert.equal(logo!.url, `https://jbautomate.ca${brandImages.logo.path}`);
  assert.equal(logo!.width, brandImages.logo.width);
});

test("the website node points at the organisation and claims no search endpoint", () => {
  const website = nodesOfType("/", "WebSite")[0];
  assert.deepEqual(website.publisher, { "@id": "https://jbautomate.ca/#organization" });
  assert.equal(website.inLanguage, "en-CA");
  // This site has no search page; advertising a SearchAction would be a false signal.
  assert.ok(!("potentialAction" in website));
});

test("every published service appears once, with a searchable name", () => {
  const services = nodesOfType("/", "Service");
  assert.equal(services.length, siteContent.services.items.length);
  for (const item of siteContent.services.items) {
    const node = services.find((service) => service["@id"] === `https://jbautomate.ca/#service-${item.id}`);
    assert.ok(node, `${item.id} has no Service node`);
    // A new service in site.ts must also get a searchable name here, not fall back to a label.
    assert.ok(serviceNames[item.id], `${item.id} is missing an entry in serviceNames`);
    assert.equal(node!.name, serviceNames[item.id].name);
    assert.equal(node!.description, item.description);
    assert.deepEqual(node!.provider, { "@id": "https://jbautomate.ca/#organization" });
  }
  // The offer catalog must list exactly the services that exist.
  const organization = nodesOfType("/", "Organization")[0];
  const offers = (organization.hasOfferCatalog as { itemListElement: { itemOffered: { "@id": string } }[] }).itemListElement;
  assert.deepEqual(
    offers.map((offer) => offer.itemOffered["@id"]),
    siteContent.services.items.map((item) => `https://jbautomate.ca/#service-${item.id}`),
  );
});

test("FAQ structured data mirrors the questions actually on the page", () => {
  const faq = nodesOfType("/", "FAQPage")[0];
  const questions = faq.mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  assert.equal(questions.length, siteContent.faq.items.length);
  questions.forEach((question, index) => {
    assert.equal(question.name, siteContent.faq.items[index].question);
    assert.equal(question.acceptedAnswer.text, siteContent.faq.items[index].answer);
  });
  // Only the page that renders the FAQ may claim it.
  assert.equal(nodesOfType("/privacy/", "FAQPage").length, 0);
});

test("breadcrumbs describe the real path to each page", () => {
  const home = nodesOfType("/", "BreadcrumbList")[0].itemListElement as { position: number; item: string }[];
  assert.deepEqual(home.map((entry) => entry.item), ["https://jbautomate.ca/"]);

  const privacy = nodesOfType("/privacy/", "BreadcrumbList")[0].itemListElement as { position: number; item: string; name: string }[];
  assert.deepEqual(privacy.map((entry) => entry.position), [1, 2]);
  assert.deepEqual(privacy.map((entry) => entry.item), ["https://jbautomate.ca/", "https://jbautomate.ca/privacy/"]);
  assert.equal(privacy[1].name, "Privacy Notice");
});

test("page nodes are absolute, canonical, and unique per route", () => {
  const seen = new Set<string>();
  for (const route of indexableRoutes) {
    const page = nodesOfType(route, "WebPage")[0];
    assert.equal(page.url, `https://jbautomate.ca${route}`);
    assert.equal(page["@id"], `https://jbautomate.ca${route}#webpage`);
    assert.ok(!seen.has(page["@id"] as string), `${route} reuses an @id`);
    seen.add(page["@id"] as string);
    assert.deepEqual(page.isPartOf, { "@id": "https://jbautomate.ca/#website" });
    assert.equal(page.name, routeSeo[route].title);
  }
});

test("absolute URLs are built without doubled or missing separators", () => {
  assert.equal(absoluteUrl(site, "/"), "https://jbautomate.ca/");
  assert.equal(absoluteUrl(site, "privacy/"), "https://jbautomate.ca/privacy/");
  assert.equal(absoluteUrl({ ...site, url: "https://jbautomate.ca/" }, "/privacy/"), "https://jbautomate.ca/privacy/");
});

test("the opt-out list covers the crawlers that collect training data", () => {
  for (const crawler of ["GPTBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "CCBot"]) {
    assert.ok(aiTrainingCrawlers.includes(crawler as never), `${crawler} must be listed so it can be blocked`);
  }
  // Answer engines are deliberately absent: blocking them would remove the site from
  // AI answers, which is the opposite of what the opt-out is for.
  for (const answerEngine of ["OAI-SearchBot", "PerplexityBot", "ChatGPT-User", "Claude-SearchBot"]) {
    assert.ok(!aiTrainingCrawlers.includes(answerEngine as never), `${answerEngine} must stay allowed`);
  }
});
