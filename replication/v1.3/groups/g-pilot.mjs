// Loop pilot (Docs/v1.3/pilot-outcome-memo.md, pilot-tasks.md, loop-pilot-readiness.md): task and template hashes,
// the pilot plan (experiments/loop-pilot/plan.json) and its call budget, harness constants, the E1 FF-CV05 share from
// the committed Study 1 reports (results/e1-grid/reports), the cost arithmetic, and the stub dry run of the plan
// (scripts/loop-harness-cli.ts --dry-run: stub generators, stub firewall, no model, no Neo4j).
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const MEMO = 'Docs/v1.3/pilot-outcome-memo.md';
const TASKS = 'Docs/v1.3/pilot-tasks.md';
const READY = 'Docs/v1.3/loop-pilot-readiness.md';
const sha = (t) => createHash('sha256').update(t).digest('hex');
const round10 = (x) => Math.round(x / 10) * 10;
const m = (id, line, what, stated, extra = {}) => ({ id: `g-pilot-${id}`, doc: MEMO, line, what, stated, ...extra });
const t = (id, line, what, stated, extra = {}) => ({ id: `g-pilot-${id}`, doc: TASKS, line, what, stated, ...extra });
const r = (id, line, what, stated, extra = {}) => ({ id: `g-pilot-${id}`, doc: READY, line, what, stated, ...extra });

