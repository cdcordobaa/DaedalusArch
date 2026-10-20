/**
 * D_sem provenance classifier (`scripts/v1.4/lib/dsem-provenance.ts`; pre-registration §4 "Semantic layer", sem-01 T1)
 * on synthetic loop runs: a snapshot store built like the harness's (`--git-dir` outside the work tree, `base: skeleton`
 * then one commit per step), with step records beside it. Zero model calls.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  analyseRows, blame, blockDsem, cellDsem, citationProvenance, classifyClaim, classifyEntries, claimCitations, isStableClaim,
  parseSlug, stepMapOfRun, stepOfCommit,
} from '../../../../scripts/v1.4/lib/dsem-provenance.js';
import type { A5Entry, CountedIdentity, StepMap } from '../../../../scripts/v1.4/lib/dsem-provenance.js';
import type { ExceptionCitation } from '../../../../src/apg-enrich/ontology/interpretation.js';

const IDENTITY = ['-c', 'user.name=loop-harness', '-c', 'user.email=loop-harness@localhost', '-c', 'commit.gpgsign=false'];

interface Run { readonly runDir: string; readonly commits: string[]; readonly m: StepMap }

/** Builds a run: trees[0] is the skeleton (step 0), trees[k] the agent's tree after step k (full file sets). */
function buildRun(root: string, trees: readonly Record<string, string>[]): Run {
  const runDir = path.join(root, 'runs', 'gen', 'model', 'task', 'none', 'run-0');
  const work = path.join(runDir, 'work');
  const gitDir = path.join(runDir, 'snapshots.git');
  fs.mkdirSync(work, { recursive: true });
  execFileSync('git', ['init', '--quiet', '--bare', gitDir]);
  const g = (a: string[]): string => execFileSync('git', [...IDENTITY, `--git-dir=${gitDir}`, `--work-tree=${work}`, ...a], { cwd: work, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-20T00:00:00Z', GIT_COMMITTER_DATE: '2026-10-20T00:00:00Z' } });
  const commits: string[] = [];
  trees.forEach((files, k) => {
    for (const f of fs.readdirSync(work)) fs.rmSync(path.join(work, f), { recursive: true, force: true });
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
      fs.writeFileSync(path.join(work, rel), text);
    }
    g(['add', '--all', '--force', '.']);
    g(['commit', '--quiet', '--allow-empty', '-m', k === 0 ? 'base: skeleton' : `step-${String(k).padStart(2, '0')} none`]);
    commits.push(g(['rev-parse', 'HEAD']).trim());
  });
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ runId: 'gen/model/task/none/run-0', baseCommit: commits[0] }));
  fs.mkdirSync(path.join(runDir, 'steps'));
  for (let k = 1; k < commits.length; k++) {
    fs.writeFileSync(path.join(runDir, 'steps', `step-${String(k).padStart(2, '0')}.json`), JSON.stringify({ stepIndex: k - 1, turns: [{ turnId: `step-${String(k).padStart(2, '0')}`, snapshot: { commit: commits[k] } }] }));
  }
  return { runDir, commits, m: stepMapOfRun(runDir) };
}

const SKELETON = {
  'package.json': '{ "name": "skeleton" }\n',
  'docs/ARCHITECTURE.md': '# Architecture\n\nThe composition root may import every layer to wire them.\n',
};
const SERVER_1 = "import { a } from '../persistence/repo';\nexport const s = a;\n";
const ADR_1 = '# ADR 1\n\nPresentation may import persistence for wiring.\n';
const SERVER_3 = "// Wiring only: presentation may see persistence here.\nimport { a } from '../persistence/repo';\nexport const s = a;\n";

let tmp: string;
let run: Run;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsem-prov-'));
  const step1 = { ...SKELETON, 'src/presentation/server.ts': SERVER_1, 'src/persistence/repo.ts': 'export const a = 1;\n', 'docs/adr-1.md': ADR_1 };
  const step2 = { ...step1 };
  const step3 = { ...step1, 'src/presentation/server.ts': SERVER_3 };
  // Step 4 edits one skeleton line: that line becomes the agent's.
  const step4 = { ...step3, 'docs/ARCHITECTURE.md': '# Architecture\n\nThe composition root may import every layer to wire them, and so may the server.\n' };
  run = buildRun(tmp, [SKELETON, step1, step2, step3, step4]);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const cite = (p: string, s: number, e: number, quote: string): ExceptionCitation => ({ path: p, startLine: s, endLine: e, quote });

