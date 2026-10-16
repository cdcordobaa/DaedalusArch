/**
 * v1.3 third manifest: agreement of two manifests by finding identity (Docs/v1.3/third-manifest.md §4). A manifest
 * is a directory in the `ue-score.ts --blind` layout (`blind-key.json`, `blind-out/<style>/<case>.json`); cases are
 * joined through each side's key on the variant. Identity is (mapped rule id, file, target); the name mapping is
 * `blind-rule-mapping.json`; matching is one to one as in `ue-score.ts`. The script reports; it resolves nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ruleTier } from '../../../../src/scoring-engine/rule-tiers.js';
import type { LoadedReference } from '../reference-model.js';

export interface MappingRow { readonly name: string; readonly styles: readonly string[]; readonly ruleId: string | null; readonly basis: string }

export interface IdFinding { readonly ruleId: string; readonly file: string; readonly target: string }

export interface ManifestCase { readonly style: string; readonly caseId: string; readonly variant: string; readonly verdict: string; readonly findings: readonly IdFinding[] }

const ID = /^FF-[A-Z]{1,3}[0-9]{2}$/;

/** A rule name as `ue-score.ts` maps it; a name with no mapping row stays `unmapped:<name>` (ue-score would stop). */
export function mapRuleName(name: string, style: string, mapping: readonly MappingRow[]): string {
  if (ID.test(name)) return name;
  const row = mapping.find((r) => r.name === name && r.styles.includes(style));
  return row?.ruleId ?? `unmapped:${name}`;
}

const stripVia = (t: string | null | undefined): string => (t === null || t === undefined ? '' : t.replace(/\s*\(via [^)]*\)\s*$/, ''));

/** `canon` of ue-score.ts: an FF-S02 cycle is keyed by its sorted member files. */
export function canon(f: IdFinding): IdFinding {
  if (f.ruleId !== 'FF-S02') return f;
  const files = [...new Set([...f.file.split(','), ...(f.target !== '' ? f.target.split(',') : [])].map((s) => s.trim()).filter((s) => s !== ''))].sort();
  return { ruleId: f.ruleId, file: files[0] ?? f.file, target: files.slice(1).join(',') };
}

/** Reads one manifest directory. Primary rule names only (alsoMatches is not an identity). */
export function loadManifestDir(dir: string, mapping: readonly MappingRow[]): ManifestCase[] {
  const key = JSON.parse(fs.readFileSync(path.join(dir, 'blind-key.json'), 'utf8')) as Record<string, string>;
  const out: ManifestCase[] = [];
  for (const [k, variant] of Object.entries(key).sort()) {
    const [style, caseId] = k.split('/') as [string, string];
    const c = JSON.parse(fs.readFileSync(path.join(dir, 'blind-out', style, `${caseId}.json`), 'utf8')) as { verdict: string; findings: { ruleId: string; file: string; target?: string | null }[] };
    const findings = c.findings.map((f) => canon({ ruleId: mapRuleName(f.ruleId, style, mapping), file: f.file, target: stripVia(f.target) }));
    out.push({ style, caseId, variant: variant.includes('/') ? variant : `${style}/${variant}`, verdict: c.verdict, findings });
  }
  return out;
}

/** One-to-one matching: exact (rule, file, target) first, then rule and file when one side has no target. */
export function matchFindings(a: readonly IdFinding[], b: readonly IdFinding[]): { both: number; onlyA: IdFinding[]; onlyB: IdFinding[] } {
  const usedB = new Array<boolean>(b.length).fill(false);
  const matchedA = new Array<boolean>(a.length).fill(false);
  for (const exact of [true, false]) {
    a.forEach((x, i) => {
      if (matchedA[i] === true) return;
      const j = b.findIndex((y, jj) => !usedB[jj] && y.ruleId === x.ruleId && y.file === x.file && (exact ? y.target === x.target : (y.target === '' || x.target === '')));
      if (j >= 0) { usedB[j] = true; matchedA[i] = true; }
    });
  }
  return { both: matchedA.filter(Boolean).length, onlyA: a.filter((_, i) => matchedA[i] !== true), onlyB: b.filter((_, j) => usedB[j] !== true) };
}

export interface AgreementRow { readonly scope: string; readonly view: 'all' | 'blocking'; readonly cases: number; readonly both: number; readonly onlyA: number; readonly onlyB: number; readonly agreement: number; readonly verdictAgree: number; readonly verdictCases: number; readonly kappa: number | null }

export interface CaseDiff { readonly variant: string; readonly verdictA: string; readonly verdictB: string; readonly both: number; readonly onlyA: readonly IdFinding[]; readonly onlyB: readonly IdFinding[] }

export interface Comparison { readonly rows: readonly AgreementRow[]; readonly cases: readonly CaseDiff[]; readonly unpaired: readonly string[]; readonly unmappedNames: readonly string[] }

export const KAPPA_MIN_CASES = 10;

/** Cohen's κ on two binary verdict lists (pass/fail); null when undefined (no variance on both sides). */
export function cohenKappa(a: readonly string[], b: readonly string[]): number | null {
  const n = a.length;
  if (n === 0) return null;
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pa = a.filter((x) => x === 'fail').length / n;
  const pb = b.filter((x) => x === 'fail').length / n;
  const pe = pa * pb + (1 - pa) * (1 - pb);
  return pe === 1 ? null : (po - pe) / (1 - pe);
}

