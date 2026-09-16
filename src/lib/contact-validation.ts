export const CONTACT_LIMITS = {
  name: 100,
  email: 254,
  company: 160,
  message: 5_000,
} as const;

export const MAX_CONTACT_BODY_BYTES = 65_536;
export const CONTACT_FIELD_NAMES = ["name", "email", "company", "message"] as const;

export type ContactFieldName = (typeof CONTACT_FIELD_NAMES)[number];
export type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;

export interface Enquiry {
  name: string;
  email: string;
  company: string;
  message: string;
}

export type ContactValidationResult =
  | { ok: true; values: Enquiry }
  | { ok: false; reason: "invalid_input" | "honeypot" }
  | { ok: false; reason: "invalid_fields"; errors: ContactFieldErrors; values: Enquiry };

const singleLineControls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;
const messageControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const emailPattern = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const allowedFields = new Set<string>([...CONTACT_FIELD_NAMES, "website"]);

export function hasSingleLineControls(value: string): boolean {
  return singleLineControls.test(value);
}

export function isValidEmail(value: string): boolean {
  return (
    value.length <= CONTACT_LIMITS.email &&
    value.indexOf("@") <= 64 &&
    emailPattern.test(value)
  );
}

export function mailtoHref(email: string): string {
  if (!isValidEmail(email)) throw new TypeError("A mailto link requires a valid email address.");
  const separator = email.lastIndexOf("@");
  return `mailto:${encodeURIComponent(email.slice(0, separator))}@${email.slice(separator + 1)}`;
}

export function validateContactInput(input: unknown): ContactValidationResult {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const record = input as Record<string, unknown>;
  if (Object.entries(record).some(([key, value]) => !allowedFields.has(key) || typeof value !== "string")) {
    return { ok: false, reason: "invalid_input" };
  }

  const get = (key: string): string => Object.hasOwn(record, key) ? record[key] as string : "";
  if (get("website") !== "") {
    return { ok: false, reason: "honeypot" };
  }

  const values: Enquiry = {
    name: get("name"),
    email: get("email"),
    company: get("company"),
    message: get("message"),
  };
  const errors: ContactFieldErrors = {};

  if (hasSingleLineControls(values.name)) {
    errors.name = "Please enter your name on one line.";
  } else if (!values.name.trim()) {
    errors.name = "Please enter your name.";
  } else if (values.name.length > CONTACT_LIMITS.name) {
    errors.name = "Please keep your name to 100 characters or fewer.";
  }

  if (hasSingleLineControls(values.email)) {
    errors.email = "Please enter your email address on one line.";
  } else if (!values.email.trim()) {
    errors.email = "Please enter your email address.";
  } else if (values.email.length > CONTACT_LIMITS.email || !isValidEmail(values.email.trim())) {
    errors.email = "Please enter a valid email address of 254 characters or fewer.";
  }

  if (hasSingleLineControls(values.company)) {
    errors.company = "Please enter your business name on one line.";
  } else if (values.company.length > CONTACT_LIMITS.company) {
    errors.company = "Please keep your business name to 160 characters or fewer.";
  }

  if (!values.message.trim()) {
    errors.message = "Please tell us what you would like to make easier or build.";
  } else if (values.message.length > CONTACT_LIMITS.message) {
    errors.message = "Please keep your message to 5,000 characters or fewer.";
  } else if (messageControls.test(values.message)) {
    errors.message = "Please remove control characters from your message.";
  }

  if (Object.keys(errors).length) {
    return { ok: false, reason: "invalid_fields", errors, values };
  }

  const email = values.email.trim();
  const separator = email.lastIndexOf("@");
  return {
    ok: true,
    values: {
      name: values.name.trim(),
      email: email.slice(0, separator + 1) + email.slice(separator + 1).toLowerCase(),
      company: values.company.trim(),
      message: values.message.replace(/\r\n?/g, "\n").trim(),
    },
  };
}
