/**
 * Rule mining, presentation: the proposal as the CLI (`mine-rules`) and the MCP tool (`propose_rules`) return it.
 * Both label every rule a PROPOSAL: mined from the code, not a reviewed spec.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Proposal } from './propose.js';
import type { MinedRule } from './types.js';

export const PROPOSAL_LABEL = 'PROPOSED rules: mined from the code (deterministic, no LLM), not a reviewed spec. Review before use; exceptions are candidate violations, not confirmed ones.';

/** The repository's `presets/` (the tool's canonical style library), from source or compiled output. */
export function defaultPresetsDir(): string {
  // `__dirname` exists in the compiled (CommonJS) output and under jest; under an ESM loader (tsx bin/firewall.ts) the
  // entry script's directory stands in for it.
  const here = typeof __dirname !== 'undefined' ? [__dirname] : [];
  const entry = process.argv[1] !== undefined ? [path.dirname(path.resolve(process.argv[1]))] : [];
  const candidates = [...here, ...entry].flatMap((d) => [path.resolve(d, '..', 'presets'), path.resolve(d, '..', '..', 'presets'), path.resolve(d, '..', '..', '..', 'presets')]);
  return [...candidates, path.resolve(process.cwd(), 'presets')].find((d) => fs.existsSync(path.join(d, 'clean-architecture.yaml'))) ?? path.resolve(process.cwd(), 'presets');
}

export interface ProposalSummary {
  readonly label: string;
  readonly style: string;
  readonly styleConfidence: number;
  readonly layers: Readonly<Record<string, number>>;
  /** "from>to": the layer imports the mined rules allow. */
  readonly allowedDependencies: readonly string[];
  readonly rules: readonly (MinedRule & { readonly status: 'proposal' })[];
  readonly counts: { readonly rules: number; readonly high: number; readonly medium: number; readonly low: number; readonly exceptions: number; readonly notRepresentable: number };
  readonly spec: { readonly valid: boolean; readonly errors: readonly string[]; readonly compiled: readonly string[]; readonly yaml?: string };
}

export function summariseProposal(p: Proposal, opts: { readonly includeSpec?: boolean; readonly maxExceptions?: number } = {}): ProposalSummary {
  const max = opts.maxExceptions ?? Number.POSITIVE_INFINITY;
  const rules = p.mining.rules.map((r) => ({ ...r, exceptions: r.exceptions.slice(0, max), status: 'proposal' as const }));
  const count = (l: string): number => p.mining.rules.filter((r) => r.level === l).length;
  return {
    label: PROPOSAL_LABEL,
    style: p.style,
    styleConfidence: Math.round(p.styleConfidence * 1000) / 1000,
    layers: p.mining.layerFiles,
    allowedDependencies: p.mining.allowed,
    rules,
    counts: {
      rules: p.mining.rules.length, high: count('high'), medium: count('medium'), low: count('low'),
      exceptions: p.mining.rules.reduce((s, r) => s + r.exceptions.length, 0),
      notRepresentable: p.mining.rules.filter((r) => r.compilesTo === null).length,
    },
    spec: { valid: p.check.valid, errors: p.check.errors, compiled: p.check.compiled, ...(opts.includeSpec === true ? { yaml: p.specYaml } : {}) },
  };
}

export function formatProposalHuman(p: Proposal, maxExceptions = 5): string {
  const s = summariseProposal(p);
  const lines = [
    s.label,
    '',
    `Style: ${s.style} (ISE confidence ${s.styleConfidence.toFixed(2)}); layers: ${Object.entries(s.layers).map(([l, n]) => `${l} (${String(n)} files)`).join(', ')}`,
    `Allowed layer dependencies: ${s.allowedDependencies.map((a) => a.replace('>', ' -> ')).join(', ') || 'none'}`,
    `${String(s.counts.rules)} proposed rules (${String(s.counts.high)} high, ${String(s.counts.medium)} medium, ${String(s.counts.low)} low confidence), ${String(s.counts.exceptions)} exceptions`,
    '',
  ];
  const order = { high: 0, medium: 1, low: 2 } as const;
  for (const r of [...p.mining.rules].sort((a, b) => order[a.level] - order[b.level] || b.exceptions.length - a.exceptions.length || (a.id < b.id ? -1 : 1))) {
    lines.push(`[${r.level} ${r.confidence.toFixed(2)}] ${r.id} ${r.kind}: ${r.statement}`);
    lines.push(`    -> ${r.compilesTo !== null ? `${r.compilesTo.template} (${r.compilesTo.via})` : `not emitted: ${r.notRepresentable ?? 'no existing template'}`}`);
    for (const e of r.exceptions.slice(0, maxExceptions)) lines.push(`    candidate violation: ${e.file}${e.target !== undefined ? ` -> ${e.target}` : ''}${e.detail !== undefined ? ` (${e.detail})` : ''}`);
    if (r.exceptions.length > maxExceptions) lines.push(`    ... and ${String(r.exceptions.length - maxExceptions)} more`);
  }
  lines.push('', `Proposed spec: ${s.spec.valid ? 'valid' : 'INVALID'}; compiles to ${s.spec.compiled.join(', ') || 'nothing'}`);
  for (const e of s.spec.errors) lines.push(`  - ${e}`);
  return lines.join('\n') + '\n';
}
