import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { serviceLandings } from "../src/content/ads.ts";

const launch = JSON.parse(await readFile(new URL("../ads/google-ads-launch.json", import.meta.url), "utf8"));

test("paid search has one focused landing page per launch offer", () => {
  assert.equal(serviceLandings.workflow.slug, "workflow-automation");
  assert.equal(serviceLandings.aiApps.slug, "custom-ai-apps");
  assert.match(serviceLandings.workflow.description, /Alberta businesses/);
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
