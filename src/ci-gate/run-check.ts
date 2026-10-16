/**
 * `check --base <ref> --head <ref>`: evaluate both commits with one engine and one spec, then report the findings new
 * in head, fixed by head and unchanged. The verdict fails only on NEW blocking findings, so a pull request is judged
 * on what it introduces, not on the debt already on its base.
 *
 * The spec is read from the base commit by default: a pull request that loosens the spec does not loosen its own gate.
 * `specFrom: 'head'` reads it from the head commit instead (a PR that is meant to change the spec).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../spec-parser/index.js';
import type { ParsedSpec } from '../shared/types/spec.js';
import { exportTree, listRenames, resolveCommit } from './git-tree.js';
import { classifyFindings } from './match.js';
import type { GateEngine } from './engines.js';
import type { CommitEvaluation, GateFinding, GateResult } from './types.js';

export interface CheckOptions {
  /** Repository root (any directory inside the work tree). */
  readonly repo: string;
  readonly base: string;
  readonly head: string;
  /** Spec path relative to the repository root. */
  readonly spec: string;
  /** Project directory relative to the repository root; `.` by default. */
  readonly project?: string;
  readonly specFrom?: 'base' | 'head';
  readonly engine: GateEngine;
  /** Evaluations keyed by `<sha>:<project>:<spec>` (a caller that checks many pairs evaluates each commit once). */
  readonly cache?: Map<string, readonly GateFinding[]>;
  readonly log?: (text: string) => void;
}

export class CheckError extends Error {}

function safeRelative(p: string, what: string): string {
  const norm = path.posix.normalize(p.replace(/\\/g, '/'));
  if (path.posix.isAbsolute(norm) || norm === '..' || norm.startsWith('../')) {
    throw new CheckError(`${what} must be a path inside the repository, relative to its root: ${p}`);
  }
  return norm.replace(/\/+$/, '') || '.';
}

async function loadSpec(specPath: string): Promise<ParsedSpec> {
  if (!fs.existsSync(specPath)) throw new CheckError(`spec not found in the commit: ${specPath}`);
  const parsed = await parseSpec({ specFilePath: specPath });
  if (!parsed.success) throw new CheckError(`spec parse error: ${parsed.errors.map((e) => e.message).join('; ')}`);
  return parsed.data;
}

export async function runCheck(opts: CheckOptions): Promise<GateResult> {
  const project = safeRelative(opts.project ?? '.', '--project');
  const spec = safeRelative(opts.spec, '--spec');
  const baseSha = resolveCommit(opts.repo, opts.base);
  const headSha = resolveCommit(opts.repo, opts.head);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'daedalus-check-'));
  try {
    const trees = new Map<string, string>();
    const treeOf = (sha: string): string => {
      let dir = trees.get(sha);
      if (dir === undefined) {
        dir = path.join(work, sha);
        fs.mkdirSync(dir);
        exportTree(opts.repo, sha, dir);
        trees.set(sha, dir);
      }
      return dir;
    };
    const specPath = path.join(treeOf(opts.specFrom === 'head' ? headSha : baseSha), spec);
    const parsedSpec = await loadSpec(specPath);

    const evaluate = async (ref: string, sha: string): Promise<CommitEvaluation> => {
      const key = `${sha}:${project}:${spec}:${opts.specFrom ?? 'base'}:${opts.engine.name}`;
      let findings = opts.cache?.get(key);
      if (findings === undefined) {
        const projectDir = path.join(treeOf(sha), project);
        if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
          throw new CheckError(`project directory ${project} does not exist in ${ref} (${sha.slice(0, 12)})`);
        }
        opts.log?.(`evaluating ${ref} (${sha.slice(0, 12)}) with the ${opts.engine.name} engine\n`);
        findings = await opts.engine.evaluate({ projectDir, specPath, spec: parsedSpec });
        opts.cache?.set(key, findings);
      }
      return { ref, sha, findings };
    };

    const base = await evaluate(opts.base, baseSha);
    const head = await evaluate(opts.head, headSha);
    const renames = baseSha === headSha ? {} : listRenames(opts.repo, baseSha, headSha, project);
    const classified = classifyFindings(base.findings, head.findings, renames);
    const newBlocking = classified.new.filter((f) => f.tier === 'blocking').length;
    return {
      engine: opts.engine.name,
      spec,
      project,
      base: { ref: opts.base, sha: baseSha, findings: base.findings.length },
      head: { ref: opts.head, sha: headSha, findings: head.findings.length },
      renames,
      ...classified,
      verdict: newBlocking > 0 ? 'fail' : 'pass',
      newBlocking,
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}
