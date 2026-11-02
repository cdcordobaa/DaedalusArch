// Ratchet for the firewall check: which violations of the head report are new against the base report.
// Identity: rule (functionId), file, and the structural fields that name what is violated (source and target layer,
// target, discriminator); never the line or the message, so moving code inside a file does not make a violation new.
// Usage: node new-violations.mjs <head-report.json> <base-report.json> <out.json>
// Writes { headCount, baseCount, newCount, newBlocking, newViolations[] }; blocking = severity critical or major.
import * as fs from 'node:fs';

const BLOCKING = new Set(['critical', 'major']);

export function identity(v) {
  return [v.functionId ?? '', v.filePath ?? '', v.sourceLayer ?? '', v.targetLayer ?? '', v.target ?? '',
    Array.isArray(v.discriminator) ? v.discriminator.join(',') : ''].join('|');
}

export function newViolations(head, base) {
  const counts = new Map();
  for (const v of base?.violations ?? []) counts.set(identity(v), (counts.get(identity(v)) ?? 0) + 1);
  const fresh = [];
  for (const v of head?.violations ?? []) {
    const k = identity(v);
    const n = counts.get(k) ?? 0;
    if (n > 0) counts.set(k, n - 1); // a base violation covers one head violation of the same identity
    else fresh.push(v);
  }
  return {
    headCount: head?.violations?.length ?? 0,
    baseCount: base?.violations?.length ?? 0,
    newCount: fresh.length,
    newBlocking: fresh.filter((v) => BLOCKING.has(v.severity)).length,
    newViolations: fresh,
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [headPath, basePath, outPath] = process.argv.slice(2);
  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const r = newViolations(read(headPath), read(basePath));
  fs.writeFileSync(outPath, `${JSON.stringify(r, null, 1)}\n`);
  console.log(`head ${r.headCount}, base ${r.baseCount}, new ${r.newCount} (blocking ${r.newBlocking})`);
}
