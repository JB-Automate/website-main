import { parseProductionEmail } from "./contact-config";
import { mailtoHref } from "./contact-validation";

// The published business address. An environment value overrides it for other deployments.
const businessEmail = "admin@jbautomate.ca";

const publicEmail = parseProductionEmail(import.meta.env.PUBLIC_CONTACT_EMAIL) ?? businessEmail;
export const siteConfig = {
  isPreview: import.meta.env.SITE_MODE !== "production",
  email: publicEmail,
  hasPublicEmail: true,
  emailHref: mailtoHref(publicEmail),
  url: import.meta.env.PUBLIC_SITE_URL || "https://jbautomate.ca",
};
