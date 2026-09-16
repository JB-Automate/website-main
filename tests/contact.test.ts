import assert from "node:assert/strict";
import { test } from "node:test";
import { getContactConfig } from "../src/lib/contact-config.ts";
import type { ContactEnvironment, ProductionContactConfig } from "../src/lib/contact-config.ts";
import {
  CONTACT_FIELD_NAMES,
  CONTACT_LIMITS,
  MAX_CONTACT_BODY_BYTES,
  isValidEmail,
  validateContactInput,
} from "../src/lib/contact-validation.ts";
import { handleContactRequest } from "../src/lib/contact-handler.ts";
import type { ContactHandlerOptions, ContactOperationalEvent } from "../src/lib/contact-handler.ts";
import { EnquiryDeliveryError, sendEnquiry } from "../src/lib/send-enquiry.ts";

const environment: ContactEnvironment = {
  SITE_MODE: "production",
  PUBLIC_SITE_URL: "https://business-domain.ca",
  PUBLIC_CONTACT_EMAIL: "hello@business-domain.ca",
  RESEND_API_KEY: "re_synthetic_test_key",
  CONTACT_FROM_EMAIL: "enquiries@business-domain.ca",
  CONTACT_TO_EMAIL: "inbox@business-domain.ca",
  CONTACT_RATE_LIMIT_CONFIGURED: "true",
};
const config: ProductionContactConfig = (() => {
  const result = getContactConfig(environment);
  assert.ok(result.available);
  return result;
})();
const input = {
  name: "Alex Visitor",
  email: "alex+enquiry@gmail.com",
  company: "A small business",
  message: "We would like to reduce manual handoffs.",
  website: "",
};
const receiptId = "4ea44233-b587-4d62-9525-b570354f7912";
const accepted = () => Response.json({ id: receiptId });
const noFetch: typeof globalThis.fetch = async () => {
  throw new Error("This request must not reach the email provider.");
};

function provider(response: () => Response = accepted) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return response();
  };
  return { fetch, calls };
}

function rawRequest(
  body: BodyInit,
  contentType = "application/json",
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit & { duplex?: "half" } = {
    method: "POST",
    headers: {
      Origin: config.origin,
      "Content-Type": contentType,
      Accept: "application/json",
      ...headers,
    },
    body,
  };
  if (body instanceof ReadableStream) init.duplex = "half";
  return new Request(`${config.origin}/api/contact`, init);
}

function jsonRequest(value: unknown = input, headers: Record<string, string> = {}): Request {
  return rawRequest(JSON.stringify(value), "application/json", headers);
}

function nativeRequest(value: Record<string, string> = input): Request {
  return rawRequest(new URLSearchParams(value), "application/x-www-form-urlencoded;charset=UTF-8", {
    Accept: "text/html,application/xhtml+xml",
  });
}

function handle(request: Request, options: Partial<ContactHandlerOptions> = {}): Promise<Response> {
  return handleContactRequest(request, { config, fetch: noFetch, log: () => {}, ...options });
}

async function assertFailure(response: Response, expectedStatus: number) {
  assert.equal(response.status, expectedStatus);
  const reply = await response.json();
  assert.equal(reply.ok, false);
  assert.equal(typeof reply.message, "string");
  assert.equal(response.headers.get("cache-control"), "no-store");
  return reply;
}

test("configuration defaults to an unavailable preview without exposing private settings", () => {
  assert.deepEqual(getContactConfig({}), { available: false, publicEmail: null });
  assert.deepEqual(getContactConfig({ ...environment, SITE_MODE: "preview" }), {
    available: false,
    publicEmail: environment.PUBLIC_CONTACT_EMAIL,
  });
  for (const SITE_MODE of ["", "prod", "development"]) {
    assert.equal(getContactConfig({ ...environment, SITE_MODE }).available, false);
  }
});

test("complete explicit production configuration enables delivery and normalizes the origin", () => {
  const result = getContactConfig({
    ...environment,
    PUBLIC_SITE_URL: "https://BUSINESS-DOMAIN.ca/",
    PUBLIC_CONTACT_EMAIL: " hello@business-domain.ca ",
  });
  assert.ok(result.available);
  assert.equal(result.origin, "https://business-domain.ca");
  assert.equal(result.publicEmail, "hello@business-domain.ca");
  assert.equal(result.fromEmail, environment.CONTACT_FROM_EMAIL);
  assert.equal(result.toEmail, environment.CONTACT_TO_EMAIL);
});

