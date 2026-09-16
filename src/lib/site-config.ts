import { parseProductionEmail } from "./contact-config";
import { mailtoHref } from "./contact-validation";

const publicEmail = parseProductionEmail(import.meta.env.PUBLIC_CONTACT_EMAIL);
export const siteConfig = {
  isPreview: import.meta.env.SITE_MODE !== "production",
  email: publicEmail || "hello@jbautomate.example",
  hasPublicEmail: publicEmail !== null,
  emailHref: publicEmail ? mailtoHref(publicEmail) : undefined,
  url: import.meta.env.PUBLIC_SITE_URL || "https://jbautomate.example",
};