function entry(id: string, citation: ExceptionCitation | null, opts: { claimed?: boolean; stability?: string; target?: string } = {}): A5Entry {
  const claimed = opts.claimed ?? citation !== null;
  const run1 = { grounded: { answer: { exceptionClaim: { claimed, citation } } } };
  return {
    findingId: id,
    finding: { rule: 'FF-S03', files: ['src/presentation/server.ts', opts.target ?? 'src/persistence/repo.ts'] },
    runs: [run1, run1],
    merged: { exception: { claimed, stability: opts.stability ?? 'agreed', citation: claimed ? citation : null } },
  };
}

describe('git helpers', () => {
  it('maps the base commit to step 0 and each step commit to its step', () => {
    expect(run.m.baseCommit).toBe(run.commits[0]);
    expect(stepOfCommit(run.m, run.commits[0] ?? '')).toBe(0);
    expect(stepOfCommit(run.m, run.commits[3] ?? '')).toBe(3);
  });

  it('falls back to the commit subject when a commit is not in the step records', () => {
    const m: StepMap = { ...run.m, stepOf: new Map() };
    expect(stepOfCommit(m, run.commits[0] ?? '')).toBe(0);
    expect(stepOfCommit(m, run.commits[2] ?? '')).toBe(2);
  });

  it('blames each line to the commit that last wrote it', () => {
    const b = blame(run.m.gitDir, run.commits[4] ?? '', 'src/presentation/server.ts', 1, 2);
    expect(b?.map((x) => x.commit)).toEqual([run.commits[3], run.commits[1]]);
    expect(blame(run.m.gitDir, run.commits[4] ?? '', 'src/presentation/server.ts', 1, 99)).toBeNull();
  });
});

describe('citationProvenance and classifyClaim', () => {
  const at = (): string => run.commits[3] ?? '';

  it('a non-agent citation: a skeleton line the agent never changed', () => {
    const p = citationProvenance(run.m, at(), cite('docs/ARCHITECTURE.md', 3, 3, 'composition root may import every layer'));
    expect(p.resolution).toBe('tracked');
    expect(p.quoteAtCommit).toBe(true);
    expect(p.lines.map((l) => l.origin.kind)).toEqual(['skeleton']);
    expect(classifyClaim([p], 3)).toBe('non-agent');
  });

  it('an agent citation from an earlier step: not an evasion candidate, and not non-agent', () => {
    const p = citationProvenance(run.m, at(), cite('docs/adr-1.md', 3, 3, 'Presentation may import persistence'));
    expect(p.agentMaxStep).toBe(1);
    expect(classifyClaim([p], 3)).toBe('agent-earlier');
  });

  it('an agent citation from the same step as the finding, or a later one: an evasion candidate', () => {
    const same = citationProvenance(run.m, at(), cite('src/presentation/server.ts', 1, 1, 'Wiring only: presentation may see persistence here.'));
    expect(same.agentMaxStep).toBe(3);
    expect(classifyClaim([same], 3)).toBe('agent-same-or-later');
    expect(classifyClaim([same], 2)).toBe('agent-same-or-later');
    expect(classifyClaim([same], 4)).toBe('agent-earlier');
  });

  it('a skeleton line the agent edited counts as the agent\'s, at the step it was edited', () => {
    const p = citationProvenance(run.m, run.commits[4] ?? '', cite('docs/ARCHITECTURE.md', 3, 3, 'and so may the server'));
    expect(p.lines.map((l) => l.origin)).toEqual([{ kind: 'agent', commit: run.commits[4], step: 4 }]);
    expect(classifyClaim([p], 2)).toBe('agent-same-or-later');
  });

  it('a citation spanning skeleton and agent lines takes the agent line', () => {
    const skeletonLine = citationProvenance(run.m, at(), cite('docs/ARCHITECTURE.md', 3, 3, 'composition root'));
    const agentLine = citationProvenance(run.m, at(), cite('docs/adr-1.md', 3, 3, 'for wiring'));
    expect(classifyClaim([skeletonLine, agentLine], 2)).toBe('agent-earlier');
  });

  it('a declared external non-agent text, and the skeleton install, are non-agent; any other untracked path is unknown', () => {
    const ext = citationProvenance(run.m, at(), cite('.task/step-03.md', 1, 2, 'x'), { externalNonAgent: ['.task'] });
    expect(ext.resolution).toBe('external');
    expect(classifyClaim([ext], 3)).toBe('non-agent');
    expect(classifyClaim([citationProvenance(run.m, at(), cite('node_modules/lib/README.md', 1, 1, 'x'))], 3)).toBe('non-agent');
    const unk = citationProvenance(run.m, at(), cite('docs/missing.md', 1, 1, 'x'));
    expect(unk.resolution).toBe('unknown');
    expect(classifyClaim([unk], 3)).toBe('unknown');
  });

  it('a quote the committed lines do not hold is unknown, never non-agent', () => {
    const p = citationProvenance(run.m, at(), cite('docs/ARCHITECTURE.md', 3, 3, 'text C4 did not read from git'));
    expect(p.quoteAtCommit).toBe(false);
    expect(classifyClaim([p], 3)).toBe('unknown');
  });

  it('an unknown line does not hide an evasion candidate', () => {
    const unk = citationProvenance(run.m, at(), cite('docs/missing.md', 1, 1, 'x'));
    const same = citationProvenance(run.m, at(), cite('src/presentation/server.ts', 1, 1, 'Wiring only'));
    expect(classifyClaim([unk, same], 3)).toBe('agent-same-or-later');
  });
});