test("every production environment setting is required", () => {
  for (const name of Object.keys(environment) as (keyof ContactEnvironment)[]) {
    assert.equal(getContactConfig({ ...environment, [name]: undefined }).available, false, name);
  }
});

test("production rejects unsafe, local, placeholder, and non-origin URLs", () => {
  for (const PUBLIC_SITE_URL of [
    "not a URL",
    "http://business-domain.ca",
    "https://example.com",
    "https://preview.example.net",
    "https://business.example",
    "https://business.test",
    "https://business.invalid",
    "https://localhost",
    "https://business.local",
    "https://127.0.0.1",
    "https://[::1]",
    "https://business-domain.ca/path",
    "https://business-domain.ca/?query=1",
    "https://business-domain.ca/#fragment",
    "https://user:password@business-domain.ca",
    "https://business-domain.ca\r\n",
  ]) {
    assert.equal(getContactConfig({ ...environment, PUBLIC_SITE_URL }).available, false, PUBLIC_SITE_URL);
  }
});

test("public, sender, and recipient settings must be plain non-placeholder email addresses", () => {
  for (const name of ["PUBLIC_CONTACT_EMAIL", "CONTACT_FROM_EMAIL", "CONTACT_TO_EMAIL"]) {
    for (const value of [
      "not an email",
      "hello@example.com",
      "hello@business.example",
      "hello@business.invalid",
      "hello@business.test",
      "hello@business.local",
      "Name <hello@business-domain.ca>",
      "hello@business-domain.ca\r\nBcc: someone@business-domain.ca",
      "\nhello@business-domain.ca",
    ]) {
      assert.equal(getContactConfig({ ...environment, [name]: value }).available, false, `${name}: ${value}`);
    }
  }
  assert.equal(getContactConfig({ PUBLIC_CONTACT_EMAIL: "hello@example.com" }).publicEmail, null);
});

test("an API credential and explicit operator rate-limit confirmation are needed, not assumed", () => {
  for (const RESEND_API_KEY of ["", "some-key", "re_", "re_replace_me", "re_placeholder_key", "re_key\r\nX-Header: value"]) {
    assert.equal(getContactConfig({ ...environment, RESEND_API_KEY }).available, false);
  }
  for (const CONTACT_RATE_LIMIT_CONFIGURED of ["", "false", "TRUE", " true "]) {
    assert.equal(getContactConfig({ ...environment, CONTACT_RATE_LIMIT_CONFIGURED }).available, false);
  }
});

test("validation trims required fields, normalizes email domains and message line endings", () => {
  assert.deepEqual(validateContactInput({
    name: "  Zoë 李  ",
    email: "  Alex+enquiry@GMAIL.COM  ",
    message: "  First line.\r\nSecond line.\rThird line.  ",
  }), {
    ok: true,
    values: {
      name: "Zoë 李",
      email: "Alex+enquiry@gmail.com",
      company: "",
      message: "First line.\nSecond line.\nThird line.",
    },
  });
});

test("personal email providers and common valid mailbox syntax are welcome", () => {
  for (const email of [
    "person@gmail.com",
    "person@outlook.com",
    "name+project@yahoo.com",
    "first.last@icloud.com",
    "o'brien@business-domain.ca",
    "person@xn--bcher-kva.de",
  ]) {
    assert.equal(validateContactInput({ ...input, email }).ok, true, email);
  }
});

test("name, email, and message must be present and not whitespace", () => {
  for (const name of ["name", "email", "message"] as const) {
    for (const value of ["", "   "]) {
      const result = validateContactInput({ ...input, [name]: value });
      assert.ok(!result.ok && result.reason === "invalid_fields");
      assert.ok(result.errors[name]);
    }
    const missing: Record<string, string> = { ...input };
    delete missing[name];
    const result = validateContactInput(missing);
    assert.ok(!result.ok && result.reason === "invalid_fields" && result.errors[name]);
  }
  const result = validateContactInput({ ...input, company: "   " });
  assert.ok(result.ok);
  assert.equal(result.values.company, "");
});

