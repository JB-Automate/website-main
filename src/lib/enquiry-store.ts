import { createHash } from "node:crypto";
import { CONTACT_LIMITS } from "./contact-validation.ts";
import type { Enquiry } from "./contact-validation.ts";

export const ENQUIRY_STORE_TIMEOUT_MS = 2_500;

export interface EnquiryStoreEnvironment {
  DATABASE_URL?: string;
  ENQUIRY_HASH_SALT?: string;
}

export interface EnquiryContext {
  delivered: boolean;
  source: string;
}

export interface EnquiryStore {
  /** Records an enquiry. Never rejects: a visitor is never affected by storage problems. */
  record(enquiry: Enquiry, context: EnquiryContext): Promise<void>;
  close(): Promise<void>;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS enquiries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now(),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND ${CONTACT_LIMITS.name}),
    email text NOT NULL CHECK (length(email) BETWEEN 3 AND ${CONTACT_LIMITS.email}),
    company text NOT NULL DEFAULT '' CHECK (length(company) <= ${CONTACT_LIMITS.company}),
    message text NOT NULL CHECK (length(message) BETWEEN 1 AND ${CONTACT_LIMITS.message}),
    emailed boolean NOT NULL,
    source_hash text NOT NULL CHECK (length(source_hash) = 64),
    content_hash text NOT NULL CHECK (length(content_hash) = 64)
  );
  CREATE INDEX IF NOT EXISTS enquiries_received_at_idx ON enquiries (received_at DESC);
  CREATE INDEX IF NOT EXISTS enquiries_source_idx ON enquiries (source_hash, received_at DESC);
  CREATE INDEX IF NOT EXISTS enquiries_content_idx ON enquiries (content_hash, received_at DESC);
`;

// Silent limits. A throttled submission is simply not stored a second time; the visitor is never told.
const RECORD_SQL = `
  INSERT INTO enquiries (name, email, company, message, emailed, source_hash, content_hash)
  SELECT $1, $2, $3, $4, $5, $6, $7
  WHERE NOT EXISTS (
          SELECT 1 FROM enquiries
          WHERE content_hash = $7 AND received_at > now() - interval '24 hours'
        )
    AND (SELECT count(*) FROM enquiries
         WHERE source_hash = $6 AND received_at > now() - interval '15 minutes') < 3
    AND (SELECT count(*) FROM enquiries
         WHERE source_hash = $6 AND received_at > now() - interval '24 hours') < 12
    AND (SELECT count(*) FROM enquiries
         WHERE received_at > now() - interval '1 hour') < 60
`;

/** The forwarded address of the caller, used only to derive a salted hash for throttling. */
export function requestSource(request: Request): string {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  const source = forwarded || (request.headers.get("x-real-ip") ?? "").trim();
  return source.length > 0 && source.length <= 100 ? source : "unknown";
}

export function createEnquiryStore(
  env: EnquiryStoreEnvironment,
  log: (message: string) => void = (message) => console.warn("Enquiry store", message),
): EnquiryStore | null {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) return null;

  // The salt keeps stored hashes from being reversible by guessing addresses.
  const salt = env.ENQUIRY_HASH_SALT?.trim() || connectionString;
  const digest = (value: string): string =>
    createHash("sha256").update(salt).update("\u0000").update(value).digest("hex");

  let pool: import("pg").Pool | undefined;
  let ready: Promise<import("pg").Pool> | undefined;

  async function connect(): Promise<import("pg").Pool> {
    const { default: pg } = await import("pg");
    const local = /^(?:localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(new URL(connectionString!).hostname);
    pool = new pg.Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: ENQUIRY_STORE_TIMEOUT_MS,
      statement_timeout: ENQUIRY_STORE_TIMEOUT_MS,
      query_timeout: ENQUIRY_STORE_TIMEOUT_MS,
      application_name: "jb-automate-enquiries",
      ...(local ? {} : { ssl: { rejectUnauthorized: true } }),
    });
    // A pool error without a listener would otherwise end the process.
    pool.on("error", (error) => log(error.message));
    await pool.query(SCHEMA_SQL);
    return pool;
  }

  return {
    async record(enquiry, context) {
      try {
        ready ??= connect();
        const client = await ready;
        await client.query(RECORD_SQL, [
          enquiry.name,
          enquiry.email,
          enquiry.company,
          enquiry.message,
          context.delivered,
          digest(context.source),
          digest(`${enquiry.email.toLowerCase()}\u0000${enquiry.message}`),
        ]);
      } catch (error) {
        // Retry the schema step on the next enquiry rather than caching a broken pool.
        ready = undefined;
        pool?.end().catch(() => {});
        pool = undefined;
        log(error instanceof Error ? error.message : "unknown failure");
      }
    },
    async close() {
      const started = ready;
      ready = undefined;
      pool = undefined;
      if (!started) return;
      try {
        await (await started).end();
      } catch {
        // Closing a pool that never connected is not an error worth reporting.
      }
    },
  };
}
