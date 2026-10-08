/**
 * Triaged dependency-audit gate (NFR-06, SECURITY-10; v1.2E Build and Test plan Step 6). CLI entry:
 * `audit-gate-cli.ts` (D-U5a-13 form).
 *
 * `npm audit --audit-level=high` fails on every high finding, including the ones the triage accepted, so it stays
 * report-only in CI. This gate makes the audit blocking once triaged: it reads `npm audit --json`, collects the
 * root advisories (the `via` objects) of severity high or critical, and fails when one of them is not in the
 * triage allow-list `scripts/lib/audit-allowlist.json` (`Docs/DiagnosticRuns/bt-audit-triage.md` holds the
 * reasoning). A new high advisory therefore fails CI until it is triaged.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const AUDIT_ALLOWLIST = 'scripts/lib/audit-allowlist.json';
export const AUDIT_UNTRIAGED = 'AUDIT_UNTRIAGED';

export interface AllowEntry {
  readonly id: string;
  readonly package: string;
  readonly decision: 'accepted-residual' | 'not-reachable';
  readonly reason: string;
}

export interface Advisory {
  readonly id: string;
  readonly package: string;
  readonly severity: string;
  readonly title: string;
  readonly url: string;
}

const BLOCKING = new Set(['high', 'critical']);

/** The id of an advisory URL (`https://github.com/advisories/GHSA-…` → `GHSA-…`). */
export function advisoryId(url: string): string {
  return url.split('/').filter((s) => s !== '').pop() ?? url;
}

/** Root advisories of severity high or critical in an `npm audit --json` value, unique by id, sorted. */
export function blockingAdvisories(audit: unknown): Advisory[] {
  const vulns = (audit as { readonly vulnerabilities?: Record<string, { readonly via?: readonly unknown[] }> } | null)?.vulnerabilities;
  if (vulns === undefined) throw new Error('not an npm audit --json value (no vulnerabilities object)');
  const out = new Map<string, Advisory>();
  for (const v of Object.values(vulns)) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const a = via as { readonly name?: string; readonly severity?: string; readonly title?: string; readonly url?: string };
      if (a.severity === undefined || !BLOCKING.has(a.severity) || a.url === undefined) continue;
      const id = advisoryId(a.url);
      if (out.get(id)?.severity === 'critical') continue; // keep the higher severity of a repeated advisory
      out.set(id, { id, package: a.name ?? '?', severity: a.severity, title: a.title ?? '', url: a.url });
    }
  }
  return [...out.values()].sort((x, y) => x.id.localeCompare(y.id));
}

export function untriaged(advisories: readonly Advisory[], allow: readonly AllowEntry[]): Advisory[] {
  const ids = new Set(allow.map((e) => e.id));
  return advisories.filter((a) => !ids.has(a.id));
}

export function loadAllowlist(repoRoot: string): AllowEntry[] {
  const v = JSON.parse(readFileSync(join(repoRoot, AUDIT_ALLOWLIST), 'utf8')) as { readonly advisories?: unknown };
  if (!Array.isArray(v.advisories)) throw new Error(`${AUDIT_ALLOWLIST}: advisories must be an array`);
  for (const e of v.advisories as Partial<AllowEntry>[]) {
    if (typeof e.id !== 'string' || typeof e.package !== 'string' || typeof e.reason !== 'string' || e.reason.trim() === ''
      || (e.decision !== 'accepted-residual' && e.decision !== 'not-reachable')) {
      throw new Error(`${AUDIT_ALLOWLIST}: every entry needs id, package, decision (accepted-residual | not-reachable) and a reason`);
    }
  }
  return v.advisories as AllowEntry[];
}

export interface AuditGateIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** Returns the `npm audit --json` text (injected in tests). */
  readonly audit: () => string;
}

/** Runs `npm audit --json`; npm exits non-zero when findings exist, so stdout is read either way. */
export function npmAuditJson(repoRoot: string): string {
  try {
    return execFileSync('npm', ['audit', '--json'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    const stdout = (e as { readonly stdout?: unknown }).stdout;
    if (typeof stdout === 'string' && stdout.trim() !== '') return stdout;
    throw e;
  }
}

const SELF_TEST_AUDIT = {
  vulnerabilities: {
    'known-bad': { via: [{ name: 'known-bad', severity: 'critical', title: 'self-test advisory', url: 'https://github.com/advisories/GHSA-0000-0000-0000' }] },
  },
};

/** CLI body: `[--input <audit.json>] | --self-test | --help`. Resolves to the exit code. */
export function main(argv: readonly string[], repoRoot: string, io: AuditGateIo): Promise<number> {
  return Promise.resolve(run(argv, repoRoot, io));
}

function run(argv: readonly string[], repoRoot: string, io: AuditGateIo): number {
  if (argv.includes('--help')) {
    io.out('usage: npx tsx scripts/audit-gate-cli.ts [--input <npm-audit.json>] | --self-test\n'
      + 'Exit: 0 every high/critical advisory triaged; 1 untriaged advisory (AUDIT_UNTRIAGED); 2 usage or input error.\n');
    return 0;
  }
  let allow: AllowEntry[];
  try {
    allow = loadAllowlist(repoRoot);
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  if (argv.includes('--self-test')) {
    const bad = untriaged(blockingAdvisories(SELF_TEST_AUDIT), allow);
    if (bad.length === 1) {
      io.out('self-test: the untriaged GHSA-0000-0000-0000 was reported (expected exit 1)\n');
      return 1;
    }
    io.err('self-test: the known-bad advisory was NOT reported\n');
    return 0;
  }
  const i = argv.indexOf('--input');
  let text: string;
  try {
    text = i >= 0 ? readFileSync(argv[i + 1] ?? '', 'utf8') : io.audit();
  } catch (e) {
    io.err(`cannot read the audit: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  let advisories: Advisory[];
  try {
    advisories = blockingAdvisories(JSON.parse(text) as unknown);
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const bad = untriaged(advisories, allow);
  io.out(`audit gate: ${String(advisories.length)} high/critical root advisories, ${String(advisories.length - bad.length)} triaged\n`);
  if (bad.length === 0) return 0;
  for (const a of bad) io.err(`${AUDIT_UNTRIAGED}: ${a.severity} ${a.package} ${a.id} ${a.title}\n`);
  return 1;
}