test("single-line fields reject control characters, including trailing CRLF before trimming", () => {
  for (const name of ["name", "email", "company"] as const) {
    for (const suffix of ["\r\nBcc: other@gmail.com", "\n", "\r", "\t", "\0", "\u007f", "\u0085", "\u2028", "\u2029"]) {
      const result = validateContactInput({ ...input, [name]: input[name] + suffix });
      assert.ok(!result.ok && result.reason === "invalid_fields" && result.errors[name], `${name}: ${JSON.stringify(suffix)}`);
    }
  }
});

test("field limits accept their boundary and reject longer values", () => {
  const longEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
  assert.equal(longEmail.length, CONTACT_LIMITS.email);
  assert.equal(validateContactInput({ ...input, email: longEmail }).ok, true);
  for (const name of ["name", "company", "message"] as const) {
    assert.equal(validateContactInput({ ...input, [name]: "x".repeat(CONTACT_LIMITS[name]) }).ok, true, name);
  }
  for (const name of CONTACT_FIELD_NAMES) {
    const result = validateContactInput({ ...input, [name]: "x".repeat(CONTACT_LIMITS[name] + 1) });
    assert.ok(!result.ok && result.reason === "invalid_fields" && result.errors[name], name);
  }
});

test("email validation rejects malformed, multiple, or oversized mailboxes", () => {
  for (const email of [
    "broken@", "person@domain", "@domain.ca", ".person@gmail.com", "a..b@gmail.com",
    "person.@gmail.com", "x@-host.ca", "x@host-.ca", "x@gmail..com",
    `${"a".repeat(65)}@gmail.com`, `x@${"a".repeat(64)}.com`,
    "Person <person@gmail.com>", "one@gmail.com,two@gmail.com", "one@gmail.com;two@gmail.com",
    "person@gmail.com\r\n", '"person"@gmail.com',
  ]) {
    assert.equal(isValidEmail(email), false, email);
    assert.equal(validateContactInput({ ...input, email }).ok, false, email);
  }
});

test("messages may contain ordinary line breaks and tabs but not other control characters", () => {
  assert.equal(validateContactInput({ ...input, message: "First line\n\tSecond line" }).ok, true);
  for (const character of ["\0", "\u0001", "\u000b", "\u007f", "\u0085"]) {
    const result = validateContactInput({ ...input, message: `Text${character}more text` });
    assert.ok(!result.ok && result.reason === "invalid_fields" && result.errors.message);
  }
});

test("malformed structures and browser-supplied routing/provider settings are rejected", () => {
  for (const value of [
    null, [], "text", 1, true,
    { ...input, name: null }, { ...input, email: [input.email] },
    { ...input, company: 42 }, { ...input, message: {} }, { ...input, website: false },
    { ...input, to: "other@business-domain.ca" },
    { ...input, from: "spoof@business-domain.ca" },
    { ...input, providerUrl: "https://other-domain.ca" },
    JSON.parse('{"__proto__":{"name":"inherited"}}'),
  ]) {
    assert.deepEqual(validateContactInput(value), { ok: false, reason: "invalid_input" });
  }
});

test("a filled honeypot is rejected, never treated as a successful send", () => {
  for (const website of ["https://spam.invalid", " "]) {
    assert.deepEqual(validateContactInput({ ...input, website }), { ok: false, reason: "honeypot" });
  }
});

