// Docs/v1.3/night-backlog-2026-10-16.md: the checkable current facts the plan asserts (job and finding counts, the
// 71 reference variants, DDD overlays, pilot tasks, judge cassettes and rates, interpreter timings, Study 2 outline
// figures), re-derived from the committed tree; facts that live only on unmerged branches are listed as needs-external.
import { judgeCatch } from './h-post-merge-review.mjs';

const DOC = 'Docs/v1.3/night-backlog-2026-10-16.md';
const N = (id, line, what, stated, extra = {}) => ({ id, doc: DOC, line, what, stated, ...extra });

const repo = {
  id: 'h-nb-repo',
  title: 'night backlog: counts and figures it asserts about the repository at HEAD',
  needs: 'offline',
  basis: 're-derived',
  slow: false,
  how: 'count headings (backlog jobs, review findings); variants in results/v1.3-reference/after-member-facts/report.json; overlays with VIOLATION/Allowed comments in tests/fixtures/v1.3-reference/ddd/variants; Docs/v1.3/pilot-tasks.md JSON block; judge cassettes with 3 runs; RUNS_PER_EVALUATION; results/v1.3-cypher-interp/{bench.md,parity/parity-by-template.json}; Docs/v1.3/study2-outline.md §6; the pilot dry run and the replay share those tasks',
  numbers: [
    N('h-nb-l1-jobs', 1, 'jobs in the backlog (### #n headings)', '26 new jobs'),
    N('h-nb-l3-findings', 3, 'findings in the post-merge review', '31 findings'),
    N('h-nb-l8-runs', 8, 'judge runs per item in the committed cassettes', '3 runs per item'),
    N('h-nb-l8-items', 8, 'judge cassette items with 3 recorded runs (prompt keys with 3 run files, rounded to 10)', '~230 items'),
    N('h-nb-l18-ref', 18, 'reference results (variants of the after-member-facts run)', 'The 71 reference results'),
    N('h-nb-l39-maj', 39, 'judge verdict = majority of N runs (RUNS_PER_EVALUATION)', 'majority of 3 runs'),
    N('h-nb-l117-ms', 117, 'interpreter graph stages per evaluation (bench, clean-architecture/clean: ingest + evaluate + scores, rounded to 10 ms)', '~20 ms'),
    N('h-nb-l120-ref', 120, 'reference variants', '71 reference variants'),
    N('h-nb-l275-tasks', 275, 'pilot tasks in Docs/v1.3/pilot-tasks.md', '3 pilot tasks'),
    N('h-nb-l275-steps', 275, 'steps per pilot task', 'steps 1–4'),
    N('h-nb-l427-time', 427, 'warm evaluation per snapshot, interpreter vs Neo4j (bench.md, clean-architecture/clean)', '0.15 s vs 0.7 s'),
    N('h-nb-l427-steps', 427, 'Study 2 step turns: a rough figure that must lie inside the outline §6 range (roughly 650–970 step turns)', '~900 steps'),
    N('h-nb-l531-ddd', 531, 'DDD overlays carrying a VIOLATION or Allowed comment', 'all 14 DDD overlays'),
    N('h-nb-l534-ref', 534, 'reference variants', 'all 71 variants'),
    N('h-nb-l581-dry', 581, 'tasks x steps of the pilot dry run and the replay (experiments/loop-pilot/plan.json; REPLAY_TAPES, merged with #142)', '3 tasks × 4 steps'),
    N('h-nb-l581-runs', 581, 'Study 2 runs (outline §6)', '~162 runs'),
    N('h-nb-l581-steps', 581, 'Study 2 step turns: a rough figure that must lie inside the outline §6 range (roughly 650–970 step turns)', '~900 steps'),
    N('h-nb-l581-arms', 581, 'Study 2 arms (outline §6)', '3 arms'),
    N('h-nb-l658-usd', 658, 'outline §6 cost guess per turn', '2–6 USD per turn'),
    N('h-nb-l658-days', 658, 'outline §6 wall-time guess', '1–3 days'),
    N('h-nb-l727-ms', 727, 'interpreter time per graph stage (bench, rounded to 10 ms)', '20 ms per graph stage'),
    N('h-nb-l732-stmts', 732, 'interpreter parity statements (parity-by-template.json)', '65k statements'),
    N('h-nb-l733-ahs', 733, 'AHS versions reported', 'Two AHS versions', { needs: 'not-checkable', note: 'Docs/v1.3/rule-tiers.md:3 says both AHS versions (v1.2E weighting and v1.3 tiers) are reported; no single committed artefact lists the reported AHS versions to count' }),
  ],
  async run(ctx) {
    const backlog = ctx.read(DOC).split('\n');
    const jobs = backlog.filter((l) => /^### #\d+ /.test(l)).length;
    const findings = ctx.read('Docs/v1.3/post-merge-review-2026-10-16.md').split('\n').filter((l) => /^## R\d+ \[/.test(l)).length;
    const rep = ctx.json('results/v1.3-reference/after-member-facts/report.json');
    const variants = rep.metrics.reduce((s, m) => s + m.variants, 0);
    const runsPer = Number(/RUNS_PER_EVALUATION = (\d+)/.exec(ctx.read('src/llm-critic/frozen.ts'))[1]);
    // cassettes: <store>/<shard>/<sha256>-r<run>-<n>.json; count (store, prompt key) pairs with exactly
    // RUNS_PER_EVALUATION run files (a key can recur in two stores, e.g. a round-2 prompt re-judged in CHECK)
    const files = ctx.sh('find tests/fixtures/judge-cassettes-v13 -type f -name "*.json"').trim().split('\n');
    const perKey = new Map();
    for (const f of files) {
      const m = /^(.*)\/[0-9a-f]{2}\/([0-9a-f]{64})-r\d+-\d+\.json$/.exec(f);
      if (m) perKey.set(`${m[1]}|${m[2]}`, (perKey.get(`${m[1]}|${m[2]}`) ?? 0) + 1);
    }
    const threeRun = [...perKey.values()].filter((c) => c === runsPer).length;
    // DDD overlays with an answer-revealing comment (// or /** ... VIOLATION / Allowed)
    const D = 'tests/fixtures/v1.3-reference/ddd/variants';
    let leaky = 0; const overlays = ctx.ls(D).filter((v) => ctx.exists(`${D}/${v}/overlay`));
    for (const v of overlays) {
      const hit = ctx.sh(`grep -rlE '(//|/\\*\\*?)[[:space:]]*(VIOLATION|Allowed)' ${D}/${v}/overlay || true`).trim();
      if (hit) leaky++;
    }
    const ddd = leaky === overlays.length ? `all ${overlays.length} DDD overlays` : `${leaky} of ${overlays.length} DDD overlays`;
    const pt = ctx.read('Docs/v1.3/pilot-tasks.md');
    const json = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(pt)[1]);
    const tasks = json.tasks ?? json;
    const steps = [...new Set(tasks.map((t) => t.steps.length))];
    // bench.md: warm median and the graph stages (ingest-apg + evaluate-symbolic + compute-scores) of one variant
    const bench = ctx.read('results/v1.3-cypher-interp/bench.md').split('\n');
    const brow = (engine) => bench.find((l) => l.startsWith(`| clean-architecture/clean | ${engine} |`)).split('|').map((c) => c.trim());
    const bi = brow('cypher-interp'); const bn = brow('neo4j');
    const warm = (r) => Number(r[4].replace(' ms', '')) / 1000;
    const stages = Number(bi[6]) + Number(bi[7]) + Number(bi[8]);
    const ms10 = Math.round(stages / 10) * 10;
    const parity = ctx.json('results/v1.3-cypher-interp/parity/parity-by-template.json');
    const stmts = parity.rows.reduce((s, r) => s + r.statements, 0);
    const outline = ctx.read('Docs/v1.3/study2-outline.md');
    const runs = /\*\*(\d+) runs\*\*/.exec(outline)[1];
    const turns = /roughly (\d+)–(\d+) step turns/.exec(outline);
    // "~N steps" is a rough figure taken from the outline's range: it reproduces when N lies inside that range
    const inRange = (n) => (n >= Number(turns[1]) && n <= Number(turns[2]) ? `~${n} steps` : `${turns[1]}–${turns[2]} step turns (~${n} is outside)`);
    const arms = /\| Arms \| (\d+) \|/.exec(outline)[1];
    const usd = /about (\d+–\d+) USD/.exec(outline)[1];
    const days = /about (\d+–\d+) days/.exec(outline)[1];
    return {
      'h-nb-l1-jobs': `${jobs} new jobs`,
      'h-nb-l3-findings': `${findings} findings`,
      'h-nb-l8-runs': `${runsPer} runs per item`,
      'h-nb-l8-items': `~${Math.round(threeRun / 10) * 10} items`,
      'h-nb-l18-ref': `The ${variants} reference results`,
      'h-nb-l39-maj': `majority of ${runsPer} runs`,
      'h-nb-l117-ms': `~${ms10} ms`,
      'h-nb-l120-ref': `${variants} reference variants`,
      'h-nb-l275-tasks': `${tasks.length} pilot tasks`,
      'h-nb-l275-steps': steps.length === 1 ? `steps 1–${steps[0]}` : `steps ${steps.join('/')}`,
      'h-nb-l427-time': `${warm(bi).toFixed(2)} s vs ${warm(bn).toFixed(1)} s`,
      'h-nb-l427-steps': inRange(900),
      'h-nb-l531-ddd': ddd,
      'h-nb-l534-ref': `all ${variants} variants`,
      'h-nb-l581-dry': `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} × ${steps.join('/')} steps`,
      'h-nb-l581-runs': `~${runs} runs`,
      'h-nb-l581-steps': inRange(900),
      'h-nb-l581-arms': `${arms} arms`,
      'h-nb-l658-usd': `${usd} USD per turn`,
      'h-nb-l658-days': `${days} days`,
      'h-nb-l727-ms': `${ms10} ms per graph stage`,
      'h-nb-l732-stmts': `${Math.round(stmts / 1000)}k statements`,
    };
  },
};

const judge = {
  id: 'h-nb-judge',
  title: 'night backlog: judge headline and CHECK clean false-fail rates',
  needs: 'offline',
  basis: 'replayed',
  slow: false,
  how: 'judge-catch rounds 1 and 2 replayed from cassettes (judge-catch-score.ts, judge-catch2-score.ts; FRAMEWORK-LEAK + PERSIST-IN-DOMAIN over both rounds); npx tsx scripts/v1.3/judge-v2-score.ts --split CHECK --v2 check-v2.1 --runs majority --v1-override check-v1-current-graph --out <scratch>',
  numbers: [
    N('h-nb-l8-rate', 8, 'judge headline catch (both rounds, FRAMEWORK-LEAK + PERSIST-IN-DOMAIN)', '0.76'),
    N('h-nb-l39-head', 39, 'judge headline catch (both rounds, FRAMEWORK-LEAK + PERSIST-IN-DOMAIN)', '16/21 = 0.76'),
    N('h-nb-l39-v1', 39, 'CHECK clean false-fail (units), judge v1', 'v1 clean false-fail 0.08'),
    N('h-nb-l39-v21', 39, 'CHECK clean false-fail (units), judge v2.1', 'v2.1 0.15'),
  ],
  async run(ctx) {
    const { both } = judgeCatch(ctx);
    const out = ctx.out('h-nb-judge');
    ctx.sh(`npx tsx scripts/v1.3/judge-v2-score.ts --split CHECK --v2 check-v2.1 --runs majority --v1-override check-v1-current-graph --out ${out}/check.md`, { cwd: ctx.tree() });
    const md = ctx.read(`${out}/check.md`).split('\n');
    const cleanFF = (judge) => {
      const cells = md.find((l) => l.startsWith(`| ${judge} | `)).split(' | ');
      return / = ([\d.]+) /.exec(cells[5])[1];
    };
    return {
      'h-nb-l8-rate': ctx.f2(both.k / both.n),
      'h-nb-l39-head': `${both.k}/${both.n} = ${ctx.f2(both.k / both.n)}`,
      'h-nb-l39-v1': `v1 clean false-fail ${cleanFF('v1')}`,
      'h-nb-l39-v21': `v2.1 ${cleanFF('v2')}`,
    };
  },
};

const EXT = (branch) => `only on the unmerged branch ${branch}; not in the tree at HEAD`;
const external = {
  id: 'h-nb-external',
  title: 'night backlog: facts that live on unmerged PR branches (#133, #142, #146, #160, #161)',
  needs: 'needs-external',
  basis: 're-derived',
  how: 'read the results/docs on the named PR branches (origin/v1.3-external-set, -loop-replay, -study2-readiness, -study2-analysis-rehearsal, -floor-probe); none is merged at HEAD',
  numbers: [
    N('h-nb-l3-gate', 3, 'readiness gate lines green (#146)', '1 green of 42', { note: EXT('origin/v1.3-study2-readiness (PR #146)') }),
    N('h-nb-l7-ext', 7, 'external set blocking findings (#133)', '283 blocking findings', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l7-labels', 7, 'labels on the external set (#133)', 'zero labels', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l9-floor', 9, 'hexagonal none-arm steps with a blocking finding (#161)', '0/14', { note: EXT('origin/v1.3-floor-probe (PR #161)') }),
    N('h-nb-l9-humans', 9, 'human-written repos that fail (#133)', '10 of 15', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l10-gate', 10, 'readiness gate lines green (#146)', '1/42', { note: EXT('origin/v1.3-study2-readiness (PR #146)') }),
    N('h-nb-l91-ext', 91, 'external set blocking findings (#133)', '283 blocking findings', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l91-repos', 91, 'human-written repos in the external set (#133)', '15 human-written repos', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l94-ext', 94, 'external set blocking findings (#133)', '283', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l143-floor', 143, 'hexagonal none-arm steps with a blocking finding (#161)', '0/14', { note: EXT('origin/v1.3-floor-probe (PR #161)') }),
    N('h-nb-l144-tasks', 144, 'new probe tasks of #161', '4 new probe tasks', { note: EXT('origin/v1.3-floor-probe (PR #161)') }),
    N('h-nb-l169-humans', 169, 'human-written repos that fail (#133)', '10/15', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l376-a1', 376, 'studies where sign-flip test and cluster bootstrap disagree (#160 A1)', '13%', { note: EXT('origin/v1.3-study2-analysis-rehearsal (PR #160)') }),
    N('h-nb-l376-dup', 376, 'FF-S01/FF-S03 double count of the same edge (#161 §5.4)', 'up to 2×', { note: EXT('origin/v1.3-floor-probe (PR #161)') }),
    N('h-nb-l379-cal', 379, 'seeds in the analysis calibration run (#160)', '200-seed', { note: EXT('origin/v1.3-study2-analysis-rehearsal (PR #160)') }),
    N('h-nb-l379-checks', 379, 'rehearsal checks passing (#160)', '30/30', { note: EXT('origin/v1.3-study2-analysis-rehearsal (PR #160)') }),
    N('h-nb-l430-snaps', 430, 'snapshots of the #142 replay', '39 snapshots', { needs: 'needs-Neo4j', note: '#142 merged into v1.3 after the first run of this package; the count is a figure of its Neo4j replay (Docs/v1.3/loop-replay.md:42, group i-lr-neo4j); the expected count from the tapes is 39 (i-lr-snapshots)' }),
    N('h-nb-l581-lanes', 581, 'lane concurrency rule', 'max 2 lanes', { note: 'no lane rule exists in the tree at HEAD (scripts/lib/loop, Docs/v1.3/study2-outline.md); presumably on the #142/#146 branches' }),
    N('h-nb-l607-ext', 607, 'external set blocking findings (#133)', '283 blocking findings', { note: EXT('origin/v1.3-external-set (PR #133)') }),
    N('h-nb-l713-tasks', 713, 'new probe tasks of #161', 'four new probe tasks', { note: EXT('origin/v1.3-floor-probe (PR #161)') }),
    N('h-nb-l723-gate', 723, 'readiness gate lines green (#146)', '1/42 green', { note: EXT('origin/v1.3-study2-readiness (PR #146)') }),
  ],
};

export default [repo, judge, external];
