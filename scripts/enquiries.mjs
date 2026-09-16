import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

const LIMIT = Number(process.argv[2] ?? 20);

async function main() {
  const env = loadEnv("development", process.cwd(), "");
  const connectionString = (env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    console.error("Set DATABASE_URL in .env to read stored enquiries.");
    process.exitCode = 1;
    return;
  }
  if (!Number.isInteger(LIMIT) || LIMIT < 1 || LIMIT > 500) {
    console.error("Usage: npm run enquiries -- [1-500]");
    process.exitCode = 1;
    return;
  }

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, received_at, name, email, company, emailed, message
       FROM enquiries ORDER BY received_at DESC LIMIT $1`,
      [LIMIT],
    );
    if (!rows.length) {
      console.info("No enquiries stored yet.");
      return;
    }
    for (const row of rows) {
      console.info(
        `\n#${row.id}  ${row.received_at.toISOString()}  ${row.emailed ? "emailed" : "not emailed"}\n` +
          `${row.name} <${row.email}>${row.company ? ` — ${row.company}` : ""}\n` +
          row.message.split("\n").map((line) => `  ${line}`).join("\n"),
      );
    }
    const { rows: totals } = await client.query("SELECT count(*)::int AS total FROM enquiries");
    console.info(`\nShowing ${rows.length} of ${totals[0].total} stored enquiries.`);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