test("successful JSON submissions send fixed routing, validated Reply-To, and plain text", async () => {
  const mock = provider();
  const events: ContactOperationalEvent[] = [];
  const response = await handle(jsonRequest({ ...input, email: "  Alex+enquiry@GMAIL.COM  " }), {
    fetch: mock.fetch,
    log: (event) => events.push(event),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.deepEqual(await response.json(), { ok: true, message: "Your enquiry has been sent. Thank you for getting in touch." });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(events, [{ event: "contact_delivery_accepted" }]);

  assert.equal(mock.calls.length, 1);
  assert.equal(mock.calls[0].url, "https://api.resend.com/emails");
  const options = mock.calls[0].init!;
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  const headers = new Headers(options.headers);
  assert.equal(headers.get("authorization"), `Bearer ${environment.RESEND_API_KEY}`);
  const sent = JSON.parse(String(options.body));
  assert.equal(sent.from, environment.CONTACT_FROM_EMAIL);
  assert.deepEqual(sent.to, [environment.CONTACT_TO_EMAIL]);
  assert.equal(sent.reply_to, "Alex+enquiry@gmail.com");
  assert.equal(sent.subject, "New website enquiry");
  assert.match(sent.text, /Name: Alex Visitor/);
  assert.match(sent.text, /We would like to reduce manual handoffs\./);
  assert.equal("html" in sent, false);
  assert.equal("website" in sent, false);
});

test("successful native forms receive an accessible HTML page and a clean route back", async () => {
  const mock = provider();
  const response = await handle(nativeRequest(), { fetch: mock.fetch });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
  const html = await response.text();
  assert.match(html, /<!doctype html><html lang="en">/);
  assert.match(html, /<h1>Thank you for your enquiry<\/h1>/);
  assert.match(html, /role="status"/);
  assert.match(html, /href="\/#contact"/);
  assert.doesNotMatch(html, /Alex Visitor|alex\+enquiry@gmail\.com|4ea44233/);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-security-policy") ?? "", /form-action 'self'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /style-src 'sha256-/);
});

test("native validation failures preserve escaped fields with linked inline errors", async () => {
  const value = {
    ...input,
    name: 'Alex & "Visitors" <team>',
    email: "invalid",
    message: '</textarea><script>alert("private")</script>',
  };
  const response = await handle(nativeRequest(value));
  assert.equal(response.status, 422);
  const html = await response.text();
  assert.match(html, /role="alert"/);
  assert.match(html, /Alex &amp; &quot;Visitors&quot; &lt;team&gt;/);
  assert.match(html, /&lt;\/textarea&gt;&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>|alert\("private"\)/);
  assert.match(html, /aria-invalid="true" aria-describedby="enquiry-email-error"/);
  assert.match(html, /autofocus/);
  assert.match(html, /action="\/api\/contact" method="post"/);
  assert.match(html, /id="enquiry-form"/);
  assert.match(html, /Business name \(optional\)/);
  assert.match(html, /Send your enquiry/);
  assert.match(html, /mailto:hello@business-domain\.ca/);
  assert.match(html, /confidential business information or personal records/);
  assert.match(html, /href="\/privacy\/"/);
});

test("JSON field failures contain useful errors without returning the submitted details", async () => {
  const reply = await assertFailure(await handle(jsonRequest({ ...input, name: " ", message: " " })), 422);
  assert.ok(reply.errors.name);
  assert.ok(reply.errors.message);
  assert.equal("values" in reply, false);
  assert.doesNotMatch(JSON.stringify(reply), /alex\+enquiry@gmail\.com/);
});

test("unsupported methods return 405, including a bodyless HEAD response", async () => {
  for (const method of ["GET", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
    const request = new Request(`${config.origin}/api/contact`, { method, headers: { Accept: "application/json" } });
    const response = await handle(request);
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get("allow"), "POST");
    if (method === "HEAD") assert.equal(await response.text(), "");
    else assert.equal((await response.json()).ok, false);
  }
});

test("unsupported content types, charsets, and compressed bodies do not reach the provider", async () => {
  for (const contentType of [
    "", "text/plain", "multipart/form-data; boundary=abc", "application/xml",
    "application/json-patch+json", "application/json; charset=iso-8859-1",
    "application/json; charset=utf-8; charset=utf-16",
  ]) {
    await assertFailure(await handle(rawRequest(JSON.stringify(input), contentType)), 415);
  }
  await assertFailure(await handle(jsonRequest(input, { "Content-Encoding": "gzip" })), 415);
});

test("JSON and native forms accept an explicit UTF-8 charset", async () => {
  const mock = provider();
  for (const contentType of ["application/json; charset=UTF-8", 'application/json; charset="utf-8"']) {
    const response = await handle(rawRequest(JSON.stringify(input), contentType), { fetch: mock.fetch });
    assert.equal(response.status, 200);
  }
});

test("missing, null, and cross-origin origins are rejected before sending", async () => {
  for (const origin of [
    null, "null", "https://other-domain.ca", "http://business-domain.ca",
    "https://business-domain.ca.other-domain.ca", "https://business-domain.ca:8443",
    "https://business-domain.ca/", "https://business-domain.ca https://other-domain.ca",
  ]) {
    const request = jsonRequest();
    if (origin === null) request.headers.delete("origin");
    else request.headers.set("origin", origin);
    await assertFailure(await handle(request), 403);
  }
});

test("preview and incomplete configuration return honest 503 responses for both form modes", async () => {
  for (const unavailable of [
    getContactConfig({}),
    getContactConfig({ ...environment, SITE_MODE: "preview" }),
    getContactConfig({ ...environment, CONTACT_RATE_LIMIT_CONFIGURED: undefined }),
  ]) {
    await assertFailure(await handle(jsonRequest(), { config: unavailable }), 503);
    const response = await handle(nativeRequest(), { config: unavailable });
    assert.equal(response.status, 503);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html/);
    const html = await response.text();
    assert.match(html, /sending is unavailable/);
    assert.match(html, /href="\/#contact"/);
    assert.doesNotMatch(html, /re_synthetic|CONTACT_RATE_LIMIT|RESEND|inbox@/);
  }
});

test("malformed JSON and unexpected request structures are rejected", async () => {
  for (const body of ["", "{", "null", "[]", '"text"', '{"name":1}', '{"message":{}}']) {
    await assertFailure(await handle(rawRequest(body)), 400);
  }
  for (const extra of [
    { to: "other@business-domain.ca" },
    { from: "spoof@business-domain.ca" },
    { providerUrl: "https://other-domain.ca" },
  ]) {
    await assertFailure(await handle(jsonRequest({ ...input, ...extra })), 400);
  }
});

test("duplicate form values and malformed percent encodings are rejected", async () => {
  for (const body of [
    "name=Alex&name=Other", "name=%", "name=%ZZ", "name=%C3%28", "name=%ED%A0%80",
    "to=other%40business-domain.ca", "__proto__=value",
  ]) {
    await assertFailure(await handle(rawRequest(body, "application/x-www-form-urlencoded")), 400);
  }
});

test("honeypot requests receive an error response, not a simulated acknowledgement", async () => {
  const reply = await assertFailure(await handle(jsonRequest({ ...input, website: "filled" })), 400);
  assert.match(reply.message, /could not be sent/);
});

test("field length limits also apply at the endpoint", async () => {
  for (const field of CONTACT_FIELD_NAMES) {
    const reply = await assertFailure(await handle(jsonRequest({
      ...input,
      [field]: "x".repeat(CONTACT_LIMITS[field] + 1),
    })), 422);
    assert.ok(reply.errors[field]);
  }
});

test("the body size limit is enforced without Content-Length and with a dishonest length", async () => {
  const body = " ".repeat(MAX_CONTACT_BODY_BYTES + 1);
  const headerCases: Record<string, string>[] = [{}, { "Content-Length": "1" }];
  for (const headers of headerCases) {
    await assertFailure(await handle(rawRequest(body, "application/json", headers)), 413);
  }
  await assertFailure(await handle(rawRequest("{}", "application/json", {
    "Content-Length": String(MAX_CONTACT_BODY_BYTES + 1),
  })), 413);
});

test("streaming reads stop and cancel once the byte limit is reached", async () => {
  let chunks = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks += 1;
      controller.enqueue(new Uint8Array(16_384).fill(32));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assertFailure(await handle(rawRequest(stream, "application/json", { "Content-Length": "1" })), 413);
  assert.equal(cancelled, true);
  assert.ok(chunks <= 7, `read ${chunks} chunks`);
});

test("body limits count UTF-8 bytes rather than JavaScript string length", async () => {
  await assertFailure(await handle(rawRequest("漢".repeat(MAX_CONTACT_BODY_BYTES / 2))), 413);
  const mock = provider();
  const response = await handle(nativeRequest({ ...input, message: "漢".repeat(CONTACT_LIMITS.message) }), {
    fetch: mock.fetch,
  });
  assert.equal(response.status, 200);
});

test("a request exactly at the body limit remains valid", async () => {
  const mock = provider();
  const body = JSON.stringify(input).padEnd(MAX_CONTACT_BODY_BYTES, " ");
  assert.equal(new TextEncoder().encode(body).byteLength, MAX_CONTACT_BODY_BYTES);
  const response = await handle(rawRequest(body), { fetch: mock.fetch });
  assert.equal(response.status, 200);
});

test("UTF-8 characters split across stream chunks are decoded correctly", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...input, name: "Zoë 李" }));
  let offset = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === bytes.length) controller.close();
      else controller.enqueue(bytes.slice(offset, ++offset));
    },
  });
  const mock = provider();
  const response = await handle(rawRequest(stream), { fetch: mock.fetch });
  assert.equal(response.status, 200);
  assert.match(JSON.parse(String(mock.calls[0].init?.body)).text, /Zoë 李/);
});

