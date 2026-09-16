/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SITE_MODE?: "preview" | "production";
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_CONTACT_EMAIL?: string;
  readonly PRIVACY_NOTICE_APPROVED?: string;
}
