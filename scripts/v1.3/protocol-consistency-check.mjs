#!/usr/bin/env node
/**
 * Study 2 protocol consistency check (Docs/v1.4/study2-deviation-2026-10-19-drift.md §2; it superseded the
 * 2026-10-16 record's §2).
 *
 * The deviation record holds the canonical protocol in a ```study2-protocol block. Every protocol document must
 *   1. cite the deviation record,
 *   2. carry the same values in its `<!-- study2-protocol: ... -->` line, and
 *   3. state no superseded arm set, k, outcome, count unit, fallback, order or waiver outside a marked passage.
 *
 * Marked passages are skipped: lines between `<!-- superseded:start -->` and `<!-- superseded:end -->`, lines
 * containing "superseded" or "corrected", and everything above `<!-- protocol-check: historical-above -->`
 * (used where the original text must stay byte-identical, as in the pilot memo).
 *
 * Usage: node scripts/v1.3/protocol-consistency-check.mjs [--root <dir>]. Exit 0 when consistent, 1 otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const DEVIATION = 'Docs/v1.4/study2-deviation-2026-10-19-drift.md';
const DEVIATION_FILE = path.basename(DEVIATION);

export const PROTOCOL_DOCS = [
  DEVIATION,
  'Docs/v1.3/study2-deviation-2026-10-16.md',
  'Docs/v1.3/study2-outline-v2.md',
  'Docs/v1.3/gap-closing-plan.md',
  'Docs/v1.3/study2-readiness-gate.md',
  'Docs/v1.3/pilot-outcome-memo.md',
  'Docs/v1.3/floor-escape-design-2026-10-16.md',
  'Docs/v1.3/study2-readiness-dashboard.md',
  'Docs/v1.3/study2-task-design.md',
  'Docs/v1.3/study2-dress-rehearsal.md',
];

/** Statements of the protocol before the deviation. Each one contradicts a value in the canonical block. */
export const SUPERSEDED = [
  // primary outcome
  { key: 'primary', re: /v2 does \*\*not\*\* amend §5|v2 amends nothing/i },
  { key: 'primary', re: /no outcome switch is allowed/i },
  { key: 'primary', re: /the primary outcome per memo §5/i },
  { key: 'primary', re: /do not choose \(b\)|do not touch §5/i },
  { key: 'primary', re: /Study 2 keeps the blocking outcome/i },
  { key: 'primary', re: /primary outcome (moves|would move) to the advisory/i },
  { key: 'primary', re: /The primary outcome follows the pilot memo's pre-committed rule/i },
  // arms
  { key: 'arms', re: /Same three arms/i },
  { key: 'arms', re: /`none`, `gate`, `daedalus-mcp`|`none`, `daedalus-mcp`, `gate`|\bnone, gate, daedalus-mcp\b/i },
  { key: 'arms', re: /for the gate contrast/i },
  { key: 'arms', re: /3 arms \(`none`, `daedalus-mcp`, `gate`\)/i },
  // k
  { key: 'k', re: /k = 6 if possible/i },
  { key: 'k', re: /k ≥ 5 steps/i },
  { key: 'k', re: /Sealed tasks, k ≈ 4–6/i },
  // count unit
  { key: 'unit', re: /Raw count, with a distinct-edge sensitivity/i },
  { key: 'unit', re: /keep the raw count \(as the tiers define it\)/i },
  // fallback
  { key: 'fallback', re: /Study 2 runs the memo section 5 branch/i },
  { key: 'fallback', re: /run under the §5 branch with the null pre-declared/i },
  // order
  { key: 'order', re: /pass the readiness gate, dress-rehearse, pre-register/i },
  // waivers and the T1 status
  { key: 'waivers', re: /V10 waiver note/i },
  { key: 'waivers', re: /or a dated decision accepting less/i },
  { key: 'waivers', re: /dated addendum that drops V10\(a\)/i },
  { key: 'T1', re: /T1 freezer fix is merged/i },
];

const TAG = /<!--\s*study2-protocol:\s*(.*?)\s*-->/g;

export function parseCanonical(text) {
  const m = /```study2-protocol\n([\s\S]*?)```/.exec(text);
  if (!m) return null;
  return Object.fromEntries(
    m[1].split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('=').map((s) => s.trim())),
  );
}

export function parseTag(body) {
  return Object.fromEntries(body.split(';').map((p) => p.trim()).filter(Boolean).map((p) => p.split('=').map((s) => s.trim())));
}