test("invalid UTF-8 and malformed Content-Length values fail safely", async () => {
  await assertFailure(await handle(rawRequest(new Uint8Array([0x7b, 0xff, 0x7d]))), 400);
  await assertFailure(await handle(rawRequest(new Uint8Array([0xc3]))), 400);
  await assertFailure(await handle(jsonRequest(input, { "Content-Length": "not-a-number" })), 400);
});

test("provider rejection never becomes success and operational logs exclude provider details", async () => {
  const privateDetails = `${input.email} ${input.message} ${environment.RESEND_API_KEY}`;
  for (const status of [400, 401, 403, 429, 500]) {
    const mock = provider(() => Response.json({ message: privateDetails }, { status }));
    const events: ContactOperationalEvent[] = [];
    const reply = await assertFailure(await handle(jsonRequest(), {
      fetch: mock.fetch,
      log: (event) => events.push(event),
    }), 502);
    assert.deepEqual(events, [{ event: "contact_delivery_failed", reason: "rejected", status }]);
    for (const secret of [input.email, input.message, environment.RESEND_API_KEY!, environment.CONTACT_TO_EMAIL!]) {
      assert.equal(JSON.stringify(events).includes(secret), false);
      assert.equal(JSON.stringify(reply).includes(secret), false);
    }
  }
});