describe('claims, D_sem per block and per cell', () => {
  const counted: CountedIdentity[] = [
    { cell: 'none@L2', block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target: 'src/persistence/a.ts' },
    { cell: 'none@L2', block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target: 'src/persistence/b.ts' },
    { cell: 'none@L2', block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target: 'src/persistence/c.ts' },
    { cell: 'none@L2', block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target: 'src/persistence/d.ts' },
    { cell: 'none@L2', block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target: 'src/persistence/e.ts' },
  ];
  const entries: A5Entry[] = [
    entry('f-nonagent', cite('docs/ARCHITECTURE.md', 3, 3, 'composition root may import'), { target: 'src/persistence/a.ts' }),
    entry('f-earlier', cite('docs/adr-1.md', 3, 3, 'Presentation may import persistence'), { target: 'src/persistence/b.ts' }),
    entry('f-same', cite('src/presentation/server.ts', 1, 1, 'Wiring only'), { target: 'src/persistence/c.ts' }),
    // A claim with no citation: grounding turned it into claimed: false (C4-01 §4.2 rule 3).
    entry('f-nocite', null, { claimed: false, target: 'src/persistence/d.ts' }),
    // A one-run claim is single-run and does not count (rule 6).
    entry('f-single', cite('docs/ARCHITECTURE.md', 3, 3, 'composition root'), { stability: 'single-run', target: 'src/persistence/e.ts' }),
  ];

  it('isStableClaim and claimCitations', () => {
    expect(entries.map(isStableClaim)).toEqual([true, true, true, false, false]);
    expect(entries[0] === undefined ? [] : claimCitations(entries[0])).toHaveLength(1);
  });

  it('classifies every entry, with the finding step from the counted identity', () => {
    const rows = classifyEntries(entries, run.m, run.commits[3] ?? '', 5, counted);
    expect(rows.map((r) => [r.findingId, r.class, r.evasionCandidate, r.findingStepSource])).toEqual([
      ['f-nonagent', 'non-agent', false, 'counted-identity'],
      ['f-earlier', 'agent-earlier', false, 'counted-identity'],
      ['f-same', 'agent-same-or-later', true, 'counted-identity'],
      ['f-nocite', null, false, 'counted-identity'],
      ['f-single', null, false, 'counted-identity'],
    ]);
    const unmatched = classifyEntries([entry('x', null, { claimed: false, target: 'src/persistence/zzz.ts' })], run.m, run.commits[3] ?? '', 5, counted);
    expect(unmatched[0]?.findingStep).toBe(5);
    expect(unmatched[0]?.findingStepSource).toBe('snapshot');
  });

  it('D_sem two ways: all stable claims drop three findings, non-agent claims one', () => {
    const rows = classifyEntries(entries, run.m, run.commits[3] ?? '', 3, counted);
    const b = blockDsem('none@L2', 't/rep1', counted, entries, rows);
    expect(b).toMatchObject({ D: 5, dsemAll: 2, dsemNonAgent: 4, evasionCandidates: 1, claims: 3, nonAgentClaims: 1, uninterpreted: 0, covered: true });
    const c = cellDsem('none@L2', [b, blockDsem('none@L2', 't/rep2', [], null, null)]);
    expect(c).toMatchObject({ D: 5, dsemAll: 2, dsemNonAgent: 4, evasionCandidates: 1, notRunBlocks: 0 });
    expect(c.reading.p3NonAgentEqualsD).toBe(false);
    expect(c.reading.allClaimsGap).toBe(3);
    expect(analyseRows([b], 'all')).toEqual([{ cell: 'none@L2', block: 't/rep1', D: 2, evasionCandidates: 1 }]);
    expect(analyseRows([b], 'non-agent')).toEqual([{ cell: 'none@L2', block: 't/rep1', D: 4, evasionCandidates: 1 }]);
  });

  it('with no stable claim, both D_sem versions equal D and P3 holds', () => {
    const none = entries.slice(3);
    const rows = classifyEntries(none, run.m, run.commits[3] ?? '', 3, counted);
    const b = blockDsem('none@L2', 't/rep1', counted, none, rows);
    expect(b).toMatchObject({ D: 5, dsemAll: 5, dsemNonAgent: 5, evasionCandidates: 0, uninterpreted: 3 });
    const c = cellDsem('none@L2', [b]);
    expect(c.reading.p3NonAgentEqualsD).toBe(true);
    expect(c.reading.allClaimsGap).toBe(0);
  });

  it('a block with D > 0 and no C4 output has no D_sem; a block with D = 0 has D_sem 0', () => {
    expect(blockDsem('mcp@L2', 't/rep1', counted, null, null)).toMatchObject({ dsemAll: null, dsemNonAgent: null, covered: false });
    expect(blockDsem('mcp@L2', 't/rep1', [], null, null)).toMatchObject({ D: 0, dsemAll: 0, dsemNonAgent: 0 });
    const c = cellDsem('mcp@L2', [blockDsem('mcp@L2', 't/rep1', counted, null, null)]);
    expect(c.notRunBlocks).toBe(1);
    expect(c.reading.text).toMatch(/1 with D > 0 has no C4 output/);
  });
});

