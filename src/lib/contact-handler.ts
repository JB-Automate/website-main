import { createHash } from "node:crypto";
import type { ContactConfig } from "./contact-config.ts";
import {
  CONTACT_FIELD_NAMES,
  CONTACT_LIMITS,
  MAX_CONTACT_BODY_BYTES,
  mailtoHref,
  validateContactInput,
} from "./contact-validation.ts";
import type { ContactFieldErrors, ContactFieldName, Enquiry } from "./contact-validation.ts";
import { EnquiryDeliveryError, sendEnquiry } from "./send-enquiry.ts";
import type { DeliveryFailureReason } from "./send-enquiry.ts";

export interface ContactReply {
  ok: boolean;
  message: string;
  errors?: ContactFieldErrors;
}

export type ContactOperationalEvent =
  | { event: "contact_unavailable" | "contact_delivery_accepted" }
  | { event: "contact_delivery_failed"; reason: DeliveryFailureReason; status?: number };

export interface ContactHandlerOptions {
  config: ContactConfig;
  fetch?: typeof globalThis.fetch;
  providerTimeoutMs?: number;
  log?: (event: ContactOperationalEvent) => void;
}

class ContactRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Invalid enquiry request");
    this.name = "ContactRequestError";
    this.status = status;
  }
}

function isBodyTransportError(error: unknown): boolean {
  return error instanceof TypeError ||
    (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"));
}

async function readContactBody(request: Request): Promise<string> {
  const length = request.headers.get("content-length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) throw new ContactRequestError(400);
    if (Number(length) > MAX_CONTACT_BODY_BYTES) throw new ContactRequestError(413);
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_CONTACT_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch (error) {
          if (!isBodyTransportError(error)) throw error;
        }
        throw new ContactRequestError(413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (isBodyTransportError(error)) throw new ContactRequestError(400);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function parseContactBody(body: string, isJson: boolean): unknown {
  if (isJson) {
    try {
      return JSON.parse(body);
    } catch (error) {
      if (error instanceof SyntaxError) throw new ContactRequestError(400);
      throw error;
    }
  }

  try {
    // URLSearchParams otherwise silently replaces malformed percent-encoded input.
    decodeURIComponent(body.replace(/\+/g, " "));
  } catch (error) {
    if (error instanceof URIError) throw new ContactRequestError(400);
    throw error;
  }

  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of new URLSearchParams(body)) {
    if (Object.hasOwn(values, key)) throw new ContactRequestError(400);
    values[key] = value;
  }
  return values;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

const nativeStyles = `:root{font-family:system-ui,sans-serif;color:#1e252b;background:#f7f6f2;color-scheme:light}body{margin:0;padding:2rem 1rem;line-height:1.6}main{max-width:42rem;margin:auto}h1{line-height:1.2}a{color:#294db9;text-underline-offset:.2em}form{margin:2rem 0}label{display:block;font-weight:600}input,textarea,button{font:inherit;box-sizing:border-box;max-width:100%}input,textarea{width:100%;padding:.65rem;border:1px solid #697982;border-radius:.25rem;background:white;color:inherit}textarea{resize:vertical}button{padding:.7rem 1rem;background:#294db9;color:white;border:0;border-radius:.25rem;cursor:pointer}:focus-visible{outline:3px solid #294db9;outline-offset:3px}.field-error{color:#96362b}.form-note{font-size:.9rem}.wordmark{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-weight:600;font-size:.92em;letter-spacing:.01em}.contact-honeypot{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}`;
const nativeStyleHash = createHash("sha256").update(nativeStyles).digest("base64");

function nativeRetryForm(values: Enquiry, errors: ContactFieldErrors = {}): string {
  const firstInvalid = CONTACT_FIELD_NAMES.find((field) => errors[field]);
  function field(name: Exclude<ContactFieldName, "message">, label: string, autocomplete: string): string {
    const error = errors[name];
    return `<p class="form-field"><label for="enquiry-${name}">${label}</label>
      <input id="enquiry-${name}" name="${name}" type="${name === "email" ? "email" : "text"}"
        autocomplete="${autocomplete}" maxlength="${CONTACT_LIMITS[name]}" value="${escapeHtml(values[name])}"
        ${name !== "company" ? "required" : ""}
        ${error ? `aria-invalid="true" aria-describedby="enquiry-${name}-error"` : ""}
        ${firstInvalid === name ? "autofocus" : ""}>
      ${error ? `<span class="field-error" id="enquiry-${name}-error">${escapeHtml(error)}</span>` : ""}</p>`;
  }

  return `<form class="contact-form" id="enquiry-form" action="/api/contact" method="post" accept-charset="UTF-8" aria-label="Enquiry form">
    ${field("name", "Your name", "name")}
    ${field("email", "Email address", "email")}
    ${field("company", "Business name (optional)", "organization")}
    <p class="form-field"><label for="enquiry-message">What would you like to make easier or build?</label>
      <textarea id="enquiry-message" name="message" required maxlength="${CONTACT_LIMITS.message}" rows="7"
        aria-describedby="enquiry-information${errors.message ? " enquiry-message-error" : ""}"
        ${errors.message ? 'aria-invalid="true"' : ""} ${firstInvalid === "message" ? "autofocus" : ""}>${escapeHtml(values.message)}</textarea>
      ${errors.message ? `<span class="field-error" id="enquiry-message-error">${escapeHtml(errors.message)}</span>` : ""}</p>
    <div class="contact-honeypot" aria-hidden="true"><label for="enquiry-website">Leave this field blank</label><input id="enquiry-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
    <p class="form-note" id="enquiry-information">Share a high-level summary. Please do not include confidential business information or personal records. <a href="/privacy/">Read our privacy notice.</a></p>
    <button class="button button--primary form-submit" type="submit">Send your enquiry</button>
  </form>`;
}

function nativeResponse(reply: ContactReply, publicEmail: string | null, values?: Enquiry): string {
  const title = reply.ok ? "Thank you for your enquiry" : "Your enquiry needs attention";
  const emailGuidance = publicEmail
    ? `You can also email <a href="${escapeHtml(mailtoHref(publicEmail))}">${escapeHtml(publicEmail)}</a>.`
    : "A direct email option will appear on the website when contact details are available.";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title} | JB Automate</title><style>${nativeStyles}</style></head>
    <body><main><a href="/"><span class="wordmark">JB Automate</span></a><h1>${title}</h1>
    <p role="${reply.ok ? "status" : "alert"}">${escapeHtml(reply.message)}</p>
    ${!reply.ok ? `<p>${emailGuidance}</p>` : ""}
    ${!reply.ok && values ? nativeRetryForm(values, reply.errors) : ""}
    <p><a href="/#contact">Return to the contact section</a></p>
    <p><a href="/privacy/">Privacy notice</a></p></main></body></html>`;
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept");
  if (!accept || accept.trim() === "*/*") {
    return /^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "");
  }
  return accept.split(",").some((entry) =>
    /^application\/json(?:\s*;|$)/i.test(entry.trim()) &&
    !/;\s*q=0(?:\.0*)?(?:\s*;|\s*$)/i.test(entry),
  );
}

export async function handleContactRequest(request: Request, options: ContactHandlerOptions): Promise<Response> {
  const { config } = options;
  const log = options.log ?? ((event: ContactOperationalEvent) => console.info("Contact endpoint", event));

  function respond(status: number, message: string, errors?: ContactFieldErrors, values?: Enquiry): Response {
    const reply: ContactReply = { ok: status === 200, message, ...(errors ? { errors } : {}) };
    const json = wantsJson(request);
    const headers = new Headers({
      "Content-Type": json ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Vary": "Accept",
      "Content-Security-Policy": `default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; style-src 'sha256-${nativeStyleHash}'`,
    });
    if (status === 405) headers.set("Allow", "POST");
    const body = json ? JSON.stringify(reply) : nativeResponse(reply, config.publicEmail, values);
    return new Response(request.method === "HEAD" ? null : body, { status, headers });
  }

  if (request.method !== "POST") {
    return respond(405, "Please use the enquiry form to send a message, or email us directly.");
  }
  if (!config.available) {
    log({ event: "contact_unavailable" });
    return respond(503, "Enquiry sending is unavailable right now. Please use the email option if one is listed.");
  }
  if (request.headers.get("origin") !== config.origin) {
    return respond(403, "This enquiry could not be sent. Please return to the website and try again, or email us directly.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (
    !/^application\/(?:json|x-www-form-urlencoded)(?:\s*;\s*charset=(?:"utf-8"|utf-8))?\s*$/i.test(contentType) ||
    !["", "identity"].includes((request.headers.get("content-encoding") ?? "").toLowerCase())
  ) {
    return respond(415, "This enquiry could not be sent. Please use the enquiry form or email us directly.");
  }

  let input: unknown;
  try {
    input = parseContactBody(await readContactBody(request), /^application\/json/i.test(contentType));
  } catch (error) {
    if (error instanceof ContactRequestError) {
      return respond(error.status, error.status === 413
        ? "Your enquiry is too long to send. Please shorten it and try again, or email us directly."
        : "This enquiry could not be sent. Please check your details and try again, or email us directly.");
    }
    throw error;
  }

  const result = validateContactInput(input);
  if (!result.ok) {
    if (result.reason === "invalid_fields") {
      return respond(422, "Please check the highlighted fields. Your enquiry has not been sent.", result.errors, result.values);
    }
    return respond(400, "This enquiry could not be sent. Please use the enquiry form or email us directly.");
  }

  try {
    await sendEnquiry(result.values, config, { fetch: options.fetch, timeoutMs: options.providerTimeoutMs });
  } catch (error) {
    if (error instanceof EnquiryDeliveryError) {
      log({
        event: "contact_delivery_failed",
        reason: error.reason,
        ...(error.providerStatus !== undefined ? { status: error.providerStatus } : {}),
      });
      return respond(
        error.reason === "timeout" ? 504 : 502,
        error.reason === "rejected"
          ? "We couldn’t send your enquiry. Please try again or email us directly."
          : "We couldn’t confirm your enquiry was sent. Please try again or email us directly.",
        undefined,
        result.values,
      );
    }
    throw error;
  }

  log({ event: "contact_delivery_accepted" });
  return respond(200, "Your enquiry has been sent. Thank you for getting in touch.");
}
