/**
 * DRIFT-01 pilot: blocks manifest and summary (zero calls). Design: `ops/notes/drift-01-design.md` §5.
 *
 *   npx tsx experiments/drift-01/pilot-summary.ts --manifest --out-root <O> --input <input.json> --to <blocks.json>
 *   npx tsx experiments/drift-01/pilot-summary.ts --summary  --out-root <O> --scores <scores.json> --to <summary.json>
 *
 * `--manifest`: one block per (task, replicate, arm) whose shared step-1 session and arm session both completed:
 * step 0 the seed, step 1 the shared session's snapshot, steps 2–5 the arm session's. Specs are the repository
 * copies (the root-only copies differ only by a canary comment line).
 * `--summary`: per task and arm (never pooled) ΣD_v15, mean, P(D_v15 = 0), the per-block list, D_frozen, D_v15_seed,
 * inherited removal, per-step new and present identities, exposure, type-check errors, turn statuses, tool and gate
 * use with the tool-grain caught-and-fixed counts, and every new v1.5 identity for the hand read.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const readLines = <T>(f: string): T[] => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as T) : []);
const SPECS: Record<string, string> = { t1: 'experiments/pilot-hexddd-01/specs/s2-ddd.yaml', t2: 'experiments/pilot-hexddd-01/specs/s1-hexagonal.yaml' };
const TASK_NAME: Record<string, string> = { t1: 's2-orders-invoices (DDD)', t2: 's1-hotel-bookings (Hexagonal)' };

interface Planned { id: string; kind: 'shared' | 'arm'; taskId: string; rep: number; arm: string; steps: number[] }
interface State { done: Record<string, string>; redrawCalls: number; skipped: string[] }

function manifest(out: string, inputFile: string, to: string): void {
  const input = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { tasks: { id: string; seedDir: string }[] };
  const plan = (JSON.parse(fs.readFileSync(path.join(out, 'schedule.json'), 'utf8')) as { schedule: Planned[] }).schedule;
  const state = JSON.parse(fs.readFileSync(path.join(out, 'state.json'), 'utf8')) as State;
  const blocks: Record<string, unknown>[] = [];
  for (const p of plan.filter((x) => x.kind === 'arm')) {
    const shared = plan.find((x) => x.kind === 'shared' && x.taskId === p.taskId && x.rep === p.rep) as Planned;
    const s1 = state.done[shared.id];
    const a = state.done[p.id];
    if (s1 === undefined || a === undefined) continue;
    const seed = input.tasks.find((t) => t.id === p.taskId)?.seedDir as string;
    blocks.push({
      block: `${p.taskId}/rep${String(p.rep + 1)}/${p.arm}`, task: p.taskId, arm: p.arm, spec: SPECS[p.taskId], sessions: { shared: s1, arm: a },
      steps: [{ step: 0, dir: seed }, { step: 1, dir: path.join(out, 'sessions', s1, 'snap', 'step-01') }, ...p.steps.map((k) => ({ step: k, dir: path.join(out, 'sessions', a, 'snap', `step-0${String(k)}`) }))],
    });
  }
  blocks.sort((x, y) => String(x.block).localeCompare(String(y.block)));
  fs.writeFileSync(to, `${JSON.stringify({ blocks }, null, 1)}\n`);
  process.stdout.write(`${String(blocks.length)} blocks\n`);
}

interface DRun { D: number | null; Y1: number | null; Yk: number | null; inheritedRemoved: number | null; perStepNew: { step: number; new: number | null }[]; incomplete: boolean }
interface StepScore { step: number; ok: boolean; typecheckErrors: number | null; identities: number; v15Identities: number; frozenIdentities: number; removedVsPrevious: number | null; v15RemovedVsPrevious: number | null; v15NewVsPrevious: number | null; exposure: { opportunities: number; violations: number }; v15Keys: string[]; frozenKeys: string[]; v15Findings: { rule: string; file: string; line: number | null; subject: string; evidence: string }[]; otherDetect02: { rule: string; file: string; line: number | null }[]; allowOverlayInTree?: boolean }
interface BlockScore { block: string; task: string; arm: string; D_frozen: DRun; D_v15: DRun; D_v15_only: DRun; D_v15_seed: DRun; steps: StepScore[] }

function summary(out: string, scoresFile: string, to: string): void {
  const scores = (JSON.parse(fs.readFileSync(scoresFile, 'utf8')) as { blocks: (BlockScore & { block: string })[] }).blocks;
  const plan = (JSON.parse(fs.readFileSync(path.join(out, 'schedule.json'), 'utf8')) as { schedule: Planned[] }).schedule;
  const state = JSON.parse(fs.readFileSync(path.join(out, 'state.json'), 'utf8')) as State;
  const turns = readLines<Record<string, unknown>>(path.join(out, 'turns.jsonl'));
  const calls = readLines<Record<string, unknown>>(path.join(out, 'calls.jsonl'));
  const cells: Record<string, unknown>[] = [];
  const handRead: Record<string, unknown>[] = [];
  for (const task of ['t1', 't2']) {
    for (const arm of ['none', 'pull', 'gate']) {
      const bs = scores.filter((b) => b.task === task && b.arm === arm);
      const Ds = bs.map((b) => b.D_v15.D ?? NaN);
      const perBlock = bs.map((b) => {
        const rep = Number(/rep(\d+)/.exec(b.block)?.[1]) - 1;
        const p = plan.find((x) => x.kind === 'arm' && x.taskId === task && x.rep === rep && x.arm === arm) as Planned;
        const sess = state.done[p.id] as string;
        const ts = turns.filter((t) => t.session === sess);
        // Tool grain (note §5): pull, a check_consistency call with findings followed by one with none in the same
        // step; gate, a key shown and then resolved in the same step, with none open at the step's end.
        const toolGrain = ts.map((t) => {
          const step = Number(String(t.step).slice(-2));
          const snap = b.steps.find((s) => s.step === step);
          if (arm === 'pull') {
            const cc = ((t.mcpCalls as { tool: string; findings: number | null; isError: boolean }[] | undefined) ?? []).filter((c) => c.tool === 'check_consistency' && !c.isError);
            const firstHit = cc.findIndex((c) => (c.findings ?? 0) > 0);
            const fixed = firstHit >= 0 && cc.slice(firstHit + 1).some((c) => (c.findings ?? 0) === 0);
            return { step, checkCalls: cc.length, callsWithFindings: cc.filter((c) => (c.findings ?? 0) > 0).length, caughtAndFixed: fixed && (snap?.v15Identities ?? 1) === 0 ? 1 : 0, otherTools: ((t.mcpCalls as { tool: string }[] | undefined) ?? []).filter((c) => c.tool !== 'check_consistency').map((c) => c.tool) };
          }
          if (arm === 'gate') {
            const g = t.gate as { edits: number; replied: number; newKeys: number; resolvedKeys: number; stopBlocks: number; failOpen: number; refused: number; allowOverlay: boolean } | undefined;
            return { step, ...g };
          }
          return { step };
        });
        return {
          block: b.block, sessions: { arm: sess }, D_v15: b.D_v15.D, D_frozen: b.D_frozen.D, D_v15_only: b.D_v15_only.D, D_v15_seed: b.D_v15_seed.D, Y1: b.D_v15.Y1, Yk: b.D_v15.Yk, inheritedRemoved: b.D_v15.inheritedRemoved, incomplete: b.D_v15.incomplete,
          perStepNew: b.D_v15.perStepNew, present: b.steps.map((s) => ({ step: s.step, all: s.identities, v15: s.v15Identities, frozen: s.frozenIdentities })),
          removedPerStep: b.steps.filter((s) => s.step >= 2).map((s) => ({ step: s.step, all: s.removedVsPrevious, v15: s.v15RemovedVsPrevious })),
          exposure: b.steps.map((s) => ({ step: s.step, ...s.exposure })), typecheckErrors: b.steps.map((s) => ({ step: s.step, errors: s.typecheckErrors })),
          turnStatus: ts.map((t) => ({ step: t.step, status: t.status, harnessTypecheck: (t.typecheck as { errors?: number } | undefined)?.errors ?? null, models: t.modelUsageIds })),
          toolGrain, allowOverlay: b.steps.some((s) => s.allowOverlayInTree === true),
        };
      });
      // Every v1.5 identity new at steps 2–5 of the block, for the hand read.
      for (const b of bs) {
        const seen = new Set(b.steps.find((s) => s.step === 1)?.v15Keys ?? []);
        for (const s of b.steps.filter((x) => x.step >= 2)) {
          for (const k of s.v15Keys) {
            if (seen.has(k)) continue;
            seen.add(k);
            const [src, root] = k.split('|');
            const f = s.v15Findings.find((x) => src?.startsWith(`${x.file}#`) && src.endsWith(x.subject));
            handRead.push({ block: b.block, step: s.step, command: src, root, rule: s.v15Findings.filter((x) => src === `${x.file}#${x.subject}`).map((x) => x.rule).join('+'), line: f?.line ?? null, evidence: f?.evidence ?? null });
          }
        }
      }
      const fin = Ds.filter((x) => Number.isFinite(x));
      cells.push({
        task, taskName: TASK_NAME[task], arm, blocks: bs.length, sumD_v15: fin.reduce((a, x) => a + x, 0), meanD_v15: fin.length ? fin.reduce((a, x) => a + x, 0) / fin.length : null,
        zeroD: fin.filter((x) => x === 0).length, sumD_frozen: bs.reduce((a, b) => a + (b.D_frozen.D ?? 0), 0), sumD_v15_seed: bs.reduce((a, b) => a + (b.D_v15_seed.D ?? 0), 0),
        sumInheritedRemoved: bs.reduce((a, b) => a + (b.D_v15.inheritedRemoved ?? 0), 0), perBlock,
      });
    }
  }
  const byPhase: Record<string, number> = {};
  for (const c of calls) byPhase[String(c.phase)] = (byPhase[String(c.phase)] ?? 0) + 1;
  const models = [...new Set(turns.flatMap((t) => (t.modelUsageIds as string[] | undefined) ?? []))];
  fs.writeFileSync(to, `${JSON.stringify({ schema: 'drift-01-summary/v1', version: 'v1.5-exp', modelCalls: 0, calls: { ...byPhase, total: calls.length }, redrawCalls: state.redrawCalls, skipped: state.skipped, turnStatuses: turns.reduce<Record<string, number>>((a, t) => { a[String(t.status)] = (a[String(t.status)] ?? 0) + 1; return a; }, {}), servedModels: models, cells, handRead }, null, 1)}\n`);
  for (const c of cells) process.stdout.write(`${String(c.task)} ${String(c.arm)}: blocks ${String(c.blocks)} ΣD_v15 ${String(c.sumD_v15)} D=0 ${String(c.zeroD)} ΣD_frozen ${String(c.sumD_frozen)} inheritedRemoved ${String(c.sumInheritedRemoved)}\n`);
}

const out = arg('out-root');
if (out === undefined) throw new Error('--out-root is required');
if (argv.includes('--manifest')) manifest(out, arg('input') as string, arg('to') as string);
else if (argv.includes('--summary')) summary(out, arg('scores') as string, arg('to') as string);