test("native provider failure preserves the enquiry and the direct-email alternative", async () => {
  const mock = provider(() => Response.json({ message: "Private provider error" }, { status: 500 }));
  const response = await handle(nativeRequest(), { fetch: mock.fetch });
  assert.equal(response.status, 502);
  const html = await response.text();
  assert.match(html, /value="Alex Visitor"/);
  assert.match(html, /We would like to reduce manual handoffs\./);
  assert.match(html, /mailto:hello@business-domain\.ca/);
  assert.match(html, /Send your enquiry/);
  assert.doesNotMatch(html, /Private provider error|re_synthetic|RESEND|inbox@/);
});

test("network failures are classified without echoing exception messages", async () => {
  const events: ContactOperationalEvent[] = [];
  const fetch: typeof globalThis.fetch = async () => {
    throw new TypeError(`Network failed for ${input.email} ${environment.RESEND_API_KEY}`);
  };
  const reply = await assertFailure(await handle(jsonRequest(), { fetch, log: (event) => events.push(event) }), 502);
  assert.deepEqual(events, [{ event: "contact_delivery_failed", reason: "transport" }]);
  assert.match(reply.message, /couldn’t confirm/);
  assert.doesNotMatch(JSON.stringify(reply), /gmail|re_synthetic/);
});

test("provider timeouts are bounded, abort the fetch, and return an honest failure", async () => {
  let signal: AbortSignal | null | undefined;
  const fetch: typeof globalThis.fetch = async (_, init) => {
    signal = init?.signal;
    return new Promise<Response>(() => {});
  };
  const events: ContactOperationalEvent[] = [];
  const response = await handle(jsonRequest(), {
    fetch,
    providerTimeoutMs: 15,
    log: (event) => events.push(event),
  });
  const reply = await assertFailure(response, 504);
  assert.equal(signal?.aborted, true);
  assert.deepEqual(events, [{ event: "contact_delivery_failed", reason: "timeout" }]);
  assert.match(reply.message, /couldn’t confirm/);
});