export function checkDoc(rel, text, canonical) {
  const errors = [];
  if (rel !== DEVIATION && !text.includes(DEVIATION_FILE)) {
    errors.push(`${rel}: does not cite ${DEVIATION}`);
  }
  const tags = [...text.matchAll(TAG)];
  if (tags.length === 0) errors.push(`${rel}: no <!-- study2-protocol: ... --> line`);
  for (const t of tags) {
    const got = parseTag(t[1]);
    for (const [k, v] of Object.entries(canonical)) {
      if (got[k] !== v) errors.push(`${rel}: protocol line has ${k}=${got[k] ?? '(missing)'}, canonical ${k}=${v}`);
    }
    for (const k of Object.keys(got)) if (!(k in canonical)) errors.push(`${rel}: protocol line has unknown key ${k}`);
  }
  // The deviation record quotes every superseded statement in its "Replaces" column, so it is not scanned.
  if (rel === DEVIATION || rel === 'Docs/v1.3/study2-deviation-2026-10-16.md') return errors;
  const lines = text.split('\n');
  const histIdx = lines.findIndex((l) => l.includes('<!-- protocol-check: historical-above -->'));
  let skipping = false;
  lines.forEach((line, i) => {
    if (line.includes('<!-- superseded:start')) skipping = true;
    const skip = skipping || i <= histIdx || /superseded|corrected/i.test(line);
    if (line.includes('<!-- superseded:end')) skipping = false;
    if (skip) return;
    for (const s of SUPERSEDED) {
      if (s.re.test(line)) errors.push(`${rel}:${i + 1}: superseded ${s.key} statement: ${line.trim().slice(0, 140)}`);
    }
  });
  if (skipping) errors.push(`${rel}: unclosed <!-- superseded:start --> passage`);
  return errors;
}

export function run(root) {
  const devPath = path.join(root, DEVIATION);
  if (!existsSync(devPath)) return [`missing ${DEVIATION}`];
  const canonical = parseCanonical(readFileSync(devPath, 'utf8'));
  if (!canonical) return [`${DEVIATION}: no \`\`\`study2-protocol block`];
  const errors = [];
  for (const rel of PROTOCOL_DOCS) {
    const p = path.join(root, rel);
    if (!existsSync(p)) {
      errors.push(`missing ${rel}`);
      continue;
    }
    errors.push(...checkDoc(rel, readFileSync(p, 'utf8'), canonical));
  }
  return errors;
}

/** Proves the check can fail: a wrong tag value, a missing citation and a superseded statement must each be caught. */
export function selfTest(canonical) {
  const good = `cites ${DEVIATION_FILE}\n<!-- study2-protocol: ${Object.entries(canonical).map(([k, v]) => `${k}=${v}`).join('; ')} -->\n`;
  const cases = [
    { name: 'consistent doc passes', text: good, expectFail: false },
    { name: 'wrong k is caught', text: good.replace(`k=${canonical.k}`, 'k=99'), expectFail: true },
    { name: 'missing citation is caught', text: good.replace(DEVIATION_FILE, 'x.md'), expectFail: true },
    { name: 'three-arm set is caught', text: `${good}Arms: \`none\`, \`gate\`, \`daedalus-mcp\`.\n`, expectFail: true },
    { name: 'marked superseded line passes', text: `${good}Superseded: \`none\`, \`gate\`, \`daedalus-mcp\`.\n`, expectFail: false },
    { name: 'historical-above passes', text: `v2 amends nothing.\n<!-- protocol-check: historical-above -->\n${good}`, expectFail: false },
  ];
  return cases
    .filter((c) => (checkDoc('Docs/v1.3/x.md', c.text, canonical).length > 0) !== c.expectFail)
    .map((c) => `self-test failed: ${c.name}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const root = i > 0 ? process.argv[i + 1] : process.cwd();
  const errors = run(root);
  const canonical = existsSync(path.join(root, DEVIATION)) ? parseCanonical(readFileSync(path.join(root, DEVIATION), 'utf8')) : null;
  if (canonical) errors.push(...selfTest(canonical));
  if (errors.length) {
    for (const e of errors) console.error(`FAIL ${e}`);
    console.error(`protocol consistency: ${errors.length} problem(s) in ${PROTOCOL_DOCS.length} documents`);
    process.exit(1);
  }
  console.log(`protocol consistency: OK (${PROTOCOL_DOCS.length} documents agree with ${DEVIATION} §2)`);
}
