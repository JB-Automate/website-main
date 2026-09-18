import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkDirectory(path);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      const policy = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i)?.[1];
      assert.ok(policy, `${path}: missing content security policy`);
      for (const [, attributes, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (!script || /application\/ld\+json/.test(attributes)) continue;
        const hash = `sha256-${createHash('sha256').update(script).digest('base64')}`;
        assert.ok(policy.includes(`'${hash}'`), `${path}: inline script blocked by CSP (${hash})`);
      }
    }
  }
}
await checkDirectory('.vercel/output/static');
console.log('All built inline scripts are authorized by their page CSP.');