test("the provider deadline also covers a stalled accepted-response body", async () => {
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });
  const mock = provider(() => new Response(stream, { headers: { "Content-Type": "application/json" } }));
  const response = await handle(jsonRequest(), { fetch: mock.fetch, providerTimeoutMs: 15 });
  await assertFailure(response, 504);
  streamController!.error(new DOMException("Stopped test stream", "AbortError"));
});

test("a successful HTTP status without a valid provider receipt is not a successful send", async () => {
  for (const receipt of [
    {}, null, [], { id: "" }, { id: 42 }, { id: "not-a-provider-id" },
    { id: receiptId, error: "not accepted" },
  ]) {
    const mock = provider(() => Response.json(receipt));
    const events: ContactOperationalEvent[] = [];
    await assertFailure(await handle(jsonRequest(), { fetch: mock.fetch, log: (event) => events.push(event) }), 502);
    assert.deepEqual(events, [{ event: "contact_delivery_failed", reason: "invalid_response", status: 200 }]);
  }
});

test("malformed, wrongly typed, and unexpected successful provider responses are rejected", async () => {
  for (const response of [
    () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    () => new Response(JSON.stringify({ id: receiptId }), { headers: { "Content-Type": "text/html" } }),
    () => new Response(null, { status: 204 }),
    () => Response.json({ id: receiptId }, { status: 202 }),
    () => Response.json({ id: receiptId }, { status: 302 }),
  ]) {
    await assertFailure(await handle(jsonRequest(), { fetch: provider(response).fetch }), 502);
  }
});

test("a valid provider creation receipt is accepted but never exposed in the browser response", async () => {
  const mock = provider(() => Response.json({ id: receiptId }, { status: 201 }));
  const result = validateContactInput(input);
  assert.ok(result.ok);
  assert.deepEqual(await sendEnquiry(result.values, config, { fetch: mock.fetch }), { id: receiptId });
  const response = await handle(jsonRequest(), { fetch: mock.fetch });
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), new RegExp(receiptId));
});

test("the provider adapter classifies expected errors with no provider payload attached", async () => {
  const result = validateContactInput(input);
  assert.ok(result.ok);
  await assert.rejects(sendEnquiry(result.values, config, {
    fetch: provider(() => Response.json({ message: "Private provider error" }, { status: 500 })).fetch,
  }), (error: unknown) => {
    assert.ok(error instanceof EnquiryDeliveryError);
    assert.equal(error.reason, "rejected");
    assert.equal(error.providerStatus, 500);
    assert.doesNotMatch(error.message, /Private provider error/);
    return true;
  });
});

test("unexpected programming errors are allowed to surface instead of becoming delivery responses", async () => {
  const bug = new Error("Unexpected implementation defect");
  const fetch: typeof globalThis.fetch = async () => { throw bug; };
  await assert.rejects(handle(jsonRequest(), { fetch }), (error: unknown) => error === bug);
  await assert.rejects(handle(jsonRequest(), { fetch: provider().fetch, providerTimeoutMs: 0 }), RangeError);
});

test("unexpected request-stream errors also surface without success-shaped fallbacks", async () => {
  const bug = new Error("Unexpected stream implementation defect");
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(bug);
    },
  });
  await assert.rejects(handle(rawRequest(stream)), (error: unknown) => error === bug);
});

test("content negotiation preserves the HTML baseline unless JSON is requested", async () => {
  const mock = provider();
  const json = jsonRequest();
  json.headers.delete("accept");
  assert.match((await handle(json, { fetch: mock.fetch })).headers.get("content-type") ?? "", /^application\/json/);

  const native = nativeRequest();
  native.headers.delete("accept");
  assert.match((await handle(native, { fetch: mock.fetch })).headers.get("content-type") ?? "", /^text\/html/);

  const preferHtml = jsonRequest(input, { Accept: "text/html, application/json;q=0" });
  assert.match((await handle(preferHtml, { fetch: mock.fetch })).headers.get("content-type") ?? "", /^text\/html/);
});
