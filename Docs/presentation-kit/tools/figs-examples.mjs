// B1-B4 worked rule examples (spec YAML -> compiled Cypher -> violating code -> finding) and B0 rule anatomy.
// Every snippet is copied from a committed file; the Cypher is the compiler's real output (data/compiled-cypher.json).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { C, FIG, EX, W, MONO, frame, readJson, save, text, rect, line, esc, wrap, pill, tw } from './kit.mjs';

const compiled = readJson('Docs/presentation-kit/data/compiled-cypher.json');
const tf = readJson('Docs/presentation-kit/data/type-flow.boundary-type-leak.json');
const CW = 0.602; // Menlo advance per px of font size

/** Monospace block; lines longer than the panel wrap with a 4-space hanging indent. hl: substrings to highlight. */
function code(x, y, w, src, o = {}) {
  const size = o.size ?? 15;
  const lh = size * 1.42;
  const max = Math.floor((w - 28) / (size * CW));
  const out = [];
  for (const raw of src) {
    let s = raw;
    let first = true;
    while (s.length > 0) {
      const room = first ? max : max - 4;
      out.push({ t: (first ? '' : '    ') + s.slice(0, room), src: raw });
      s = s.slice(room);
      first = false;
    }
    if (raw.length === 0) out.push({ t: '', src: raw });
  }
  let svg = '';
  out.forEach((l, i) => {
    const yy = y + 18 + i * lh;
    const isHl = (o.hl ?? []).some((h) => l.src.includes(h));
    const isOmit = l.src.trim().startsWith('// …') || l.src.trim().startsWith('# …');
    const isAdd = l.src.startsWith('+');
    if (isHl) svg += rect(x + 6, yy - size + 1, w - 12, lh, { fill: '#FDECEC' });
    else if (isAdd && o.diff) svg += rect(x + 6, yy - size + 1, w - 12, lh, { fill: '#E9F5EE' });
    svg += `<text x="${x + 14}" y="${yy}" font-family="${MONO}" font-size="${size}" fill="${isOmit ? C.faint : isHl ? C.red : C.ink}" xml:space="preserve"${isOmit ? ' font-style="italic"' : ''}>${esc(l.t)}</text>`;
  });
  return [svg, 18 + out.length * lh + 10];
}

function panel(x, y, w, h, n, title, sub) {
  let s = rect(x, y, w, h, { rx: 12, fill: '#FBFBFC', stroke: '#D7DCE3', sw: 1.5 });
  s += `<circle cx="${x + 26}" cy="${y + 28}" r="15" fill="${C.ink}"/>` + text(x + 26, y + 34, n, { size: 17, weight: 700, fill: '#fff', anchor: 'middle' });
  s += text(x + 52, y + 35, title, { size: 21, weight: 700 });
  if (sub) s += text(x + w - 16, y + 35, sub, { size: 16, fill: C.muted, anchor: 'end' });
  return s;
}

