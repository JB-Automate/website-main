import type { APIRoute } from "astro";
import { getContactConfig } from "../../lib/contact-config.ts";
import { handleContactRequest } from "../../lib/contact-handler.ts";
import { createEnquiryStore } from "../../lib/enquiry-store.ts";

export const prerender = false;

// Optional. Without a database URL the endpoint behaves exactly as before and stores nothing.
const store = createEnquiryStore({
  DATABASE_URL: process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL,
  ENQUIRY_HASH_SALT: process.env.ENQUIRY_HASH_SALT ?? import.meta.env.ENQUIRY_HASH_SALT,
});

export const ALL: APIRoute = ({ request }) => handleContactRequest(request, {
  store,
  config: getContactConfig({
    SITE_MODE: process.env.SITE_MODE ?? import.meta.env.SITE_MODE,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL ?? import.meta.env.PUBLIC_SITE_URL,
    PUBLIC_CONTACT_EMAIL: process.env.PUBLIC_CONTACT_EMAIL ?? import.meta.env.PUBLIC_CONTACT_EMAIL,
    RESEND_API_KEY: process.env.RESEND_API_KEY ?? import.meta.env.RESEND_API_KEY,
    CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL ?? import.meta.env.CONTACT_FROM_EMAIL,
    CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL ?? import.meta.env.CONTACT_TO_EMAIL,
    CONTACT_RATE_LIMIT_CONFIGURED: process.env.CONTACT_RATE_LIMIT_CONFIGURED ?? import.meta.env.CONTACT_RATE_LIMIT_CONFIGURED,
  }),
});
