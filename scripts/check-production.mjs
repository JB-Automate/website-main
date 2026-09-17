import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";
import { siteContent } from "../src/content/site.ts";
import { parseProductionEmail, parseProductionOrigin, parseResendApiKey } from "../src/lib/contact-config.ts";
import { parsePublicSupabaseUrl, parseSupabasePublishableKey } from "../src/lib/public-enquiry-config.ts";

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} retention
 * @returns {string[]}
 */
export function validateProductionReadiness(env, retention) {
  const mode = env.SITE_MODE || "preview";
  if (mode !== "preview" && mode !== "production") {
    return ["SITE_MODE must be preview or production."];
  }
  if (mode === "preview") return [];

  // "server" runs the delivery endpoint; "email_app" is a static build where the form
  // hands the enquiry to the visitor's own email application instead.
  const delivery = env.ENQUIRY_DELIVERY || "server";
  if (delivery !== "server" && delivery !== "email_app") {
    return ["ENQUIRY_DELIVERY must be server or email_app."];
  }

  const errors = [];
  if (!parseProductionOrigin(env.PUBLIC_SITE_URL)) {
    errors.push("PUBLIC_SITE_URL must be a real HTTPS origin without a path, credentials, query, or fragment.");
  }
  if (!parseProductionEmail(env.PUBLIC_CONTACT_EMAIL)) {
    errors.push("PUBLIC_CONTACT_EMAIL must be a real, plain email address, not a placeholder.");
  }

  if (delivery === "email_app") {
    if (!parsePublicSupabaseUrl(env.PUBLIC_SUPABASE_URL)) {
      errors.push("PUBLIC_SUPABASE_URL must be a real HTTPS Supabase project origin without a path, credentials, query, or fragment.");
    }
    if (!parseSupabasePublishableKey(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
      errors.push("PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase sb_publishable_ key.");
    }
  }

  if (delivery === "server") {
    for (const key of ["CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL"]) {
      if (!parseProductionEmail(env[key])) {
        errors.push(`${key} must be a real, plain email address, not a placeholder.`);
      }
    }
    if (!parseResendApiKey(env.RESEND_API_KEY)) {
      errors.push("RESEND_API_KEY must be a validly formatted credential in the server environment.");
    }
    if (env.CONTACT_RATE_LIMIT_CONFIGURED !== "true") {
      errors.push("Configure a host-level rate limit for POST /api/contact, then set CONTACT_RATE_LIMIT_CONFIGURED=true.");
    }
  }

  if (env.PRIVACY_NOTICE_APPROVED !== "true") {
    errors.push("Finalize the privacy notice and set PRIVACY_NOTICE_APPROVED=true.");
  }
  if (!retention.trim() || /DRAFT|TODO|PLACEHOLDER|\[.*\]/i.test(retention)) {
    errors.push("Replace the draft retention policy in src/content/site.ts with the actual policy.");
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv("production", process.cwd(), "");
  const errors = validateProductionReadiness(env, siteContent.privacy.retention);
  if (errors.length) {
    console.error("Production build blocked:\n" + errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.info(env.SITE_MODE === "production" ? "Production configuration accepted." : "Building a noindex preview; unconfigured enquiries remain unavailable.");
  }
}
