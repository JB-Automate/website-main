import { parseProductionEmail } from "./contact-config";
import { mailtoHref } from "./contact-validation";

// The published business address. An environment value overrides it for other deployments.
const businessEmail = "admin@jbautomate.ca";

const publicEmail = parseProductionEmail(import.meta.env.PUBLIC_CONTACT_EMAIL) ?? businessEmail;
const adsId = /^AW-\d{6,20}$/.test(import.meta.env.PUBLIC_GOOGLE_ADS_ID ?? "")
  ? import.meta.env.PUBLIC_GOOGLE_ADS_ID!
  : null;
const conversionLabel = /^[A-Za-z0-9_-]{5,100}$/.test(import.meta.env.PUBLIC_GOOGLE_ADS_CONVERSION_LABEL ?? "")
  ? import.meta.env.PUBLIC_GOOGLE_ADS_CONVERSION_LABEL!
  : null;
export const siteConfig = {
  isPreview: import.meta.env.SITE_MODE !== "production",
  email: publicEmail,
  hasPublicEmail: true,
  emailHref: mailtoHref(publicEmail),
  url: import.meta.env.PUBLIC_SITE_URL || "https://jbautomate.ca",
  ads: {
    enabled: adsId !== null && conversionLabel !== null,
    id: adsId,
    conversionLabel,
  },
};