function walk(d) {
  return readdirSync(d).flatMap((e) => { const p = join(d, e); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

function taskBlock(ctx) {
  const md = ctx.read(TASKS);
  return /```json\n([\s\S]*?)```/.exec(md)[1];
}

export default [{
  id: 'g-pilot-static',
  title: 'Loop pilot: hashes, plan, call budget, harness constants, E1 CV05 share, cost arithmetic',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'pilot-tasks.md §5 hash command; sha256 of the plan inputs and of the prompts.ts templates; experiments/loop-pilot/plan.json; scripts/lib/loop/{prompts,plan}.ts; symbolic findings of results/e1-grid/reports/*.json',
  numbers: [
    m('memo-tasks', 16, 'pilot tasks in the hashed block', '3'),
    m('memo-k', 17, 'steps per task in the hashed block', 'k = 4 per task'),
    m('memo-replicates', 21, 'replicates per (task, arm) cell (plan.json runs)', '1 per (task, arm) cell'),
    m('memo-runs', 22, 'runs, step turns and repair turns (plan.json callBudget = planCallBudget)', '3 tasks × 2 arms = 6 runs, 24 step turns, plus at most 12 gate repair turns'),
    m('memo-runs-mcp', 22, 'runs and step turns with a third arm (3 tasks × 3 arms × k)', '9 runs, 36 step turns'),
    m('memo-max40', 27, 'findings shown in one repair turn (MAX_REPAIR_FINDINGS)', 'at most 40'),
    m('memo-cv05', 43, 'FF-CV05 / all symbolic findings in the committed Study 1 E1 reports (65 cells)', '1184 of 1423'),
    m('memo-usd-turn', 50, 'USD per turn, as study2-outline.md §6 states it', '2–6 USD'),
    m('memo-usd-2arm', 50, 'two-arm pilot cost (2..6 USD × (24 + 12) turns, rounded to 10)', 'about 70–220 USD'),
    m('memo-usd-mcp', 50, 'three-arm pilot cost (2..6 USD × (36 + 12) turns, rounded to 10)', 'about 100–290 USD'),
    m('memo-hash-block', 83, 'sha256 of the tasks block of pilot-tasks.md §2', '5b72d1182c5a6ededd8fcf1ce5715c960ac14e2105631ee6e67f72053fdce22f'),
    m('memo-hash-market', 84, 'sha256 of JSON.stringify(task market-vendors)', '009c672b4dee2a566da4fc9ad4d6d084df317763cbfce1508f53c6196d012c89'),
    m('memo-hash-shelter', 85, 'sha256 of JSON.stringify(task shelter-adoptions)', 'acc8a145f5c884653dfec92bd98315b4cd272d24bdce3c3253d0f52e6d4ff49c'),
    m('memo-hash-relief', 86, 'sha256 of JSON.stringify(task relief-volunteers)', '0a6f2531c56e09f4bd69d739bfa16c20e058a14224f70d1263b5964fd5c52315'),
    t('tasks-k', 11, 'steps per task in the hashed block', 'k = 4'),
    r('ready-max40', 31, 'findings listed in one repair prompt (MAX_REPAIR_FINDINGS)', 'at most 40'),
    r('ready-tasksfile-hash', 81, 'sha256 of experiments/loop-pilot/pilot-tasks.json (= memo §7 block hash)', '5b72d118…dce22f'),
    r('ready-runs', 84, 'plan.json runs', '1'),
    r('ready-k', 85, 'steps per task of the plan tasks file', '4 (each task has 4 steps)'),
    r('ready-orderseed', 86, 'plan.json orderSeed', '20261015'),
    r('ready-timeout', 87, 'plan.json timeoutMs, allowBash', '1 200 000, true'),
    r('ready-callbudget', 90, 'plan.json callBudget', '{ runs: 6, stepTurns: 24, maxRepairTurns: 12, maxCalls: 36 }'),
    r('ready-budget-runs', 92, 'runs and step turns (tasks × arms × k)', '3 tasks × 2 arms = 6 runs, each of 4 step turns: 24 step turns'),
    r('ready-budget-repair', 92, 'repair turns (tasks × k, gate arm)', '3 tasks × 4 steps = at most 12 repair turns'),
    r('ready-budget-calls', 92, 'model calls (step + repair)', 'at most **36 model calls**'),
    r('ready-retries', 92, 'infrastructure retries (DEFAULT_RETRY_POLICY.maxInfrastructureRetries)', 'retried at most twice'),
    r('ready-freezes', 92, 'ISE freezes (DDD runs in the plan)', '2 freezes, one per DDD run'),
    r('ready-usd', 92, 'pilot cost at 2..6 USD per turn (24 to 36 turns)', 'about 48 to 216 USD API-equivalent (24 to 36 turns)'),
    r('ready-hash-first', 127, 'sha256 of STYLED_FIRST_STEP_TEMPLATE', '54e815ddf472515b55b1c839a4ee417f711ee5817222ea5e23d758814c5b0911'),
    r('ready-hash-next', 128, 'sha256 of STYLED_NEXT_STEP_TEMPLATE', '93161c32c3cebcb6a1b2cebc5fc6d7de253282b0becfe59de7e5389bb6818626'),
    r('ready-hash-repair', 129, 'sha256 of REPAIR_TEMPLATE', '2a06bf712219964ff682e77d827620d0a7db3d62fbc457bb3de94367660acec0'),
    r('ready-hash-clean', 130, 'sha256 of specs/clean-arch.yaml', '91bd152e0ae58dcc28a35f2ebc6fe264bf9ff7cd11a2fa6a8094ef54fcd6f6a8'),
    r('ready-hash-hex', 131, 'sha256 of presets/hexagonal.yaml', 'd085d6b9badca2e79ade19b12fcfff96d1317df139d646772871266f0ed20ab7'),
    r('ready-hash-ddd', 132, 'sha256 of presets/ddd.yaml', 'ce28a78582a92571c5c8ff2c9144eb2161c580e140db3af880d451737b6260f7'),
    r('ready-orderseed-2', 133, 'plan.json orderSeed (memo §7 value)', '20261015'),
  ],
  async run(ctx) {
    const out = {};
    const block = taskBlock(ctx);
    const tasks = JSON.parse(block).tasks;
    const ks = [...new Set(tasks.map((x) => x.steps.length))];
    const k = ks.length === 1 ? ks[0] : NaN;
    const plan = ctx.json('experiments/loop-pilot/plan.json');
    const arms = plan.arms.length;
    const cb = plan.callBudget;
    // the plan's own budget function must agree with the stored callBudget
    const pcb = JSON.parse(ctx.sh(`node --import tsx --input-type=module -e "import { planCallBudget as p } from './scripts/lib/loop/plan.ts'; import { MAX_REPAIR_FINDINGS as x, STYLED_FIRST_STEP_TEMPLATE as a, STYLED_NEXT_STEP_TEMPLATE as b, REPAIR_TEMPLATE as c } from './scripts/lib/loop/prompts.ts'; import { DEFAULT_RETRY_POLICY as rp } from './scripts/lib/generators/retry.ts'; import { readFileSync as r } from 'node:fs'; const pl = JSON.parse(r('experiments/loop-pilot/plan.json', 'utf8')); const tk = JSON.parse(r(pl.tasksFile, 'utf8')).tasks; console.log(JSON.stringify({ budget: p(pl, tk), max: x, a, b, c, retries: rp.maxInfrastructureRetries }))"`));
    out['g-pilot-memo-tasks'] = String(tasks.length);
    out['g-pilot-memo-k'] = `k = ${k} per task`;
    out['g-pilot-tasks-k'] = `k = ${k}`;
    out['g-pilot-memo-replicates'] = `${plan.runs} per (task, arm) cell`;
    const runs = tasks.length * arms * plan.runs;
    out['g-pilot-memo-runs'] = `${tasks.length} tasks × ${arms} arms = ${runs} runs, ${runs * k} step turns, plus at most ${tasks.length * k} gate repair turns`;
    if (cb.runs !== runs || cb.stepTurns !== runs * k || cb.maxRepairTurns !== tasks.length * k) throw new Error(`callBudget ${JSON.stringify(cb)} differs from tasks × arms × k`);
    if (JSON.stringify(pcb.budget) !== JSON.stringify(cb)) throw new Error(`planCallBudget ${JSON.stringify(pcb.budget)} != plan.json ${JSON.stringify(cb)}`);
    out['g-pilot-memo-runs-mcp'] = `${tasks.length * (arms + 1)} runs, ${tasks.length * (arms + 1) * k} step turns`;
    out['g-pilot-memo-max40'] = `at most ${pcb.max}`;
    out['g-pilot-ready-max40'] = `at most ${pcb.max}`;
    // FF-CV05 among the symbolic findings of the 65 Study 1 E1 reports
    let cv05 = 0; let all = 0;
    for (const f of ctx.ls('results/e1-grid/reports').filter((x) => x.endsWith('.json'))) {
      for (const v of ctx.json(`results/e1-grid/reports/${f}`).violations) if (v.route === 'symbolic') { all++; if (v.functionId === 'FF-CV05') cv05++; }
    }
    out['g-pilot-memo-cv05'] = `${cv05} of ${all}`;
    const usd = /About ([\d.]+)–([\d.]+) USD API-equivalent per step turn/i.exec(ctx.read('Docs/v1.3/study2-outline.md'));
    const lo = Number(usd[1]); const hi = Number(usd[2]);
    out['g-pilot-memo-usd-turn'] = `${lo}–${hi} USD`;
    const turns2 = cb.stepTurns + cb.maxRepairTurns;
    const turns3 = tasks.length * (arms + 1) * k + cb.maxRepairTurns;
    out['g-pilot-memo-usd-2arm'] = `about ${round10(lo * turns2)}–${round10(hi * turns2)} USD`;
    out['g-pilot-memo-usd-mcp'] = `about ${round10(lo * turns3)}–${round10(hi * turns3)} USD`;
    out['g-pilot-memo-hash-block'] = sha(block);
    const byId = Object.fromEntries(tasks.map((x) => [x.id, sha(JSON.stringify(x))]));
    out['g-pilot-memo-hash-market'] = byId['market-vendors'];
    out['g-pilot-memo-hash-shelter'] = byId['shelter-adoptions'];
    out['g-pilot-memo-hash-relief'] = byId['relief-volunteers'];
    const tf = sha(readFileSync(ctx.p(plan.tasksFile)));
    out['g-pilot-ready-tasksfile-hash'] = tf === sha(block) ? `${tf.slice(0, 8)}…${tf.slice(-6)}` : `differs ${tf}`;
    out['g-pilot-ready-runs'] = String(plan.runs);
    const tasksFile = ctx.json(plan.tasksFile).tasks;
    const kf = [...new Set(tasksFile.map((x) => x.steps.length))];
    out['g-pilot-ready-k'] = kf.length === 1 ? `${kf[0]} (each task has ${kf[0]} steps)` : `mixed ${kf.join('/')}`;
    out['g-pilot-ready-orderseed'] = String(plan.orderSeed);
    out['g-pilot-ready-orderseed-2'] = String(plan.orderSeed);
    out['g-pilot-ready-timeout'] = `${plan.timeoutMs.toLocaleString('en-US').replace(/,/g, ' ')}, ${plan.allowBash}`;
    out['g-pilot-ready-callbudget'] = `{ runs: ${cb.runs}, stepTurns: ${cb.stepTurns}, maxRepairTurns: ${cb.maxRepairTurns}, maxCalls: ${cb.maxCalls} }`;
    out['g-pilot-ready-budget-runs'] = `${tasks.length} tasks × ${arms} arms = ${cb.runs} runs, each of ${k} step turns: ${cb.stepTurns} step turns`;
    out['g-pilot-ready-budget-repair'] = `${tasks.length} tasks × ${k} steps = at most ${cb.maxRepairTurns} repair turns`;
    out['g-pilot-ready-budget-calls'] = `at most **${cb.maxCalls} model calls**`;
    out['g-pilot-ready-retries'] = `retried at most ${['zero', 'once', 'twice', 'three times'][pcb.retries]}`;
    const ddd = Object.values(plan.taskProfiles).filter((p) => p.specMode === 'ise-step1').length * arms * plan.runs;
    out['g-pilot-ready-freezes'] = `${ddd} freezes, one per DDD run`;
    out['g-pilot-ready-usd'] = `about ${lo * cb.stepTurns} to ${hi * cb.maxCalls} USD API-equivalent (${cb.stepTurns} to ${cb.maxCalls} turns)`;
    out['g-pilot-ready-hash-first'] = sha(pcb.a);
    out['g-pilot-ready-hash-next'] = sha(pcb.b);
    out['g-pilot-ready-hash-repair'] = sha(pcb.c);
    out['g-pilot-ready-hash-clean'] = sha(readFileSync(ctx.p('specs/clean-arch.yaml')));
    out['g-pilot-ready-hash-hex'] = sha(readFileSync(ctx.p('presets/hexagonal.yaml')));
    out['g-pilot-ready-hash-ddd'] = sha(readFileSync(ctx.p('presets/ddd.yaml')));
    return out;
  },
}, {
  id: 'g-pilot-loopdry',
  title: 'Loop pilot plan dry run (stub generators and firewall, ISE-frozen DDD specs)',
  needs: 'offline',
  basis: 'regenerated',
  slow: false,
  how: 'npx tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run --out-root <scratch> (in a scratch export of HEAD)',
  numbers: [
    r('dry-runs', 101, 'dry run: runs completed, step turns', '6 runs complete, 24 step turns'),
    r('dry-repairs', 101, 'dry run: repair turns', '4 repair turns', {
      known: { actual: '6 repair turns', note: 'The dry run at HEAD (and at the doc\'s own commit b5a18385) runs 6 repair turns: the stub plants a blocking import at steps 2 and 4 in each of the 3 gate runs.' } }),
    r('dry-cleared', 101, 'dry run: repair turns that cleared every blocking finding', 'all 4 cleared', {
      known: { actual: 'all 6 cleared', note: 'Same cause: 6 repair turns, all cleared (turnsThisInvocation.repairsCleared = 6).' } }),
    r('dry-outcome', 101, 'dry run: repairOutcome per repair (removed, introduced)', '`repairOutcome` removed 1, introduced 0'),
    r('dry-budget', 101, 'dry run summary: callBudget printed', '`callBudget` `{ runs: 6, stepTurns: 24, maxRepairTurns: 12, maxCalls: 36 }`'),
  ],
  async run(ctx) {
    const tree = ctx.tree();
    const outRoot = ctx.out('g-pilot-loopdry');
    const stdout = ctx.sh(`node --import tsx scripts/loop-harness-cli.ts --plan experiments/loop-pilot/plan.json --dry-run --out-root ${outRoot}`, { cwd: tree });
    const s = JSON.parse(stdout.slice(stdout.lastIndexOf('\n{') + 1));
    const out = {};
    out['g-pilot-dry-runs'] = `${s.completed} runs complete, ${s.turnsThisInvocation.step} step turns`;
    out['g-pilot-dry-repairs'] = `${s.turnsThisInvocation.repair} repair turns`;
    out['g-pilot-dry-cleared'] = s.turnsThisInvocation.repairsCleared === s.turnsThisInvocation.repair ? `all ${s.turnsThisInvocation.repair} cleared` : `${s.turnsThisInvocation.repairsCleared} of ${s.turnsThisInvocation.repair} cleared`;
    const outcomes = walk(join(outRoot, 'runs')).filter((p) => /steps\/step-\d+\.json$/.test(p))
      .map((p) => JSON.parse(readFileSync(p, 'utf8')).repairOutcome).filter(Boolean);
    const rem = [...new Set(outcomes.map((o) => o.removed))]; const intr = [...new Set(outcomes.map((o) => o.introduced))];
    out['g-pilot-dry-outcome'] = rem.length === 1 && intr.length === 1 ? `\`repairOutcome\` removed ${rem[0]}, introduced ${intr[0]}` : `removed ${rem.join('/')}, introduced ${intr.join('/')}`;
    const cb = s.callBudget;
    out['g-pilot-dry-budget'] = `\`callBudget\` \`{ runs: ${cb.runs}, stepTurns: ${cb.stepTurns}, maxRepairTurns: ${cb.maxRepairTurns}, maxCalls: ${cb.maxCalls} }\``;
    return out;
  },
}];
