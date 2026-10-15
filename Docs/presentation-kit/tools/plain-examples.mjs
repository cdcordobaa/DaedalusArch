// Plain set, worked examples B1-B4: full width, 2300 x 940, every text >= 30 px (code included).
// The YAML, Cypher and code lines are the kit's own (figs-examples.mjs, data/compiled-cypher.json), kept verbatim and
// trimmed to the relevant lines with "…"; nothing is shrunk. Rule ids, file paths and variant codes are left out of the
// panels; the report panel uses plain field names.
// Line prefixes: "!" = the line that breaks the rule (red), "+" = a line the variant added (green).
import { C, FULL, MONO, T, canvas, rect, arrow, savePlain, caption, wrap, esc } from './plain-kit.mjs';
import { readJson } from './kit.mjs';

const compiled = readJson('Docs/presentation-kit/data/compiled-cypher.json');
const cy = (k) => compiled[k].cypher.split('\n').map((l) => l.replace(/\s+$/, ''));
const pick = (k, re) => {
  const l = cy(k).find((x) => re.test(x));
  if (!l) throw new Error(`no Cypher line ${re} in ${k}`);
  return l;
};
const CW = 0.602; // Menlo advance per px of font size
const SIZE = 30;
const LH = 38;

function code(x, y, w, src) {
  const max = Math.floor((w - 40) / (SIZE * CW));
  let s = '';
  let i = 0;
  for (const raw of src) {
    let kind = '';
    let t = raw;
    if (t.startsWith('!')) (kind = 'hl'), (t = t.slice(1));
    else if (t.startsWith('+')) (kind = 'add'), (t = t.slice(1));
    const parts = [];
    let rest = t;
    let first = true;
    // Wrap long lines at the last space before the edge (never inside a word), with a 4-space hanging indent.
    while (rest.length > 0 || first) {
      const room = first ? max : max - 4;
      let cut = rest.length <= room ? rest.length : rest.lastIndexOf(' ', room);
      if (cut <= rest.length - rest.trimStart().length) cut = room;
      parts.push((first ? '' : '    ') + rest.slice(0, cut));
      rest = rest.slice(cut).replace(/^ /, '');
      first = false;
    }
    const omit = t.trim().startsWith('// …') || t.trim().startsWith('# …');
    for (const p of parts) {
      const yy = y + i * LH;
      if (kind) s += rect(x + 8, yy - SIZE + 2, w - 16, LH, { fill: kind === 'hl' ? C.redSoft : '#E9F5EE' });
      s += `<text x="${x + 20}" y="${yy}" font-family="${MONO}" font-size="${SIZE}" fill="${omit ? C.muted : kind === 'hl' ? C.red : C.ink}" xml:space="preserve"${omit ? ' font-style="italic"' : ''}>${esc(p)}</text>`;
      i++;
    }
  }
  return [s, i];
}

function panel(x, y, w, h, head, note) {
  let s = rect(x, y, w, h, { rx: 14, fill: '#FBFBFC', stroke: '#D7DCE3', sw: 2 });
  s += T(x + 20, y + 48, head, { size: 32, weight: 700 });
  if (note) s += T(x + w - 20, y + 48, note, { size: 30, fill: C.layer.domain, anchor: 'end' });
  return s;
}

function report(x, y, w, rows) {
  let s = '';
  let yy = y;
  const kw = 230;
  for (const [k, v, col] of rows) {
    s += T(x + 20, yy, k, { size: 30, weight: 700, fill: C.muted });
    const ls = wrap(v, w - kw - 40, 30);
    ls.forEach((l, i) => (s += T(x + kw, yy + i * LH, l, { size: 30, fill: col ?? C.ink, weight: col ? 700 : 400 })));
    yy += ls.length * LH + 6;
  }
  return [s, yy];
}

