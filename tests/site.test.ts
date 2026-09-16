import assert from "node:assert/strict";
import { test } from "node:test";
import { validateProductionReadiness } from "../scripts/check-production.mjs";
import { siteContent } from "../src/content/site.ts";
import { mailtoHref } from "../src/lib/contact-validation.ts";
import { getContactConfig } from "../src/lib/contact-config.ts";

const configured = {
  SITE_MODE: "production",
  PUBLIC_SITE_URL: "https://business-domain.ca",
  PUBLIC_CONTACT_EMAIL: "hello@business-domain.ca",
  CONTACT_FROM_EMAIL: "enquiries@business-domain.ca",
  CONTACT_TO_EMAIL: "inbox@business-domain.ca",
  RESEND_API_KEY: "re_synthetic_test_key",
  CONTACT_RATE_LIMIT_CONFIGURED: "true",
  PRIVACY_NOTICE_APPROVED: "true",
};
const retention = "An approved retention policy supplied by the business.";

test("the default is a safe preview, not an accidentally live form", () => {
  assert.deepEqual(validateProductionReadiness({}, siteContent.privacy.retention), []);
});

test("invalid site modes do not silently publish", () => {
  assert.match(validateProductionReadiness({ SITE_MODE: "prod" }, retention)[0], /SITE_MODE/);
});

test("fully supplied production configuration passes", () => {
  assert.deepEqual(validateProductionReadiness(configured, retention), []);
  assert.deepEqual(validateProductionReadiness(configured, siteContent.privacy.retention), []);
});

test("production requires real contact details and explicit operating decisions", () => {
  const errors = validateProductionReadiness({ SITE_MODE: "production" }, "");
  for (const key of ["PUBLIC_SITE_URL", "PUBLIC_CONTACT_EMAIL", "CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL", "RESEND_API_KEY", "CONTACT_RATE_LIMIT_CONFIGURED", "PRIVACY_NOTICE_APPROVED"]) {
    assert.ok(errors.some((error) => error.includes(key)), key);
  }
  assert.ok(errors.some((error) => error.includes("retention")));
});

test("production rejects unsafe or placeholder site URLs", () => {
  for (const value of ["not-a-url", "http://business-domain.ca", "https://jbautomate.example", "https://example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://business-domain.ca/extra", "https://user:password@business-domain.ca", "https://business-domain.ca/?x=1"]) {
    assert.ok(validateProductionReadiness({ ...configured, PUBLIC_SITE_URL: value }, retention).some((error) => error.includes("PUBLIC_SITE_URL")), value);
  }
});

test("production rejects placeholder and malformed email addresses", () => {
  for (const value of ["hello@jbautomate.example", "hello@example.com", "hello@business.test", "not-an-email", "a@business-domain.ca\r\nBcc: target@business-domain.ca"]) {
    assert.ok(validateProductionReadiness({ ...configured, PUBLIC_CONTACT_EMAIL: value }, retention).some((error) => error.includes("PUBLIC_CONTACT_EMAIL")), value);
  }
});

test("approval alone does not allow unfinished privacy copy to ship", () => {
  for (const draft of ["", "   ", "[DRAFT: confirm retention]", "TODO: write the retention practice", "PLACEHOLDER"]) {
    assert.ok(validateProductionReadiness(configured, draft).some((error) => error.includes("retention")), draft);
  }
  // The published retention practice must stay finished, not slip back to a placeholder.
  assert.deepEqual(validateProductionReadiness(configured, siteContent.privacy.retention), []);
});

test("a build cannot claim rate limiting is ready by default", () => {
  assert.ok(validateProductionReadiness({ ...configured, CONTACT_RATE_LIMIT_CONFIGURED: "false" }, retention).some((error) => error.includes("rate limit")));
});

test("a static build without a delivery endpoint still requires a real address and finished privacy copy", () => {
  const staticBuild = {
    SITE_MODE: "production",
    ENQUIRY_DELIVERY: "email_app",
    PUBLIC_SITE_URL: "https://business-domain.ca",
    PUBLIC_CONTACT_EMAIL: "hello@business-domain.ca",
    PRIVACY_NOTICE_APPROVED: "true",
  };
  assert.deepEqual(validateProductionReadiness(staticBuild, retention), []);

  for (const [key, value] of [["PUBLIC_CONTACT_EMAIL", "hello@example.com"], ["PRIVACY_NOTICE_APPROVED", "false"]]) {
    assert.ok(validateProductionReadiness({ ...staticBuild, [key]: value }, retention).length > 0, key);
  }
  assert.ok(validateProductionReadiness({ ...staticBuild }, "[DRAFT: unfinished]").some((error) => error.includes("retention")));
  assert.match(validateProductionReadiness({ ...staticBuild, ENQUIRY_DELIVERY: "maybe" }, retention)[0], /ENQUIRY_DELIVERY/);
});

test("the publish guard uses the same email-delivery rules as the running endpoint", () => {
  for (const override of [
    { RESEND_API_KEY: "not-a-provider-key" },
    { RESEND_API_KEY: "re_\nabc1234567890" },
    { PUBLIC_SITE_URL: "https://intranet" },
    { PUBLIC_CONTACT_EMAIL: "double..dot@business-domain.ca" },
    { CONTACT_FROM_EMAIL: "sender@-invalid-domain.ca" },
  ]) {
    const env = { ...configured, ...override };
    assert.equal(getContactConfig(env).available, false);
    assert.ok(validateProductionReadiness(env, retention).length > 0);
  }
});

test("mailto links encode reserved mailbox characters without losing the address separator", () => {
  assert.equal(mailtoHref("hello@business-domain.ca"), "mailto:hello@business-domain.ca");
  assert.equal(mailtoHref("enquiries+web?info@business-domain.ca"), "mailto:enquiries%2Bweb%3Finfo@business-domain.ca");
  assert.throws(() => mailtoHref("invalid"), TypeError);
});

test("proof is factual and example content is explicitly labeled", () => {
  assert.equal(siteContent.proof.verifiedOutcome, null);
  assert.match(siteContent.proof.heading, /Government of Alberta/);
  assert.equal(siteContent.work.label, "Illustrative example");
});

test("comparison covers the agreed business concerns with a visible scope note", () => {
  assert.equal(siteContent.comparison.leftHeading, "What Claude gives out");
  assert.equal(siteContent.comparison.rightHeading, "What we provide");
  assert.deepEqual(siteContent.comparison.rows.map((row) => row.criterion), [
    "No prompt homework",
    "Data security",
    "Privacy",
    "Faster workflows",
    "More consistent work",
    "Expert-built architecture",
    "Support after launch",
  ]);
  assert.match(siteContent.comparison.note, /not the full capabilities or enterprise offerings of Claude/);
});
