/**
 * Scrubs absolute machine paths from judge v2 / filter-explain cassettes and results before they are committed.
 * Revision v2.0 prompts carried checker type text with absolute `import("...")` paths (fixed in v2.1 by
 * `relativiseTypeText`); a scrubbed v2.0 entry keeps its key, so it documents the run but is not byte-replayable.
 *
 * Usage: npx tsx scripts/v1.3/judge-v2-scrub.ts <dir>...
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const PATTERN = /\/(?:Volumes|Users|private)\/[^\s"'`)\\]*/g;

function walk(dir: string, out: string[]): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.json') || e.name.endsWith('.md')) out.push(p);
  }
}

let changed = 0;
for (const d of process.argv.slice(2)) {
  if (!fs.existsSync(d)) continue;
  const files: string[] = [];
  walk(d, files);
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const next = text.replace(PATTERN, (m) => {
      const nm = m.indexOf('/node_modules/');
      return nm >= 0 ? `<abs>${m.slice(nm)}` : '<abs>';
    });
    if (next !== text) {
      fs.writeFileSync(f, next);
      changed++;
    }
  }
}
process.stdout.write(`scrubbed ${String(changed)} file(s)\n`);