function card(ex) {
  const top = 20;
  const hTop = 430;
  const y2 = 500;
  const hBot = 420;
  const x1 = 30;
  const w1 = 900;
  const x2 = 990;
  const w2 = FULL.w - 30 - x2;
  const x3 = 30;
  const w3 = 1340;
  const x4 = 1430;
  const w4 = FULL.w - 30 - x4;
  let b = '';
  b += panel(x1, top, w1, hTop, '1. What the team wrote');
  b += panel(x2, top, w2, hTop, '2. The query the tool generates');
  b += panel(x3, y2, w3, hBot, '3. The code that breaks it', ex.codeNote);
  b += panel(x4, y2, w4, hBot, '4. What the tool reports');
  const fits = [];
  const [c1, n1] = code(x1, top + 100, w1, ex.spec);
  const [c2, n2] = code(x2, top + 100, w2, ex.cypher);
  const [c3, n3] = code(x3, y2 + 100, w3, ex.code);
  const [r4, ry] = report(x4, y2 + 100, w4, ex.report);
  fits.push(top + 100 + (n1 - 1) * LH <= top + hTop - 14, top + 100 + (n2 - 1) * LH <= top + hTop - 14, y2 + 100 + (n3 - 1) * LH <= y2 + hBot - 14, ry - LH - 6 <= y2 + hBot - 14);
  if (fits.includes(false)) throw new Error(`${ex.id}: a panel overflows (${n1}, ${n2}, ${n3} lines; report ends ${ry})`);
  b += c1 + c2 + c3 + r4;
  b += arrow(x1 + w1 + 6, top + 40, x2 - 10, top + 40);
  b += arrow(x4 + w4 / 2, top + hTop + 6, x4 + w4 / 2, y2 - 10);
  b += arrow(x3 + w3 + 6, y2 + 40, x4 - 10, y2 + 40);
  return canvas(FULL, b);
}

const MATCH_IMPORTS = pick('B1', /^MATCH \(src:File\)/);

