/**
 * Zero-config onboarding in the CLI: `firewall init` (propose a spec from the code, write it only where no spec
 * exists) and the `evaluate --from-inferred` helpers (evaluate under the proposal, labelled as inferred).
 * The inference itself is ISE (`src/ise/propose.ts`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { INFERRED_SPEC_LABEL, proposeWithBuiltinPresets } from '../ise/propose.js';
import type { SpecProposal } from '../ise/propose.js';

/** Where `init` writes by default, relative to the project. */
export const DEFAULT_SPEC_NAME = 'firewall.spec.yaml';
/** Spec file names the repository uses; any of them in the project root means the project already has a spec. */
export const KNOWN_SPEC_NAMES: readonly string[] = [DEFAULT_SPEC_NAME, 'spec.yaml', '.firewall.yaml', 'architecture.yaml'];

export type Propose = (projectDir: string) => Promise<SpecProposal>;

export const defaultPropose: Propose = proposeWithBuiltinPresets;

export interface InitOptions {
  readonly project: string;
  /** Output file; default `<project>/firewall.spec.yaml`. */
  readonly out?: string | undefined;
  /** Print the YAML to stdout and write nothing. */
  readonly print?: boolean;
  /** `human` (summary on stderr) or `json` (the whole proposal on stdout). */
  readonly format?: string;
}

export interface InitDeps {
  readonly propose: Propose;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

/** The human summary of a proposal (stderr). */
export function formatProposalHuman(p: SpecProposal): string {
  const lines: string[] = [];
  lines.push(`Proposed spec (${INFERRED_SPEC_LABEL})`);
  const runner = p.ranking.find((r) => r.style !== p.style && r.confidence > 0);
  lines.push(`  style: ${p.style} (confidence ${p.styleConfidence.toFixed(2)}${runner !== undefined ? `; runner-up ${runner.style} ${runner.confidence.toFixed(2)}` : ''})`);
  lines.push('  layer map:');
  for (const m of p.mappings) {
    lines.push(`    ${m.layer.padEnd(18)} ${m.glob.padEnd(34)} ${m.origin === 'inferred' ? 'INFERRED' : 'preset  '} ${m.confidence.toFixed(2)}  ${m.evidence}`);
  }
  if (p.unassignedFiles.length > 0) lines.push(`  files without a layer: ${p.unassignedFiles.join(', ')}`);
  lines.push(p.questions.length === 0 ? '  questions: none' : `  questions (${String(p.questions.length)}):`);
  p.questions.forEach((q, i) => lines.push(`    Q${String(i + 1)}. ${q.question}`));
  if (!p.check.valid || !p.check.compiles) lines.push(`  WARNING: the proposal does not pass the repository checks: ${p.check.errors.join('; ')}`);
  return lines.join('\n');
}

/** The spec file already in the project (the target, or a known spec name when no `--out` was given). */
export function existingSpec(project: string, out: string | undefined): string | undefined {
  const target = path.resolve(out ?? path.join(project, DEFAULT_SPEC_NAME));
  if (fs.existsSync(target)) return target;
  if (out !== undefined) return undefined;
  return KNOWN_SPEC_NAMES.map((n) => path.resolve(project, n)).find((f) => fs.existsSync(f));
}

/**
 * `firewall init`. Exit codes: 0 written (or printed); 1 a spec already exists (nothing written) or the proposal
 * does not pass the repository checks (written, with a warning header); 2 the project cannot be read.
 */
export async function runInit(opts: InitOptions, deps: InitDeps): Promise<number> {
  const format = opts.format ?? 'human';
  if (format !== 'human' && format !== 'json') {
    deps.err('Error: --format must be one of human | json\n');
    return 2;
  }
  const project = path.resolve(opts.project);
  const existing = opts.print === true ? undefined : existingSpec(project, opts.out);
  if (existing !== undefined) {
    deps.err(`Error: ${existing} already exists; init never overwrites a spec. Use --out <new file> or --print.\n`);
    return 1;
  }
  let proposal: SpecProposal;
  try {
    proposal = await deps.propose(project);
  } catch (e: unknown) {
    deps.err(`Error: cannot infer a spec for ${project}: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (format === 'json') deps.out(JSON.stringify(proposal, null, 2) + '\n');
  else deps.err(formatProposalHuman(proposal) + '\n');
  if (opts.print === true) {
    if (format === 'human') deps.out(proposal.yaml);
    return proposal.check.valid && proposal.check.compiles ? 0 : 1;
  }
  const target = path.resolve(opts.out ?? path.join(project, DEFAULT_SPEC_NAME));
  try {
    // `wx`: fail rather than overwrite, even if the file appeared since the check above.
    fs.writeFileSync(target, proposal.yaml, { flag: 'wx' });
  } catch (e: unknown) {
    deps.err(`Error: not written: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
  deps.err(`Wrote ${target} (${INFERRED_SPEC_LABEL}). Review the lines marked INFERRED and the questions at its end.\n`);
  return proposal.check.valid && proposal.check.compiles ? 0 : 1;
}

export interface InferredSpecFile {
  readonly specPath: string;
  readonly proposal: SpecProposal;
  readonly dispose: () => void;
}

/** The proposal for `project` in a temporary file, for `evaluate --from-inferred`. Never writes into the project. */
export async function inferredSpecFile(project: string, propose: Propose = defaultPropose): Promise<InferredSpecFile> {
  const proposal = await propose(path.resolve(project));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firewall-inferred-'));
  const specPath = path.join(dir, 'inferred.spec.yaml');
  fs.writeFileSync(specPath, proposal.yaml);
  return { specPath, proposal, dispose: () => { fs.rmSync(dir, { recursive: true, force: true }); } };
}

/** The `specSource` block a `--from-inferred` JSON report carries. */
export function inferredSpecSource(p: SpecProposal): Record<string, unknown> {
  return {
    kind: 'inferred',
    label: INFERRED_SPEC_LABEL,
    style: p.style,
    styleConfidence: p.styleConfidence,
    questions: p.questions.length,
    unassignedFiles: p.unassignedFiles.length,
  };
}

/** The banner every `--from-inferred` run prints (stderr) before its report. */
export function inferredBanner(p: SpecProposal): string {
  return [
    `*** ${INFERRED_SPEC_LABEL.toUpperCase()} ***`,
    `Rules ran on the spec ISE inferred from this code: style ${p.style} (confidence ${p.styleConfidence.toFixed(2)}), ${String(p.mappings.length)} layer mappings, ${String(p.questions.length)} open question(s).`,
    'Findings are relative to the code\'s own majority patterns; run `firewall init` to review and declare the spec.',
  ].join('\n');
}

/** A JSON report with the `specSource` block added first. */
export function labelJsonReport(json: string, p: SpecProposal): string {
  const report = JSON.parse(json) as Record<string, unknown>;
  return JSON.stringify({ specSource: inferredSpecSource(p), ...report }, null, 2);
}