function card(ex) {
  const top = 160;
  const gap = 56;
  const w1 = 560;
  const w2 = W - 96 - w1 - gap;
  const x1 = 48;
  const x2 = x1 + w1 + gap;
  const [c1, h1] = code(x1, top + 52, w1, ex.spec, { hl: ex.specHl });
  const [c2, h2] = code(x2, top + 52, w2, ex.cypher, { size: 14.5, hl: ex.cypherHl });
  const hTop = Math.max(h1, h2) + 60;
  const y2 = top + hTop + gap;
  const w3 = 820;
  const w4 = W - 96 - w3 - gap;
  const x3 = 48;
  const x4 = x3 + w3 + gap;
  const [c3, h3] = code(x3, y2 + 52, w3, ex.code, { hl: ex.codeHl, diff: true });
  const findingLines = ex.finding;
  let fsvg = '';
  let fy = y2 + 72;
  for (const [k, v, strong] of findingLines) {
    fsvg += text(x4 + 18, fy, k, { size: 16, fill: C.muted, weight: 600 });
    const wl = wrapPath(v, w4 - 190, 17);
    wl.forEach((l, i) => (fsvg += text(x4 + 168, fy + i * 23, l, { size: 17, weight: strong ? 700 : 400, fill: strong === 'red' ? C.red : C.ink })));
    fy += Math.max(1, wl.length) * 23 + 9;
  }
  const h4 = fy - y2 - 40;
  const hBot = Math.max(h3, h4) + 60;
  let body = '';
  body += panel(x1, top, w1, hTop, '1', 'Spec (YAML)', path.basename(ex.specFile)) + c1;
  body += panel(x2, top, w2, hTop, '2', 'Compiled Cypher', 'real compiler output, trimmed') + c2;
  body += panel(x3, y2, w3, hBot, '3', 'Code that violates it', ex.codeFile) + c3;
  body += panel(x4, y2, w4, hBot, '4', 'What the tool reports', ex.findingTag) + fsvg;
  // arrows: 1 -> 2, 2 -> 4, 3 -> 4
  body += line(x1 + w1 + 6, top + 40, x2 - 8, top + 40, { sw: 3, marker: 'arr' });
  body += text(x1 + w1 + gap / 2, top + 28, 'compile', { size: 14, fill: C.muted, anchor: 'middle' });
  body += line(x4 + w4 / 2, top + hTop + 6, x4 + w4 / 2, y2 - 8, { sw: 3, marker: 'arr' });
  body += text(x4 + w4 / 2 + 12, top + hTop + gap / 2 + 5, 'run on the graph', { size: 15, fill: C.muted });
  body += line(x3 + w3 + 6, y2 + 40, x4 - 8, y2 + 40, { sw: 3, marker: 'arr' });
  body += text(x3 + w3 + gap / 2, y2 + 28, 'extract', { size: 14, fill: C.muted, anchor: 'middle' });
  let height = y2 + hBot + 30;
  if (ex.note) {
    const nl = wrap(ex.note, W - 140, 18);
    body += rect(48, height - 6, W - 96, nl.length * 25 + 22, { rx: 10, fill: ex.noteFill ?? C.devSoft, stroke: 'none' });
    nl.forEach((l, i) => (body += text(66, height + 19 + i * 25, l, { size: 18, fill: C.ink })));
    height += nl.length * 25 + 40;
  }
  height += 60;
  return frame({ title: ex.title, subtitle: ex.subtitle, badgeKind: 'dev', badgeLabel: ex.badge ?? 'DEVELOPMENT SET: reference variant', body, height, footer: ex.footer });
}

/** Word wrap that also breaks over-long paths after a '/'. */
function wrapPath(v, max, size) {
  const out = [];
  for (const l of wrap(v, max, size)) {
    if (tw(l, size) <= max) { out.push(l); continue; }
    let cur = '';
    for (const part of l.split(/(?<=\/)/)) {
      if (tw(cur + part, size) > max && cur) { out.push(cur); cur = part; } else cur += part;
    }
    if (cur) out.push(cur);
  }
  return out;
}

const cy = (k) => compiled[k].cypher.split('\n').map((l) => l.replace(/\s+$/, ''));

