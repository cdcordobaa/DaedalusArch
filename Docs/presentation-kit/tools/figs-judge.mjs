// F6 judge catch per operator and round; F7 three-way (cheap proxies vs judge vs symbolic rules).
import { C, FIG, W, frame, save, text, rect, line } from './kit.mjs';
import { pbars, legendRow, whiskerNote } from './charts.mjs';

const R1 = '#8FB3DE';
const R2 = '#2F6DB5';
const V2 = '#173C6E';
const ALL = C.ink;

// ---------------- F6 ----------------
{
  const top = 150;
  const lw = 880;
  const rows = [
    { label: ['AP-REPO-BYPASS', 'ORM handle instead of repository'], bars: [{ k: 4, n: 4, color: R1 }] },
    { label: ['AP-FAT-CONTROLLER', 'business logic in a controller'], bars: [{ k: 1, n: 1, color: R1 }] },
    { label: ['AP-PERSIST-IN-DOMAIN', 'ORM mapping on a domain class'], bars: [{ k: 1, n: 1, color: R1 }, { k: 3, n: 3, color: R2, label: '3/3 (hand-planted)' }] },
    { label: ['AP-FRAMEWORK-LEAK', 'framework type in the core'], bars: [{ k: 2, n: 4, color: R1 }, { k: 10, n: 13, color: R2, label: '10/13 (E1 6/8 + hand 4/5)' }] },
    { label: ['AP-DUP-RULE', 'business rule copied'], bars: [{ k: 1, n: 1, color: R1 }, { k: 8, n: 8, color: R2 }, { k: 9, n: 9, color: V2, label: '9/9 (v2: same code, re-judged)' }] },
    { label: 'Pooled', bold: true, sep: true, bars: [{ k: 9, n: 11, color: R1 }, { k: 21, n: 24, color: R2 }, { k: 9, n: 9, color: V2 }, { k: 30, n: 35, color: ALL, strong: true, label: '30/35 all rounds' }] },
  ];
  const [l1, h1] = pbars(48, top, lw, { title: 'Catch: the judge fails the unit holding the planted anti-pattern', rows, labelW: 300, valueW: 250, barH: 19 });
  const rx = 48 + lw + 50;
  const rw = W - 48 - rx;
  const rows2 = [
    { label: ['Neutral twins', 'fail = false alarm'], bars: [{ k: 3, n: 33, color: R1 }, { k: 5, n: 14, color: R2 }, { k: 2, n: 9, color: V2 }] },
    { label: ['All twins', 'pooled'], bold: true, bars: [{ k: 8, n: 47, color: C.s.before, label: '8/47 (v1 twin)' }, { k: 4, n: 50, color: ALL, strong: true, label: '4/50 (v2 twin)' }] },
    { label: ['Clean units', 'fail = false alarm'], sep: true, bars: [{ k: 2, n: 24, color: R1 }, { k: 1, n: 24, color: R2 }, { k: 2, n: 14, color: V2 }] },
  ];
  const [l2, h2] = pbars(rx, top, rw, { title: 'False fails (lower is better)', rows: rows2, labelW: 170, valueW: 130, barH: 19, ticks: [0, 0.25, 0.5] .concat([0.75, 1]) });
  let b = l1 + l2;
  let y = top + Math.max(h1, h2) + 22;
  const [lg] = legendRow(48, y, [[R1, 'round 1: fixture (antipattern-nest)'], [R2, 'round 2: E1 projects + hand-planted variants'], [V2, 'DUP-RULE v2: fixed twin'], [ALL, 'pooled']], 16);
  b += lg;
  y += 28;
  b += text(48, y, whiskerNote + ' Each catch is judge-only on E1 and the fixture: no symbolic rule fired on those seeds.', { size: 15, fill: C.muted });
  y += 26;
  b += rect(48, y, W - 96, 64, { rx: 10, fill: C.devSoft });
  b += text(66, y + 27, 'Read it as construct sensitivity, not a detection rate: 35 seeds, 10 of round 1 on one 8-file fixture, and the DUP-RULE catch is confounded', { size: 17 });
  b += text(66, y + 51, 'with a "foreign method" cue (the judge also fails a service that only gains an unrelated method).', { size: 17 });
  y += 64 + 20;
  const svg = frame({
    title: 'LLM judge: catches planted anti-patterns, quiet on twins?',
    subtitle: 'Frozen judge (claude-opus-5-5, 3 runs, majority vote). Seeds = planted anti-patterns; twins = the same edit without the defect.',
    badgeKind: 'dev',
    body: b,
    height: y + 80,
    footer: ['Round 1: Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md §3 · Round 2: Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md §3 · DUP-RULE v2 and pooled: Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md §3 ("Pooled across rounds").', 'Results: results/v1.3-judge-catch/{scores.json, round2/scores.json, duprule-v2/scores.json}.'],
  });
  save(FIG, 'F6-judge-catch', svg, `
# F6 · judge-catch

**Title on slide:** LLM judge: does it fail planted anti-patterns, and stay quiet on twins?

**What it shows.** Left: for each planted anti-pattern (operator), the share of seeds where the frozen judge fails the unit that holds it, per round (round 1 on the \`antipattern-nest\` fixture; round 2 on E1 generated projects and hand-planted reference variants; DUP-RULE v2 re-judging the same DUP-RULE seeds with a fixed twin), and pooled. Right: false fails, on neutral twins (the same edit without the defect) and on clean units. Bars are proportions; whiskers are 95% Wilson intervals (where the doc prints the interval, it matches).

**One idea.** The judge catches most planted anti-patterns (30/35) and, with the fixed twin, rarely fails a neutral control (4/50); its weak spot is the framework leak (12/17 over all rounds).

**Numbers and sources.**
- Round 1 (\`Docs/DiagnosticRuns/v1.3-judge-catch-2026-10-15.md\` §3): REPO-BYPASS 4/4; DUP-RULE 1/1; FAT-CONTROLLER 1/1; PERSIST-IN-DOMAIN 1/1; FRAMEWORK-LEAK 2/4; pooled 9/11 = 0.82 [0.52, 0.95]; twins 3/33 = 0.09 [0.03, 0.24]; clean units 2/24 = 0.08 [0.02, 0.26].
- Round 2 (\`Docs/DiagnosticRuns/v1.3-judge-catch-round2-2026-10-15.md\` §3): DUP-RULE (E1) 8/8; FRAMEWORK-LEAK combined 10/13 = 0.77 [0.50, 0.92] (E1 6/8, hand-planted 4/5); PERSIST-IN-DOMAIN hand-planted 3/3; pooled 21/24 = 0.88 [0.69, 0.96]; twins 5/14 = 0.36 [0.16, 0.61]; clean units 1/24 = 0.04 [0.01, 0.20].
- DUP-RULE v2 (\`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md\` §3): seeds 9/9 = 1.00 [0.70, 1.00]; twins 2/9 = 0.22 [0.06, 0.55]; clean units 2/14 = 0.14 [0.04, 0.40].
- Pooled across rounds (same doc, "Pooled across rounds"): seeds **30/35 = 0.86 [0.71, 0.94]** (unchanged with v1 or v2 DUP-RULE); twin false fail **8/47 = 0.17 [0.09, 0.30]** with the v1 twin, **4/50 = 0.08 [0.03, 0.19]** with v2. Other positives: FRAMEWORK-LEAK 12/17, PERSIST-IN-DOMAIN 4/4, REPO-BYPASS 4/4, FAT-CONTROLLER 1/1.

**Caveats to say.** Development data; construct sensitivity, not a validity estimate; n = 35 seeds; no pre-registration (author decision). The DUP-RULE catch is consistent with both the duplication and the foreign-method cue (v2 doc §4). E1 is development data for v1.3.
`);
}

