import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { serviceLandings } from "../src/content/ads.ts";

const launch = JSON.parse(await readFile(new URL("../ads/google-ads-launch.json", import.meta.url), "utf8"));

test("the shared layout installs one Google tag for every page", async () => {
  const layout = await readFile(new URL("../src/layouts/BaseLayout.astro", import.meta.url), "utf8");
  const consent = await readFile(new URL("../src/components/AdvertisingConsent.astro", import.meta.url), "utf8");
  assert.equal(layout.match(/googletagmanager\.com\/gtag\/js\?id=AW-18455975650/g)?.length, 1);
  const bootstrap = await readFile(new URL("../src/scripts/google-tag.js", import.meta.url), "utf8");
  assert.equal(bootstrap.match(/gtag\("config", "AW-18455975650"\)/g)?.length, 1);
  assert.doesNotMatch(consent, /createElement\("script"\)|googletagmanager\.com\/gtag\/js/);
});

test("paid search has one focused landing page per launch offer", () => {
  assert.equal(serviceLandings.workflow.slug, "workflow-automation");
  assert.equal(serviceLandings.aiApps.slug, "custom-ai-apps");
  assert.match(serviceLandings.workflow.title, /Workflow Automation/);
  assert.match(serviceLandings.aiApps.title, /Custom AI App Development/);
  assert.match(serviceLandings.workflow.description, /workflow automation/i);
  assert.match(serviceLandings.aiApps.description, /internal AI tools/);
  for (const page of Object.values(serviceLandings)) {
    assert.equal(page.outcomes.length, 3);
    assert.equal(page.examples.length, 4);
    assert.equal(page.process.length, 3);
    assert.equal(page.faqs.length, 4);
  }
});

test("the launch specification cannot accidentally create a live or non-Canadian account", () => {
  assert.equal(launch.account.currency, "CAD");
  assert.equal(launch.account.timeZone, "America/Edmonton");
  assert.equal(launch.account.initialStatus, "PAUSED");
  assert.equal(launch.sharedSettings.locations[0], "Alberta, Canada");
  assert.equal(launch.sharedSettings.locationOption, "PRESENCE");
  assert.equal(launch.sharedSettings.network, "GOOGLE_SEARCH_ONLY");
  assert.equal(launch.sharedSettings.aiMax, false);
  assert.equal(launch.sharedSettings.finalUrlExpansion, false);
  assert.deepEqual(launch.campaigns.map((campaign: { dailyBudgetCad: number }) => campaign.dailyBudgetCad), [3, 2]);
  assert.equal(launch.campaigns.reduce((total: number, campaign: { dailyBudgetCad: number }) => total + campaign.dailyBudgetCad, 0), 5);
});

test("responsive search ad copy fits platform limits", () => {
  for (const campaign of launch.campaigns) {
    assert.match(campaign.finalUrl, /^https:\/\/jbautomate\.ca\/(workflow-automation|custom-ai-apps)\/$/);
    for (const ad of campaign.responsiveSearchAds) {
      assert.ok(ad.headlines.length >= 8);
      assert.ok(ad.descriptions.length >= 3);
      for (const headline of ad.headlines) assert.ok([...headline].length <= 30, headline);
      for (const description of ad.descriptions) assert.ok([...description].length <= 90, description);
    }
  }
});

test("initial targeting stays exact and phrase with a cross-campaign negative list", () => {
  for (const campaign of launch.campaigns) {
    for (const adGroup of campaign.adGroups) {
      assert.ok(adGroup.keywords.length >= 5);
      for (const keyword of adGroup.keywords) {
        assert.match(keyword, /^(\[.+\]|".+")$/);
      }
    }
  }
  for (const negative of ["jobs", "free", "automotive", "home automation", "industrial automation"]) {
    assert.ok(launch.sharedNegativeKeywords.includes(negative), negative);
  }
});

test("consented successful leads send the exact conversion; other visits do not", async () => {
  const { runInNewContext } = await import("node:vm");
  const source = await readFile(new URL("../src/scripts/advertising-consent.js", import.meta.url), "utf8");
  for (const choice of [null, "denied", "granted"]) {
    const calls: unknown[][] = [];
    const listeners: Record<string, (event: unknown) => void> = {};
    const banner = { hidden: true, querySelectorAll: () => [] };
    const storage = new Map(choice ? [["jb-ads-consent", choice]] : []);
    const store = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    runInNewContext(source, {
      adsId: "AW-18455975650", conversionLabel: "BeTCCJ39x_scEOKtv-BE",
      document: { querySelector: () => banner },
      localStorage: store, sessionStorage: store, URLSearchParams,
      CustomEvent: class { type: string; constructor(type: string) { this.type = type; } },
      window: {
        location: { search: "" },
        gtag: (...args: unknown[]) => calls.push(args),
        dispatchEvent: () => {},
        addEventListener: (name: string, handler: (event: unknown) => void) => { listeners[name] = handler; },
      },
    });
    assert.equal(banner.hidden, choice !== null);
    assert.equal(calls.filter(call => call[0] === "event").length, 0, "page views must not count as conversions");
    listeners["jb:lead-submitted"]({ detail: {} });
    assert.equal(calls.filter(call => call[0] === "event").length, 0);
    listeners["jb:lead-submitted"]({ detail: { email: "tracking-test@example.com" } });
    const conversions = calls.filter(call => call[0] === "event");
    assert.equal(conversions.length, choice === "granted" ? 1 : 0);
    if (choice === "granted") {
      assert.equal(conversions[0][1], "conversion");
      assert.equal((conversions[0][2] as { send_to: string }).send_to, "AW-18455975650/BeTCCJ39x_scEOKtv-BE");
    }
  }
});