const EXAMPLES = [
  {
    id: 'B1-example-ffs01-clean',
    claim: 'In a Clean Architecture app, a core (domain) file imports an infrastructure clock. The spec names the rule "dependency direction"; the tool turns it into one query over imports and reports that edge. A defining rule (can fail); the answer key expected it.',
    spec: ['architecture:', '  style: clean-architecture', '  layers:', '    - name: domain', '    - name: application', '    - name: infrastructure', '# … (folders, rule id omitted)', '!    name: dependency-direction', '    severity: critical'],
    cypher: [MATCH_IMPORTS, pick('B1', /^WHERE src\.layer IS NOT NULL/), '// …', pick('B1', /src\.layer\) AS srcIdx/), pick('B1', /tgt\.layer\) AS tgtIdx/), '!' + pick('B1', /srcIdx < tgtIdx/), '// …', '// $layerOrder = ' + JSON.stringify(compiled.B1.params.layerOrder)],
    code: ["import { Loan } from '../entities/Loan';", "!import { SystemClock } from '../../infrastructure/system/SystemClock';", '// …', 'export class LoanPolicy {', '+  assertCanBorrowToday(member: Member, activeLoans: readonly Loan[]): void {', '+    this.assertCanBorrow(member, activeLoans, new SystemClock().now());', '+  }', '// …'],
    codeNote: 'green = added',
    report: [
      ['Problem', 'the core imports infrastructure', C.red],
      ['Rule', 'dependency direction'],
      ['Kind', 'defining rule (can fail)'],
      ['Where', 'LoanPolicy (core), line 4'],
      ['Imports', 'SystemClock (infrastructure)'],
      ['Answer key', 'expected: a correct report'],
    ],
    rows: ['None: a single worked example (no rate). The text is from data/compiled-cypher.json (B1) and the clean-architecture reference spec and variant used by figures/B1.'],
  },
  {
    id: 'B2-example-ffdt03-ddd',
    claim: 'In a DDD app, a value object (Quantity) can be changed through a set accessor. The first run missed it; once the map recorded setters, the query found it, and DDD violations found went from 8/9 to 9/9 (author key).',
    spec: ['architecture:', '  style: ddd', '  ddd:', '    # … (contexts, aggregates omitted)', '    value_objects: ["src/**/value-objects/**"]', '# … (rule id omitted)', '!    name: value-object-immutability', '    severity: critical'],
    cypher: [pick('B2', /^MATCH \(c:Class\)/), pick('B2', /valueObjectPatterns WHERE/), pick('B2', /^WITH c,/), '// …', '!' + pick('B2', /setAccessors/), '// …', pick('B2', /^WHERE size\(members\) > 0/), '// …'],
    code: ['export class Quantity {', '  private current: number;', '  constructor(value: number) { /* … validates, then */ this.current = value; }', '  get value(): number { return this.current; }', '!  set value(v: number) {', '    this.current = v;', '  }', '  // … plus(other) returns a new Quantity'],
    report: [
      ['Problem', 'Quantity can be changed after it is made', C.red],
      ['Rule', 'value objects never change'],
      ['Kind', 'defining rule (can fail)'],
      ['Where', 'Quantity.value (set accessor)'],
      ['First run', 'missed'],
      ['Now', 'found; DDD 8/9 → 9/9 found'],
    ],
    rows: ['Development set: rules, "8/9 → 9/9 (ddd), 53/54 → 54/54 (pooled; was 56/57 → 57/57 before the FF-P06 correction)" (effect of member facts, g01 found).'],
  },
  {
    id: 'B3-example-adapter-isolation-hex',
    claim: 'In a Hexagonal app, the web adapter imports the storage adapter directly. The tool reports it, but only as a warning (never fails); the author key and the blind key disagree on whether it should be a defining rule. An open question, not a tool error.',
    spec: ['  style: hexagonal', '  # … (5 layers omitted)', '  allowed_dependencies:', '    - from: application', '      to: [domain]', '!    - from: adapters-inbound', '      to: [application, domain]', '    # …', '    name: layer-skip-graph'],
    cypher: [MATCH_IMPORTS, pick('B3', /^WHERE src\.layer IS NOT NULL/), pick('B3', /^\s+AND src\.layer <> tgt\.layer/), '!' + pick('B3', /NOT \(src\.layer \+ '>'/), '!' + pick('B3', /NOT \(tgt\.layer \+ '>'/), '// …'],
    code: ['// …', "!import { InMemoryRoomRepository } from '../../outbound/persistence/InMemoryRoomRepository';", '', 'export class RoomController {', '  constructor(', '    private readonly findAvailableRooms: FindAvailableRooms,', '+   private readonly roomStore: InMemoryRoomRepository,', '  ) {}'],
    codeNote: 'green = added',
    report: [
      ['Problem', 'web adapter imports the storage adapter sideways', C.red],
      ['Kind', 'warning (never fails) in Hexagonal'],
      ['Author key', 'warning'],
      ['Blind key', 'defining rule (can fail)'],
      ['Open', 'should it fail? not decided yet'],
    ],
    rows: ['None: a single worked example (no rate). The author/blind reading comes from the original B3 card (examples/B3-example-adapter-isolation-hex.md) and construct question Q5.'],
  },
  {
    id: 'B4-example-apg2-tf1',
    claim: 'A web controller hands out a storage type through a return type the compiler infers; no import links the two files. Only the richer map holds that link, so only it can report the leak; an import checker cannot.',
    spec: ['layers:', '  # …', '  - { name: infrastructure, kind: infrastructure,', '      directories: [src/infrastructure/**] }', '  - { name: presentation, kind: presentation,', '      directories: [src/presentation/**] }'],
    cypher: ['!' + pick('B4', /SIGNATURE_USES/), pick('B4', /publicSurface/), pick('B4', /controllerLayer OR/), pick('B4', /\$infraLayer AND/), '// …', '// $controllerLayer = "presentation"', '// $infraLayer = "infrastructure"'],
    code: ["import { UserRepository } from '../infrastructure/user.repository';", '// (no import of UserRecord anywhere in this file)', 'export class UserController {', '  constructor(private readonly repo: UserRepository) {}', '!  async get(id: number) {            // inferred: Promise<UserRecord>', '    return this.repo.findById(id);', '  }', '}', '// infrastructure layer: class UserRecord { id; name; passwordHash }'],
    report: [
      ['Problem', 'a storage type leaks out of the web controller', C.red],
      ['Kind', 'defining rule (can fail)'],
      ['Where', 'UserController.get'],
      ['Leaks', 'UserRecord, as its return type (inferred)'],
      ['Import check', 'nothing: there is no import'],
    ],
    rows: ['APG v2: "5 rows (live 5 = mirror 5); TF1 row UserController.get → UserRecord, return, inferred" (boundary-type-leak on the type-flow fixture).'],
  },
];

for (const ex of EXAMPLES) {
  savePlain(ex.id, card(ex), caption(ex.id, ex.claim, ex.rows, [
    'Panels are headed "1. What the team wrote", "2. The query the tool generates", "3. The code that breaks it", "4. What the tool reports". YAML, Cypher and code lines are verbatim from the kit, trimmed with "…"; rule ids, file paths and variant codes are left out of the figure (the full card is in examples/).',
  ]));
}