// ---------------- F7 ----------------
{
  const top = 150;
  const PX = C.s.proxy;
  const JU = C.s.judge;
  const RU = C.s.rules;
  const lw = 940;
  const rows = [
    { label: 'AP-REPO-BYPASS', bars: [{ k: 4, n: 4, color: PX }, { k: 4, n: 4, color: JU }, { k: 0, n: 4, color: RU }] },
    { label: 'AP-FAT-CONTROLLER', bars: [{ k: 1, n: 1, color: PX }, { k: 1, n: 1, color: JU }, { k: 0, n: 1, color: RU }] },
    { label: 'AP-PERSIST-IN-DOMAIN', bars: [{ k: 1, n: 1, color: PX }, { k: 1, n: 1, color: JU }, { k: 0, n: 1, color: RU }] },
    { label: 'AP-DUP-RULE', bars: [{ k: 1, n: 1, color: PX }, { k: 1, n: 1, color: JU }, { k: 0, n: 1, color: RU }] },
    { label: 'AP-FRAMEWORK-LEAK', bars: [{ k: 4, n: 4, color: PX }, { k: 2, n: 4, color: JU }, { k: 0, n: 4, color: RU }] },
    { label: ['Pooled', '11 round-1 seeds'], bold: true, sep: true, bars: [{ k: 11, n: 11, color: PX, strong: true }, { k: 9, n: 11, color: JU, strong: true }, { k: 0, n: 11, color: RU, strong: true }] },
    { label: ['DUP-RULE v2', '9 seeds, 8 on E1'], sep: true, bars: [{ k: 2, n: 9, color: PX, label: '2/9 (either proxy)' }, { k: 9, n: 9, color: JU }, { k: 0, n: 9, color: RU }] },
  ];
  const [l1, h1] = pbars(48, top, lw, { title: 'Seeds caught, by instrument', rows, labelW: 260, valueW: 170, barH: 18, barGap: 4 });
  const rx = 48 + lw + 50;
  const rw = W - 48 - rx;
  let b = l1;
  // right column: the less circular checks
  let y = top;
  b += text(rx, y + 22, 'Checks that are less circular', { size: 22, weight: 700 });
  y += 50;
  const cards = [
    ['6/6', 'hand-written analogues caught by the proxies', 'reference variants written before the proxies (3 ORM decorators in the domain, 3 express types in the core)', PX],
    ['14 flags / 146 files', 'proxy false flags on the 5 clean reference projects', 'after one revision on these same projects (101 before it): tuned on the development set', PX],
    ['0/11', 'v1.3 symbolic rules on the round-1 seeds', 'the proxies read what the rules do not: call receivers, signature types, decorators, duplicated statements', RU],
  ];
  for (const [big, what, why, col] of cards) {
    b += rect(rx, y, rw, 150, { rx: 12, fill: '#FFFFFF', stroke: C.grid, sw: 1.5 });
    b += rect(rx, y, 8, 150, { rx: 3, fill: col });
    b += text(rx + 26, y + 46, big, { size: 32, weight: 700, fill: col });
    b += text(rx + 26, y + 76, what, { size: 17, weight: 600 });
    const wl = (await_wrap(why, rw - 50));
    wl.forEach((l, i) => (b += text(rx + 26, y + 102 + i * 21, l, { size: 15, fill: C.muted })));
    y += 165;
  }
  let yb = top + Math.max(h1, y - top) + 16;
  const [lg] = legendRow(48, yb, [[PX, 'cheap proxies (no LLM)'], [JU, 'LLM judge'], [RU, 'symbolic v1.3 rules']]);
  b += lg + text(W - 48, yb, whiskerNote, { size: 15, fill: C.muted, anchor: 'end' });
  yb += 26;
  b += rect(48, yb, W - 96, 64, { rx: 10, fill: C.devSoft });
  b += text(66, yb + 27, 'Circular by construction: each proxy was written after the operators and the round-1 results were read. On real E1 copies (DUP-RULE v2)', { size: 17 });
  b += text(66, yb + 51, 'the proxies fall to 2/9 while the judge stays at 9/9: guard-shaped and same-component copies pass their filters.', { size: 17 });
  yb += 64 + 20;
  const svg = frame({
    title: 'Three instruments on the same planted seeds',
    subtitle: 'Cheap deterministic proxies vs the LLM judge vs the symbolic rules, on the 11 round-1 seeds, plus the 9 DUP-RULE v2 seeds.',
    badgeKind: 'dev',
    body: b,
    height: yb + 80,
    footer: ['Round-1 three-way: Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md §2–3 (results/v1.3-cheap-semantics/scores.json); analogues §4; clean-project flags §5–6.', 'DUP-RULE v2 three-way: Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md §5 (results/v1.3-cheap-semantics/duprule-v2/).'],
  });
  save(FIG, 'F7-proxies-judge-rules', svg, `
# F7 · proxies-judge-rules

**Title on slide:** Three instruments on the same planted seeds

**What it shows.** For the 11 round-1 seeds (five anti-pattern operators on the \`antipattern-nest\` fixture), the share caught by the designated cheap proxy (orange; deterministic, no LLM), by the LLM judge (blue) and by the symbolic v1.3 rules (green); plus the 9 DUP-RULE v2 seeds (8 of them on E1 projects). On the right, the three less circular checks: hand-written analogues, false flags on the clean reference projects, and the symbolic rules' blind spot.

**One idea.** The three instruments see different things: the symbolic rules see none of these semantic anti-patterns; the proxies match the judge on the fixture they were written for, but not on real generated code.

**Numbers and sources.**
- Round-1 three-way (\`Docs/DiagnosticRuns/cheap-semantics-2026-10-15.md\` §2, §3): proxy (primary) 4/4, 1/1, 1/1, 1/1, 4/4, pooled **11/11 = 1.00 [0.74, 1.00]**; judge 4/4, 1/1, 1/1, 1/1, 2/4, pooled **9/11**; symbolic 0/11. Proxy twin false flags raw 2/42, paired 0/42.
- Hand-written analogues: **6/6 [0.61, 1.00]** (§4).
- Clean reference projects: **14** defect flags over **146** files (§5 table, Total), down from 101 before one revision made on those same projects (§6). So the 14 is a tuned-on-dev number.
- DUP-RULE v2 (\`Docs/DiagnosticRuns/v1.3-duprule-v2-2026-10-15.md\` §5): judge **9/9 = 1.00 [0.70, 1.00]**; cheap \`clones\` 1/9, \`shared-literals\` 2/9, either **2/9 = 0.22 [0.06, 0.55]**; symbolic 0/9.

**Caveats to say.** Circular by construction (the proxies were written after reading the operators and round-1 results); 10 of 11 round-1 seeds on one 8-file fixture; development data, no pre-registration.
`);
}

function await_wrap(s, w) {
  // local wrapper to keep the import list short
  const words = s.split(' ');
  const out = [];
  let cur = '';
  for (const x of words) {
    const t = cur ? cur + ' ' + x : x;
    if (t.length * 15 * 0.53 > w && cur) {
      out.push(cur);
      cur = x;
    } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}