const EXAMPLES = [
  {
    id: 'B1-example-ffs01-clean',
    title: 'Worked rule 1 · Dependency direction (Clean Architecture)',
    subtitle: 'FF-S01: an import may only point inward, toward the domain. Blocking.',
    specFile: 'tests/fixtures/v1.3-reference/clean-architecture/spec.yaml',
    spec: ['architecture:', '  style: clean-architecture', '  layers:', '    - name: domain', '      directories: [src/domain/**]', '    - name: application', '      directories: [src/application/**]', '    - name: infrastructure', '      directories: [src/infrastructure/**]', '# … (roles omitted)', 'fitness_functions:', '  - id: FF-S01', '    name: dependency-direction', '    dimension: structural', '    severity: critical', '    route: symbolic'],
    specHl: ['FF-S01', 'dependency-direction'],
    cypher: (() => {
      const c = cy('B1');
      return [...c.slice(0, 8), '// … (RETURN of 9 columns and ORDER BY omitted)', '', '// $layerOrder = ' + JSON.stringify(compiled.B1.params.layerOrder)];
    })(),
    cypherHl: ['srcIdx < tgtIdx', '$layerOrder ='],
    codeFile: 'variant v02 (variant.patch)',
    code: ['// src/domain/services/LoanPolicy.ts   (domain layer)', "import { Loan } from '../entities/Loan';", "import { Member } from '../entities/Member';", "+import { SystemClock } from '../../infrastructure/system/SystemClock';", '', 'export class LoanPolicy {', '+  assertCanBorrowToday(member: Member, activeLoans: readonly Loan[]): void {', '+    this.assertCanBorrow(member, activeLoans, new SystemClock().now());', '+  }', '// … (rest of the class unchanged)'],
    codeHl: ['infrastructure/system/SystemClock'],
    findingTag: 'FF-S01 · blocking',
    finding: [
      ['rule', 'FF-S01 dependency-direction', true],
      ['severity / tier', 'critical / blocking'],
      ['file', 'src/domain/services/LoanPolicy.ts'],
      ['target', 'src/infrastructure/system/SystemClock.ts'],
      ['line', '4'],
      ['message', 'src/domain/services/LoanPolicy.ts (domain) imports from src/infrastructure/system/SystemClock.ts (infrastructure)', 'red'],
      ['also fires', 'FF-S04 no-domain-outward-dep (same edge)'],
      ['manifest', 'expected (FF-S01 and FF-S04): a true positive'],
    ],
    note: 'The rule is one edge pattern: an IMPORTS edge whose source layer comes before its target layer in $layerOrder (domain → application → infrastructure). The literal edge view (NOT viaReExport) is the v1.3 barrel fix.',
    footer: ['Sources: spec tests/fixtures/v1.3-reference/clean-architecture/spec.yaml · Cypher: compileFunctions(…, V13_COMPILE_OPTIONS), Docs/presentation-kit/data/compiled-cypher.json (B1)', 'Code: tests/fixtures/v1.3-reference/clean-architecture/variants/v02-domain-uses-infrastructure-clock · Finding: results/v1.3-reference/after-member-facts/evidence/clean-architecture/v02-domain-uses-infrastructure-clock.json'],
  },
  {
    id: 'B2-example-ffdt03-ddd',
    title: 'Worked rule 2 · Value-object immutability (DDD): a fixed miss',
    subtitle: 'FF-DT03: a value object must not be mutable. The first tool run missed a `set` accessor; extractor member facts closed it.',
    specFile: 'presets/ddd.yaml',
    spec: ['architecture:', '  style: ddd', '  ddd:', '    # … (contexts, aggregates omitted)', '    value_objects: ["src/**/value-objects/**"]', 'fitness_functions:', '  - id: FF-DT03', '    name: value-object-immutability', '    dimension: pattern', '    severity: critical', '    route: symbolic', '    tier: blocking'],
    specHl: ['FF-DT03', 'value-object-immutability', 'value_objects'],
    cypher: [...cy('B2').slice(0, 9), '// … (RETURN of 4 columns and ORDER BY omitted)', '', '// $valueObjectPatterns = ' + JSON.stringify(compiled.B2.params.valueObjectPatterns)],
    cypherHl: ['setAccessors'],
    codeFile: 'probe g01 (overlay)',
    code: ['// src/ordering/domain/value-objects/Quantity.ts', 'export class Quantity {', '  private current: number;', '  constructor(value: number) { /* … validates, then */ this.current = value; }', '  get value(): number { return this.current; }', '', '  set value(v: number) {', '    this.current = v;', '  }', '  // … plus(other) returns a new Quantity'],
    codeHl: ['set value('],
    findingTag: 'FF-DT03 · blocking',
    finding: [
      ['before', 'after-fixes run: no finding (miss M3)', true],
      ['after', 'after member facts: 1 finding', true],
      ['rule', 'FF-DT03 value-object-immutability'],
      ['severity / tier', 'critical / blocking'],
      ['file', 'src/ordering/domain/value-objects/Quantity.ts'],
      ['message', 'Value object Quantity in src/ordering/domain/value-objects/Quantity.ts is mutable through Quantity.value (set accessor)', 'red'],
      ['effect', 'DDD blocking recall 8/9 → 9/9; pooled 53/54 → 54/54'],
    ],
    note: 'Why it was missed: the v1.2E graph had no member facts, so a setter could only be found by its method name (setX). Member facts (readonly, set accessors, public fields) are now Class node properties, and the template reads them. Development-set result; g01 was added after the first tool run to test this very limit.',
    footer: ['Sources: presets/ddd.yaml · Cypher: Docs/presentation-kit/data/compiled-cypher.json (B2) · Code: tests/fixtures/v1.3-reference/ddd/variants/g01-value-object-setter-accessor', 'Finding: results/v1.3-reference/after-member-facts/evidence/ddd/g01-value-object-setter-accessor.json; before: after-fixes/raw/ddd/g01-value-object-setter-accessor.json (no finding) · Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md §3–4'],
  },
  {
    id: 'B3-example-adapter-isolation-hex',
    title: 'Worked rule 3 · Adapter isolation (Hexagonal): an open question',
    subtitle: 'An inbound adapter imports an outbound adapter. Found today as FF-S03 (advisory); construct question Q5 asks whether it should block.',
    specFile: 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml',
    spec: ['architecture:', '  style: hexagonal', '  # … (5 layers omitted)', '  allowed_dependencies:', '    - from: application', '      to: [domain]', '    - from: adapters-inbound', '      to: [application, domain]', '    - from: adapters-outbound', '      to: [application, domain]', '    - from: config', '      to: [domain, application,', '           adapters-inbound, adapters-outbound]', 'fitness_functions:', '  - id: FF-S03', '    name: layer-skip-graph', '    severity: critical'],
    specHl: ['FF-S03', 'layer-skip-graph', 'from: adapters-inbound'],
    cypher: [...cy('B3').slice(0, 5), '// … (RETURN of 9 columns and ORDER BY omitted)', '', '// $allowedDependencies = ["application>domain",', '//   "adapters-inbound>application", "adapters-inbound>domain",', '//   "adapters-outbound>application", "adapters-outbound>domain",', '//   "config>…" ×4]'],
    cypherHl: ['NOT (src.layer', 'NOT (tgt.layer'],
    codeFile: 'variant v05 (variant.patch)',
    code: ['// src/adapters/inbound/http/RoomController.ts   (adapters-inbound)', "import { FindAvailableRooms } from '../../../application/ports/in/FindAvailableRooms';", "+import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';", '', 'export class RoomController {', '  constructor(', '    private readonly findAvailableRooms: FindAvailableRooms,', '+   private readonly roomStore: InMemoryRoomRepository,', '  ) {}', '// … (+ a show() route that reads the store directly)'],
    codeHl: ['outbound/persistence/InMemoryRoomRepository'],
    findingTag: 'FF-S03 · advisory in hexagonal',
    finding: [
      ['rule', 'FF-S03 layer-skip-graph', true],
      ['severity / tier', 'critical / advisory (rule-tiers.md: blocking only in layered)'],
      ['file', 'src/adapters/inbound/http/RoomController.ts'],
      ['target', 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts'],
      ['message', '… (adapters-inbound) imports … (adapters-outbound) sideways, with no allowed dependency between the layers', 'red'],
      ['open question', 'Q5 recommends D: a new adapter-isolation rule id, blocking in hexagonal and DDD (Cockburn 2005). Not decided.'],
    ],
    note: 'The edge is found; what it means is open. An adapter-to-adapter import has no allowed edge in either direction, so the "sideways" template reports it. Whether that blocks, and under which rule id, is a construct decision for the author (Docs/v1.3/construct-decisions.md, Q5), not a tuning choice.',
    footer: ['Sources: tests/fixtures/v1.3-reference/hexagonal/spec.yaml · Cypher: Docs/presentation-kit/data/compiled-cypher.json (B3) · Code: tests/fixtures/v1.3-reference/hexagonal/variants/v05-inbound-adapter-reads-outbound-adapter', 'Finding: results/v1.3-reference/after-member-facts/evidence/hexagonal/v05-inbound-adapter-reads-outbound-adapter.json · Tier: Docs/v1.3/rule-tiers.md · Q5: Docs/v1.3/construct-decisions.md'],
  },
  {
    id: 'B4-example-apg2-tf1',
    title: 'Worked rule 4 · A leak only the APG can see (APG v2, case TF1)',
    subtitle: 'A controller returns a persistence model through an inferred return type. There is no import between the two files.',
    badge: 'DEVELOPMENT SET: planted APG v2 fixture',
    specFile: 'tests/fixtures/v1.3-apg2/cases.json',
    spec: ['# layer model of the type-flow fixture', '# (cases.json, projects.type-flow, as YAML)', 'layers:', '  - { name: domain, kind: domain,', '      directories: [src/domain/**] }', '  - { name: application, kind: application,', '      directories: [src/application/**] }', '  - { name: infrastructure, kind: infrastructure,', '      directories: [src/infrastructure/**] }', '  - { name: presentation, kind: presentation,', '      directories: [src/presentation/**] }', '# template: boundary-type-leak (APG v2, tier blocking)', '# not yet a preset entry; parameters from apg2Params()'],
    specHl: ['boundary-type-leak'],
    cypher: [...cy('B4').slice(0, 4), '// … (2 lines: composition-root and test-file scope; RETURN of 8 columns; ORDER BY)', '', '// $controllerLayer = "presentation"', '// $applicationLayers = ["application"]', '// $infraLayer = "infrastructure"'],
    cypherHl: ['SIGNATURE_USES', 'publicSurface'],
    codeFile: 'tests/fixtures/v1.3-apg2/type-flow',
    code: ['// src/presentation/user.controller.ts   (presentation)', "import { UserRepository } from '../infrastructure/user.repository';", '// (no import of user.record.ts anywhere in this file)', 'export class UserController {', '  constructor(private readonly repo: UserRepository) {}', '  async get(id: number) {            // inferred: Promise<UserRecord>', '    return this.repo.findById(id);', '  }', '}', '// src/infrastructure/user.record.ts: class UserRecord { id; name; passwordHash }'],
    codeHl: ['async get(id: number)'],
    findingTag: 'APG v2 row (TF1)',
    finding: [
      ['template', 'boundary-type-leak (APG v2)', true],
      ['tier', 'blocking'],
      ['file', tf.apg2Rows.find((r) => r.member === 'UserController.get').filePath],
      ['member', 'UserController.get'],
      ['leaked type', 'UserRecord (src/infrastructure/user.record.ts)', 'red'],
      ['position', 'return, inferred = true'],
      ['v1.3 graph', 'no row, and no edge of any type between the two files'],
      ['import tools', 'dependency-cruiser (translated or hand-written): not found'],
    ],
    note: 'Expressiveness, not prevalence: the case was planted by the author of the enrichment. It shows what the APG can state that an import graph cannot (an inferred type flowing through a signature). The live Neo4j run returned the same rows as the in-memory mirror.',
    footer: ['Sources: tests/fixtures/v1.3-apg2/{cases.json,type-flow} · Cypher: instantiateTemplate(APG2_TEMPLATES boundary-type-leak) with apg2Params, Docs/presentation-kit/data/compiled-cypher.json (B4)', 'Row: Docs/presentation-kit/data/type-flow.boundary-type-leak.json; live check Docs/DiagnosticRuns/apg2-scope-2026-10-15/fixtures-live.json; arms: Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md (case table, TF1)'],
  },
];

for (const ex of EXAMPLES) {
  const svg = card(ex);
  save(FIG, ex.id, svg);
  save(EX, ex.id, svg);
}

// ---------- markdown cards (full, untrimmed Cypher) ----------
const full = (k) => compiled[k].cypher.trim();
const params = (k) => JSON.stringify(compiled[k].params, null, 2);
const cards = {
  'B1-example-ffs01-clean': {
    rule: 'FF-S01 `dependency-direction` (Clean Architecture), blocking',
    key: 'B1',
    spec: 'tests/fixtures/v1.3-reference/clean-architecture/spec.yaml',
    variant: 'tests/fixtures/v1.3-reference/clean-architecture/variants/v02-domain-uses-infrastructure-clock/variant.patch',
    finding: 'results/v1.3-reference/after-member-facts/evidence/clean-architecture/v02-domain-uses-infrastructure-clock.json',
    findingJson: { functionId: 'FF-S01', type: 'LAYER_VIOLATION', severity: 'critical', filePath: 'src/domain/services/LoanPolicy.ts', target: 'src/infrastructure/system/SystemClock.ts', line: 4, isTypeOnly: false, message: 'src/domain/services/LoanPolicy.ts (domain) imports from src/infrastructure/system/SystemClock.ts (infrastructure)' },
    say: [
      'The spec names the rule; the compiler turns it into one Cypher pattern over IMPORTS edges, with the layer order as a parameter.',
      'The variant adds one import from the domain to infrastructure. The extractor turns it into one IMPORTS edge; the query returns it.',
      'The manifest expected this row (and FF-S04 on the same edge), so it is a true positive on the development set.',
    ],
  },
  'B2-example-ffdt03-ddd': {
    rule: 'FF-DT03 `value-object-immutability` (DDD), blocking',
    key: 'B2',
    spec: 'presets/ddd.yaml (`ddd.value_objects`, function FF-DT03)',
    variant: 'tests/fixtures/v1.3-reference/ddd/variants/g01-value-object-setter-accessor/overlay/src/ordering/domain/value-objects/Quantity.ts',
    finding: 'results/v1.3-reference/after-member-facts/evidence/ddd/g01-value-object-setter-accessor.json (before: results/v1.3-reference/after-fixes/raw/ddd/g01-value-object-setter-accessor.json, no finding)',
    findingJson: { functionId: 'FF-DT03', type: 'CUSTOM_value-object-immutability', severity: 'critical', filePath: 'src/ordering/domain/value-objects/Quantity.ts', message: 'Value object Quantity in src/ordering/domain/value-objects/Quantity.ts is mutable through Quantity.value (set accessor)' },
    say: [
      'This is the one real miss the development set found in the DDD rules (M3). The first runs saw only setter-named methods, so a `set value(v)` accessor went through.',
      'The fix was in the extractor, not the rule text: Class nodes now carry member facts (`publicFields`, `readonlyFields`, `setAccessors`, `mutatorMethods`), and the template reads them.',
      'Effect (development set): DDD blocking recall 8/9 → 9/9, pooled author-view blocking recall 53/54 → 54/54, with the 3 FF-P06 FLOWS_TO rows N/A by `Docs/v1.3/rule-tiers.md` (56/57 → 57/57 before that correction; `Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md` §3 and "Correction (2026-10-16)"). No other row moved.',
      'Caveat: g01 was written after the first tool run, to probe this limit. The comment above FF-DT03 in `presets/ddd.yaml` still describes the old name proxy.',
    ],
  },
  'B3-example-adapter-isolation-hex': {
    rule: 'Adapter isolation (Hexagonal): today FF-S03 `layer-skip-graph`, advisory; construct question Q5',
    key: 'B3',
    spec: 'tests/fixtures/v1.3-reference/hexagonal/spec.yaml (`allowed_dependencies`, function FF-S03)',
    variant: 'tests/fixtures/v1.3-reference/hexagonal/variants/v05-inbound-adapter-reads-outbound-adapter/variant.patch',
    finding: 'results/v1.3-reference/after-member-facts/evidence/hexagonal/v05-inbound-adapter-reads-outbound-adapter.json',
    findingJson: { functionId: 'FF-S03', type: 'CUSTOM_layer-skip-graph', severity: 'critical', filePath: 'src/adapters/inbound/http/RoomController.ts', target: 'src/adapters/outbound/persistence/InMemoryRoomRepository.ts', line: 2, message: 'src/adapters/inbound/http/RoomController.ts (adapters-inbound) imports src/adapters/outbound/persistence/InMemoryRoomRepository.ts (adapters-outbound) sideways, with no allowed dependency between the layers' },
    say: [
      'The edge is detected; its tier is the open part. In hexagonal, FF-S03 is advisory (`Docs/v1.3/rule-tiers.md`: "Hexagonal does not define strict layering"), so this finding does not fail the verdict today.',
      'Construct question Q5 (`Docs/v1.3/construct-decisions.md`) asks whether adapter → adapter should block, and under which id. Recommended: D, a new adapter-isolation rule id, blocking in hexagonal and DDD (Cockburn 2005: adapters talk only through ports). C (report under FF-S01) is the alternative. Not decided by the author yet.',
      'The blind manifest read this edge as FF-S01 (blocking), the author manifest as FF-S03 (advisory). That disagreement is what Q5 settles.',
    ],
  },
  'B4-example-apg2-tf1': {
    rule: 'APG v2 template `boundary-type-leak` (type flow), case TF1, tier blocking',
    key: 'B4',
    spec: 'tests/fixtures/v1.3-apg2/cases.json (`projects.type-flow` layer model); the template is not yet a preset entry: `src/fitness-compiler/apg2-templates.ts`, parameters from `apg2Params` (`src/fitness-compiler/apg2-in-memory.ts`)',
    variant: 'tests/fixtures/v1.3-apg2/type-flow/src/presentation/user.controller.ts (method `get`)',
    finding: 'Docs/presentation-kit/data/type-flow.boundary-type-leak.json (row `UserController.get`); live Neo4j equality: Docs/DiagnosticRuns/apg2-scope-2026-10-15/fixtures-live.json',
    findingJson: tf.apg2Rows.find((r) => r.member === 'UserController.get'),
    say: [
      'The controller never imports `user.record.ts`. It returns `this.repo.findById(id)`, whose inferred type is `Promise<UserRecord>`: a persistence model leaks into an HTTP response.',
      'In the v1.3 graph there is no edge of any type between the controller file and the record file, so no v1.3 rule and no import rule can relate them (`Docs/DiagnosticRuns/apg2-ablation-2026-10-15.md`, "Reading the result per enrichment", (1)). The APG v2 SIGNATURE_USES edge holds it.',
      'Arms for TF1 in the ablation: APG v2 yes; same template on the v1.3 graph no; v1.3 rules no; dependency-cruiser translated no; hand-written no.',
      'Caveat: planted by the enrichment\'s author. It shows expressiveness, not how often this happens in real code.',
    ],
  },
};
for (const [id, c] of Object.entries(cards)) {
  const ex = EXAMPLES.find((e) => e.id === id);
  const md = `# ${ex.title.replace('Worked rule', 'Worked rule')}

**Rule:** ${c.rule}

![${id}](${id}.png)

**Badge:** development set (reference project or planted fixture). Not a validity estimate.

## 1. Spec (YAML)

Source: \`${c.spec}\`

\`\`\`yaml
${ex.spec.join('\n')}
\`\`\`

## 2. Compiled Cypher (real compiler output, full text)

Produced by \`compileFunctions(compilerInputFromSpec(spec), V13_COMPILE_OPTIONS)\`${c.key === 'B4' ? ' (here: `instantiateTemplate` on the APG v2 template with `apg2Params`)' : ''}; stored in \`Docs/presentation-kit/data/compiled-cypher.json\` (key ${c.key}). The figure shows a trimmed copy; omitted parts are marked there.

\`\`\`cypher
${full(c.key)}
\`\`\`

Parameters:

\`\`\`json
${params(c.key)}
\`\`\`

## 3. Code that violates it

Source: \`${c.variant}\`

\`\`\`ts
${ex.code.join('\n')}
\`\`\`

## 4. What the tool reports

Source: \`${c.finding}\` (the violation id field is left out).

\`\`\`json
${JSON.stringify(c.findingJson, null, 2)}
\`\`\`

## What to say

${c.say.map((s) => `- ${s}`).join('\n')}
`;
  fs.writeFileSync(path.join(EX, `${id}.md`), md);
  fs.writeFileSync(path.join(FIG, `${id}.caption.md`), `# ${id}

**Title on slide:** ${ex.title}

**What it shows.** ${ex.subtitle} The chain is: (1) the spec entry, (2) the Cypher the repository's compiler makes from it (trimmed; the full text is in \`Docs/presentation-kit/examples/${id}.md\`), (3) the code that breaks it, (4) the row the tool reports.

**One idea.** A rule is a graph query compiled from the spec; a finding is a row that query returns.

**Sources of every value.**
- Spec: \`${c.spec}\`
- Cypher: \`Docs/presentation-kit/data/compiled-cypher.json\` (key ${c.key}), made by \`Docs/presentation-kit/tools/compile.ts\` with \`V13_COMPILE_OPTIONS\`.
- Code: \`${c.variant}\`
- Finding: \`${c.finding}\`

**Caveat.** Development set (AI-written reference project or planted fixture); a single example, not a rate.
`);
}
