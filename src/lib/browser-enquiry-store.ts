import type { Enquiry } from "./contact-validation.ts";
import { getPublicEnquiryCaptureConfig } from "./public-enquiry-config.ts";

const TABLE = "website_enquiries";
const SESSION_STORAGE_KEY = "jb_enquiry_session";
const CAPTURE_TIMEOUT_MS = 5_000;

const config = getPublicEnquiryCaptureConfig({
  PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

function newId(): string | null {
  try {
    return crypto.randomUUID();
  } catch {
    return null;
  }
}

function sessionId(): string | null {
  const fresh = newId();
  if (!fresh) return null;

  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        existing,
      )
    ) {
      return existing;
    }

    sessionStorage.setItem(SESSION_STORAGE_KEY, fresh);
  } catch {
    // Storage can be unavailable in hardened/private browser modes.
    // The request can still use a one-off UUID without changing the
    // visitor's form experience.
  }

  return fresh;
}

/**
 * Attempts to store the enquiry in Supabase.
 *
 * Returns true only when Supabase confirms that the insert succeeded.
 * This allows the form to fire advertising conversion measurement only
 * after the business has actually received a stored lead.
 *
 * A failed Supabase request must never prevent the visitor from using
 * the existing email-app fallback.
 */
export async function captureStaticEnquiry(
  values: Enquiry,
): Promise<boolean> {
  if (!config) return false;

  const submissionId = newId();
  const enquirySessionId = sessionId();

  if (!submissionId || !enquirySessionId) {
    return false;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, CAPTURE_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url}/rest/v1/${TABLE}`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      signal: controller.signal,
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        submission_id: submissionId,
        session_id: enquirySessionId,
        name: values.name,
        email: values.email,
        company: values.company,
        message: values.message,
        source_path: window.location.pathname,
      }),
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
