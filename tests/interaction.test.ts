import assert from "node:assert/strict";
import { test } from "node:test";
import { canPinHero, sceneProgress, serviceProgress, stageProgress, travelProgress } from "../src/lib/interaction.ts";
import { siteContent } from "../src/content/site.ts";

test("background ink drawing retains its earlier entry timing", () => {
  assert.equal(sceneProgress(1200, 600, 1000), 0);
  assert.equal(sceneProgress(-600, 600, 1000), 1);
  const entering = sceneProgress(750, 600, 1000);
  const visible = sceneProgress(400, 600, 1000);
  assert.ok(entering > 0 && entering < visible && visible < 1);
});

test("service scenes wait until their artwork is substantially on screen", () => {
  assert.equal(serviceProgress(1100, 500, 1000, 100), 0);
  assert.equal(serviceProgress(825, 500, 1000, 100), 0);
  assert.equal(serviceProgress(600, 500, 1000, 100), 0);
  assert.equal(serviceProgress(498, 500, 1000, 100), 0);
  assert.equal(serviceProgress(318, 500, 1000, 100), .5);
  assert.equal(serviceProgress(138, 500, 1000, 100), 1);
});

test("service transitions remain reversible and complete before their artwork leaves", () => {
  const tops = [498, 408, 318, 228, 138];
  const forward = tops.map((top) => serviceProgress(top, 500, 1000, 100));
  assert.deepEqual(forward, [0, .25, .5, .75, 1]);
  assert.deepEqual(tops.toReversed().map((top) => serviceProgress(top, 500, 1000, 100)), forward.toReversed());
  assert.equal(serviceProgress(-1000, 500, 1000, 100), 1);
});

test("service pacing follows the visible viewport on phones and short windows", () => {
  for (const { viewport, header } of [{ viewport: 844, header: 73 }, { viewport: 450, header: 79 }]) {
    const available = viewport - header;
    const centeredTop = header + available * .52 - 250;
    assert.equal(serviceProgress(viewport, 500, viewport, header), 0);
    assert.ok(Math.abs(serviceProgress(centeredTop, 500, viewport, header) - .5) < 1e-9);
    assert.equal(serviceProgress(-500, 500, viewport, header), 1);
  }
});

test("hero travel starts unassembled and follows actual scroll in both directions", () => {
  assert.equal(travelProgress(80, 720, 80), 0);
  assert.equal(travelProgress(-280, 720, 80), .5);
  assert.equal(travelProgress(-640, 720, 80), 1);
  assert.equal(travelProgress(-1000, 720, 80), 1);
  assert.equal(travelProgress(100, 720, 80), 0);
  const tops = [80, -64, -280, -496, -640];
  const forward = tops.map((top) => travelProgress(top, 720, 80));
  const reverse = tops.toReversed().map((top) => travelProgress(top, 720, 80));
  assert.deepEqual(reverse, forward.toReversed());
  assert.deepEqual(forward, [0, .2, .5, .8, 1]);
});

test("animation stages hold their start and end without timers", () => {
  assert.equal(stageProgress(0, .2, .8), 0);
  assert.equal(stageProgress(.2, .2, .8), 0);
  assert.ok(Math.abs(stageProgress(.5, .2, .8) - .5) < Number.EPSILON);
  assert.equal(stageProgress(.8, .2, .8), 1);
  assert.equal(stageProgress(1, .2, .8), 1);
  assert.equal(stageProgress(-1, .2, .8), 0);
  assert.equal(stageProgress(2, .2, .8), 1);
});

test("sticky hero eligibility considers available height, not just desktop width", () => {
  assert.equal(canPinHero(1440, 900, 88, 780), true);
  assert.equal(canPinHero(1920, 1080, 88, 840), true);
  assert.equal(canPinHero(1024, 1024, 78, 700), false);
  assert.equal(canPinHero(390, 844, 72, 850), false);
  assert.equal(canPinHero(1440, 700, 88, 580), false);
  assert.equal(canPinHero(1440, 900, 88, 820), false);
  assert.equal(canPinHero(1440, 900, 950, 780), false);
});

test("scroll progress stays finite and bounded across viewport sizes", () => {
  for (const viewport of [320, 640, 900, 1440]) {
    for (const height of [0, 400, 900]) {
      for (const top of [-2000, -20, 0, 200, 1600]) {
        for (const progress of [sceneProgress(top, height, viewport), sceneProgress(top, height, viewport, 88),
          serviceProgress(top, height, viewport), serviceProgress(top, height, viewport, 88)]) {
          assert.ok(Number.isFinite(progress) && progress >= 0 && progress <= 1);
        }
      }
    }
  }
});

test("in-view scenes finish while their outcome is still visible below the header", () => {
  assert.equal(sceneProgress(950, 500, 900, 88), 0);
  assert.equal(sceneProgress(150, 500, 900, 88), 1);
  assert.ok(sceneProgress(550, 500, 900, 88) > 0);
  assert.ok(sceneProgress(550, 500, 900, 88) < 1);
});

test("invalid geometry and stages surface errors rather than invalid animations", () => {
  for (const progress of [sceneProgress, serviceProgress]) {
    assert.throws(() => progress(Number.NaN, 500, 900), RangeError);
    assert.throws(() => progress(0, -1, 900), RangeError);
    assert.throws(() => progress(0, 500, 0), RangeError);
    assert.throws(() => progress(0, 500, 900, -1), RangeError);
  }
  assert.throws(() => travelProgress(0, 0, 80), RangeError);
  assert.throws(() => travelProgress(Infinity, 700, 80), RangeError);
  assert.throws(() => travelProgress(0, 700, -1), RangeError);
  assert.throws(() => stageProgress(.5, .8, .2), RangeError);
  assert.throws(() => stageProgress(.5, .5, .5), RangeError);
  assert.throws(() => stageProgress(.5, -.1, 1), RangeError);
  assert.throws(() => stageProgress(.5, 0, 1.1), RangeError);
  assert.throws(() => stageProgress(Number.NaN, 0, 1), RangeError);
  assert.throws(() => canPinHero(0, 900, 80, 700), RangeError);
  assert.throws(() => canPinHero(1440, 900, 80, 0), RangeError);
  assert.throws(() => canPinHero(1440, 900, -1, 700), RangeError);
});

test("all three service chapters retain their order and one readable illustrative task", () => {
  assert.deepEqual(siteContent.services.items.map((service) => service.id), ["apps", "workflows", "websites"]);
  const { task } = siteContent.work;
  assert.ok(task.label && task.heading && task.lines.length === 2);
});

test("section content no longer carries decorative eyebrow copy", () => {
  for (const section of Object.values(siteContent)) {
    if (section && typeof section === "object") assert.equal("eyebrow" in section, false);
  }
});