describe('the CLI, end to end on three synthetic cells', () => {
  const REPO = path.resolve(__dirname, '../../../..');

  it('writes both D_sem files, the per-cell reading and the contrast readings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsem-cli-'));
    try {
      const step1 = { ...SKELETON, 'src/presentation/server.ts': SERVER_1, 'src/persistence/repo.ts': 'export const a = 1;\n' };
      const step3 = { ...step1, 'src/presentation/server.ts': SERVER_3 };
      const trees = [SKELETON, step1, step1, step3];
      const cells = { 'none@L2': buildRun(path.join(root, 'l2'), trees), 'none@L3': buildRun(path.join(root, 'l3'), trees), 'mcp@L2': buildRun(path.join(root, 'mcp'), trees) };
      const rescore = path.join(root, 'rescore');
      fs.mkdirSync(rescore);
      const snaps = Object.entries(cells).map(([cell, r]) => ({ cell, task: 't', rep: 1, runId: 'gen/model/task/none/run-0', step: 3, commit: r.commits[3] }));
      fs.writeFileSync(path.join(rescore, 'snapshots.json'), JSON.stringify(snaps));
      const id = (cell: string, target: string): CountedIdentity => ({ cell, block: 't/rep1', step: 3, ruleId: 'FF-S03', file: 'src/presentation/server.ts', target });
      fs.writeFileSync(path.join(rescore, 'analysis.json'), JSON.stringify({ countedIdentities: [id('none@L2', 'src/persistence/a.ts'), id('none@L2', 'src/persistence/b.ts'), id('mcp@L2', 'src/persistence/a.ts')] }));
      const D: Record<string, number> = { 'none@L2': 2, 'none@L3': 0, 'mcp@L2': 1 };
      fs.writeFileSync(path.join(rescore, 'runs.json'), JSON.stringify(Object.keys(cells).map((cell) => ({ cell, task: 't', rep: 1, block: 't/rep1', registered: { D: D[cell], Y1: 1, Yk: 1 } }))));
      const c4 = path.join(root, 'c4');
      const a5 = (slug: string, es: A5Entry[]): void => {
        fs.mkdirSync(path.join(c4, slug), { recursive: true });
        fs.writeFileSync(path.join(c4, slug, 'interpretations.json'), JSON.stringify({ entries: es }));
      };
      // none@L2: one claim citing the agent's own step-3 comment (an evasion candidate), one finding with no claim.
      a5('none-L2__t__rep1__step-03', [entry('a', cite('src/presentation/server.ts', 1, 1, 'Wiring only'), { target: 'src/persistence/a.ts' }), entry('b', null, { claimed: false, target: 'src/persistence/b.ts' })]);
      a5('mcp-L2__t__rep1__step-03', [entry('c', null, { claimed: false, target: 'src/persistence/a.ts' })]);
      const out = path.join(root, 'out');
      execFileSync('npx', ['tsx', 'scripts/v1.4/dsem-provenance.ts', '--c4', c4, '--rescore', rescore,
        ...Object.keys(cells).map((cell) => ['--cell', `${cell}=${path.join(root, cell === 'none@L2' ? 'l2' : cell === 'none@L3' ? 'l3' : 'mcp')}`]).flat(),
        '--out', out, '--draws', '199', '--resamples', '50'], { cwd: REPO, encoding: 'utf8' });
      const all = JSON.parse(fs.readFileSync(path.join(out, 'dsem-all.json'), 'utf8')) as { cell: string; D: number; evasionCandidates?: number }[];
      const na = JSON.parse(fs.readFileSync(path.join(out, 'dsem-nonagent.json'), 'utf8')) as { cell: string; D: number }[];
      expect(all.map((r) => [r.cell, r.D, r.evasionCandidates])).toEqual([['none@L2', 1, 1], ['none@L3', 0, 0], ['mcp@L2', 1, 0]]);
      expect(na.map((r) => [r.cell, r.D])).toEqual([['none@L2', 2], ['none@L3', 0], ['mcp@L2', 1]]);
      const prov = JSON.parse(fs.readFileSync(path.join(out, 'provenance.json'), 'utf8')) as { modelCalls: number; cells: { cell: string; reading: { p3NonAgentEqualsD: boolean; allClaimsGap: number } }[]; readings: { computed: boolean; semantic?: Record<string, { reading: string }>; agentJustification?: Record<string, { reading: string }> } };
      expect(prov.modelCalls).toBe(0);
      expect(prov.cells.find((c) => c.cell === 'none@L2')?.reading).toMatchObject({ p3NonAgentEqualsD: true, allClaimsGap: 1 });
      expect(prov.readings.computed).toBe(true);
      expect(Object.keys(prov.readings.semantic ?? {})).toEqual(['H1', 'H2', 'H3']);
      expect(Object.keys(prov.readings.agentJustification ?? {})).toEqual(['H1', 'H2', 'H3']);
      expect(fs.readFileSync(path.join(out, 'provenance.json'), 'utf8')).not.toContain(root);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('parseSlug', () => {
  it('reads the C4 output directory names', () => {
    expect(parseSlug('none-L2__ice-rink__rep1__step-05')).toEqual({ cell: 'none@L2', task: 'ice-rink', rep: 1, step: 5, block: 'ice-rink/rep1' });
    expect(parseSlug('mcp-L2__youth-league__rep2__step-03')?.cell).toBe('mcp@L2');
    expect(parseSlug('not-a-slug')).toBeNull();
  });
});
