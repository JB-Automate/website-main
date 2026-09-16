import { hasSingleLineControls, isValidEmail } from "./contact-validation.ts";

export interface ContactEnvironment {
  SITE_MODE?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_CONTACT_EMAIL?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_RATE_LIMIT_CONFIGURED?: string;
}

export interface ProductionContactConfig {
  available: true;
  origin: string;
  publicEmail: string;
  resendApiKey: string;
  fromEmail: string;
  toEmail: string;
}

export type ContactConfig =
  | ProductionContactConfig
  | { available: false; publicEmail: string | null };

const placeholderDomain = /(^|\.)(example\.(com|net|org)|example|invalid|test|localhost|local)$/i;

function singleLineSetting(value: string | undefined): string {
  return value && !hasSingleLineControls(value) ? value.trim() : "";
}

export function parseProductionEmail(value: string | undefined): string | null {
  const email = singleLineSetting(value);
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return isValidEmail(email) && !placeholderDomain.test(domain) ? email : null;
}

export function parseProductionOrigin(value: string | undefined): string | null {
  const setting = singleLineSetting(value);
  if (!URL.canParse(setting)) return null;

  const url = new URL(setting);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !isValidEmail(`origin@${url.hostname}`) ||
    placeholderDomain.test(url.hostname) ||
    /^[\d.]+$/.test(url.hostname)
  ) {
    return null;
  }
  return url.origin;
}

export function parseResendApiKey(value: string | undefined): string | null {
  const key = singleLineSetting(value);
  return /^re_[a-z0-9_-]{8,509}$/i.test(key) && !/placeholder|replace|example|your_api_key/i.test(key)
    ? key
    : null;
}

export function getContactConfig(env: ContactEnvironment): ContactConfig {
  const publicEmail = parseProductionEmail(env.PUBLIC_CONTACT_EMAIL);
  const unavailable: ContactConfig = { available: false, publicEmail };
  if (singleLineSetting(env.SITE_MODE) !== "production") return unavailable;

  const origin = parseProductionOrigin(env.PUBLIC_SITE_URL);
  const fromEmail = parseProductionEmail(env.CONTACT_FROM_EMAIL);
  const toEmail = parseProductionEmail(env.CONTACT_TO_EMAIL);
  const resendApiKey = parseResendApiKey(env.RESEND_API_KEY);

  // This is an operator confirmation, not an implementation or proof of rate limiting.
  if (
    !origin ||
    !publicEmail ||
    !fromEmail ||
    !toEmail ||
    !resendApiKey ||
    env.CONTACT_RATE_LIMIT_CONFIGURED !== "true"
  ) {
    return unavailable;
  }

  return { available: true, origin, publicEmail, resendApiKey, fromEmail, toEmail };
}