export function compareManifests(a: readonly ManifestCase[], b: readonly ManifestCase[]): Comparison {
  const byVariantB = new Map(b.map((c) => [c.variant, c]));
  const pairs = a.flatMap((x) => { const y = byVariantB.get(x.variant); return y === undefined ? [] : [[x, y] as const]; });
  const unpaired = [...a.filter((x) => !byVariantB.has(x.variant)).map((x) => `A:${x.variant}`), ...b.filter((y) => !a.some((x) => x.variant === y.variant)).map((y) => `B:${y.variant}`)].sort();
  const isBlocking = (style: string) => (f: IdFinding): boolean => ruleTier(f.ruleId, style).tier === 'blocking';
  const cases: CaseDiff[] = pairs.map(([x, y]) => {
    const m = matchFindings(x.findings, y.findings);
    return { variant: x.variant, verdictA: x.verdict, verdictB: y.verdict, both: m.both, onlyA: m.onlyA, onlyB: m.onlyB };
  });
  const rows: AgreementRow[] = [];
  const styles = [...new Set(pairs.map(([x]) => x.style))].sort();
  for (const scope of [...styles, 'all']) {
    const sel = pairs.filter(([x]) => scope === 'all' || x.style === scope);
    for (const view of ['all', 'blocking'] as const) {
      let both = 0; let onlyA = 0; let onlyB = 0;
      for (const [x, y] of sel) {
        const fa = view === 'all' ? x.findings : x.findings.filter(isBlocking(x.style));
        const fb = view === 'all' ? y.findings : y.findings.filter(isBlocking(y.style));
        const m = matchFindings(fa, fb);
        both += m.both; onlyA += m.onlyA.length; onlyB += m.onlyB.length;
      }
      const valid = sel.filter(([x, y]) => ['pass', 'fail'].includes(x.verdict) && ['pass', 'fail'].includes(y.verdict));
      const total = both + onlyA + onlyB;
      rows.push({
        scope, view, cases: sel.length, both, onlyA, onlyB, agreement: total === 0 ? 1 : both / total,
        verdictAgree: valid.filter(([x, y]) => x.verdict === y.verdict).length, verdictCases: valid.length,
        kappa: scope !== 'all' && valid.length >= KAPPA_MIN_CASES ? cohenKappa(valid.map(([x]) => x.verdict), valid.map(([, y]) => y.verdict)) : null,
      });
    }
  }
  const unmappedNames = [...new Set([...a, ...b].flatMap((c) => c.findings.map((f) => f.ruleId)).filter((r) => r.startsWith('unmapped:')))].sort();
  return { rows, cases, unpaired, unmappedNames };
}

const fmt = (f: IdFinding): string => `${f.ruleId} ${f.file}${f.target !== '' ? ` -> ${f.target}` : ''}`;

export function renderComparison(c: Comparison, labelA: string, labelB: string, banner: string): string {
  const lines = [
    `# Third-manifest comparison: ${labelA} (A) vs ${labelB} (B)`,
    '',
    `> ${banner}`,
    '',
    'Identity: mapped rule id, file, target (one-to-one; exact target first). Agreement = both / (both + onlyA + onlyB), 1 when both are empty. κ on case verdicts only when a style has ≥ 10 valid pairs.',
    '',
    '| Scope | View | Cases | Both | Only A | Only B | Agreement | Verdicts agree | κ |',
    '|---|---|---|---|---|---|---|---|---|',
    ...c.rows.map((r) => `| ${r.scope} | ${r.view} | ${String(r.cases)} | ${String(r.both)} | ${String(r.onlyA)} | ${String(r.onlyB)} | ${r.agreement.toFixed(3)} | ${String(r.verdictAgree)}/${String(r.verdictCases)} | ${r.kappa === null ? `n/a (n<${String(KAPPA_MIN_CASES)})` : r.kappa.toFixed(3)} |`),
    '',
    '## Per case',
    '',
  ];
  for (const d of c.cases) {
    lines.push(`- **${d.variant}**: verdict A ${d.verdictA}, B ${d.verdictB}; both ${String(d.both)}`);
    for (const f of d.onlyA) lines.push(`  - only A: ${fmt(f)}`);
    for (const f of d.onlyB) lines.push(`  - only B: ${fmt(f)}`);
  }
  if (c.unpaired.length > 0) lines.push('', `Unpaired cases: ${c.unpaired.join(', ')}`);
  if (c.unmappedNames.length > 0) lines.push('', `Names with no mapping row (ue-score.ts would stop on them): ${c.unmappedNames.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

// ── Author manifests in the same layout ─────────────────────────────────────

/** Writes the author manifests of the given variants in the blind layout, under the given case ids. */
export function exportAuthorManifests(refs: readonly LoadedReference[], key: Readonly<Record<string, string>>, outDir: string): void {
  const blindKey: Record<string, string> = {};
  for (const [caseId, sv] of Object.entries(key).sort()) {
    const [style, variant] = sv.split('/') as [string, string];
    const ref = refs.find((r) => r.style === style);
    const v = ref?.variants.find((x) => x.manifest.variant === variant);
    if (v === undefined) throw new Error(`no reference variant ${sv}`);
    const findings = v.manifest.expectedFindings.map((f) => ({ ruleId: f.ruleId, file: f.file, target: f.target ?? null, tier: ruleTier(f.ruleId, style).tier, reason: f.reason }));
    const verdict = findings.some((f) => f.tier === 'blocking') ? 'fail' : 'pass';
    const dest = path.join(outDir, 'blind-out', style, `${caseId}.json`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `${JSON.stringify({ style, case: caseId, verdict, expectedGraph: { files: [], edges: [], unresolvedEdges: [] }, findings, nearMissOk: [], provenance: { writer: 'author-manifest (Claude-family agents, could see the rules)' } }, null, 2)}\n`);
    blindKey[`${style}/${caseId}`] = variant;
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'blind-key.json'), `${JSON.stringify(blindKey, null, 2)}\n`);
}
