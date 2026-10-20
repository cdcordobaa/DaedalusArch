/**
 * `--confine` (or `DAEDALUS_CONFINE=1`; off by default): the tool arguments that name a spec or a project root may not
 * reach outside the configured spec and project (`Docs/v1.4/claude-s4-mcp-probe-spec.md`, probe d).
 *
 * Every tool takes an optional `spec` path, and `infer_spec`, `propose_spec`, `propose_rules` and `evaluate_project`
 * take an optional `project` root. Unconfined, both are read as given: `get_architecture_spec` parses any YAML spec on
 * the host and `infer_spec` maps the folders of any directory with `src/` and `tsconfig.json` (a sibling run, for
 * instance). The file arguments (`path`, `from`, `file`, a finding's file) are already bounded by the project root
 * (R05, R06; `toProjectRelative`, `ProjectView`). Confined:
 *
 * - `spec` must resolve (symlinks resolved) to the configured spec, or to a file inside the configured project;
 * - `project` must resolve inside, or equal, the configured project. A relative value is checked both ways a tool may
 *   resolve it (against the server's cwd and against the configured project); both must stay inside;
 * - with no spec or no project configured, any `spec` or `project` argument is refused.
 *
 * A refused call returns an MCP error whose text starts with `confined:`, before the tool runs (the call log still
 * records it, with that error). The experiment arms start the server with `--confine` (`scripts/lib/generators/arms.ts`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const CONFINED_PREFIX = 'confined:';

export interface ConfineScope {
  readonly specPath?: string | undefined;
  readonly projectPath?: string | undefined;
  /** Base of a relative `spec` (the server's cwd, as `createSpecLoader` resolves it). */
  readonly cwd: string;
}

/** The realpath of `p`; for a path that does not exist, the realpath of its nearest existing ancestor plus the rest. */
export function realpathLoose(p: string): string {
  const rest: string[] = [];
  let cur = path.resolve(p);
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...rest.reverse());
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      rest.push(path.basename(cur));
      cur = parent;
    }
  }
}

function insideOrEqual(root: string, p: string): boolean {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

/** Null when the call's `spec` and `project` arguments stay inside the scope; else the refusal text. */
export function confineArgs(scope: ConfineScope, args: unknown): string | null {
  if (typeof args !== 'object' || args === null) return null;
  const a = args as Record<string, unknown>;
  const project = scope.projectPath !== undefined && scope.projectPath !== '' ? realpathLoose(scope.projectPath) : undefined;
  const spec = str(a.spec);
  if (spec !== undefined) {
    const resolved = realpathLoose(path.resolve(scope.cwd, spec));
    const configured = scope.specPath !== undefined && scope.specPath !== '' ? realpathLoose(path.resolve(scope.cwd, scope.specPath)) : undefined;
    const ok = (configured !== undefined && resolved === configured) || (project !== undefined && insideOrEqual(project, resolved) && resolved !== project);
    if (!ok) return `${CONFINED_PREFIX} the spec argument must be the configured spec or a file inside the project; omit it to use the configured spec`;
  }
  const proj = str(a.project);
  if (proj !== undefined) {
    if (project === undefined) return `${CONFINED_PREFIX} no project is configured, so a project argument is refused`;
    const candidates = path.isAbsolute(proj) ? [proj] : [path.resolve(scope.cwd, proj), path.resolve(project, proj)];
    if (!candidates.every((c) => insideOrEqual(project, realpathLoose(c)))) {
      return `${CONFINED_PREFIX} the project argument must lie inside the configured project; omit it to use the configured project`;
    }
  }
  return null;
}
