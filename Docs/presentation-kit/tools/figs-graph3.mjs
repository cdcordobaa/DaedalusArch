// A4 the APG schema; A5 a "photo of the graph" (Neo4j-browser-like rendering of real extracted rows).
import { C, FIG, W, MONO, frame, embedGv, graphviz, readJson, save, text, rect, line, esc, pill } from './kit.mjs';

const CORE = C.ink;
const V13 = C.layer.application;
const V2 = C.layer['adapters-outbound'];

// ---------------- A4 schema ----------------
async function a4() {
  const gv = await graphviz();
  const node = (id, title, color, selfs = [], props = []) => {
    const rows = [`<TR><TD ALIGN="CENTER"><FONT POINT-SIZE="24" COLOR="${color}"><B>${title}</B></FONT></TD></TR>`];
    for (const [t, col] of selfs) rows.push(`<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="17" COLOR="${col}">↻ ${t}</FONT></TD></TR>`);
    for (const [t, col] of props) rows.push(`<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="16" COLOR="${col}"><I>${t}</I></FONT></TD></TR>`);
    return `"${id}" [shape=box, style="rounded,filled", fillcolor="white", color="${color}", penwidth=${color === CORE ? 2 : 2.6}${color === V2 ? ', style="rounded,dashed,filled"' : ''}, margin="0.18,0.1", label=<<TABLE BORDER="0" CELLSPACING="2">${rows.join('')}</TABLE>>];`;
  };
  const e = (a, b, lab, col, extra = '') => `"${a}" -> "${b}" [label=<<FONT COLOR="${col}">${lab}</FONT>>, color="${col}", fontcolor="${col}"${col === V2 ? ', style=dashed' : ''}${extra}];`;
  const dot = [
    'digraph S { graph [rankdir=TB, nodesep=0.6, ranksep=0.75, bgcolor="transparent", pad=0.2]; edge [fontname="Helvetica", fontsize=17, penwidth=2.2, arrowsize=1.0]; node [fontname="Helvetica"];',
    node('Package', 'Package', CORE, [], [['npm / node core / @scope', C.muted]]),
    node('File', 'File', CORE, [['IMPORTS, RE_EXPORTS', CORE], ['DEEP_IMPORT', V2]], [['layer (from the spec)', C.muted], ['IMPORTS: viaReExport, reExportHop, dynamic', V13]]),
    node('Component', 'Component', V2, [['DEPENDS_ON', V2]], [['layer · module · folder', C.muted]]),
    node('Class', 'Class', CORE, [['EXTENDS, CONSTRUCTOR_INJECTS, FLOWS_TO', CORE], ['MODULE_IMPORTS / _PROVIDES / _EXPORTS', V13]], [['member facts: publicFields, readonlyFields,', V13], ['setAccessors, mutatorMethods', V13]]),
    node('Interface', 'Interface', CORE),
    node('Function', 'Function', CORE),
    node('Method', 'Method', CORE, [['CALLS', CORE]]),
    node('Channel', 'Channel', V2, [], [['event / queue / topic name', C.muted]]),
    node('IOCategory', 'IOCategory', V2, [], [['db · http-out · fs · clock · random · env', C.muted]]),
    '{rank=same; Package; File; Component}',
    '{rank=same; Function; Class; Interface}',
    '{rank=same; Channel; IOCategory}',
    e('File', 'Package', 'IMPORTS', CORE),
    e('File', 'Class', 'DECLARES', CORE),
    e('File', 'Function', 'DECLARES', CORE),
    e('File', 'Interface', 'DECLARES', CORE),
    e('File', 'Component', '  BELONGS_TO', V2, ', constraint=false, minlen=2'),
    e('Component', 'Interface', 'EXPORTS_SYMBOL', V2),
    e('Class', 'Interface', 'IMPLEMENTS\nCONSTRUCTOR_INJECTS', CORE),
    e('Class', 'Method', 'CONTAINS', CORE),
    e('Method', 'Interface', 'SIGNATURE_USES', V2),
    e('Method', 'Channel', 'PUBLISHES / SUBSCRIBES', V2),
    e('Method', 'IOCategory', 'PERFORMS_IO', V2),
    '}',
  ].join('\n');
  const g = gv.layout(dot.replace('IMPLEMENTS\nCONSTRUCTOR_INJECTS', 'IMPLEMENTS<BR/>CONSTRUCTOR_INJECTS'), 'svg', 'dot');
  const top = 150;
  const [emb, h, sc] = embedGv(g, 48, top, 1120);
  let b = emb;
  const rx = 48 + 1120 + 40;
  let y = top + 10;
  b += text(rx, y + 20, 'Legend', { size: 22, weight: 700 });
  y += 50;
  for (const [col, lab, sub, dash] of [[CORE, 'v1.2E core (Study 1)', '6 node types, 9 edge types', false], [V13, 'added in v1.3 (default on)', 'module wiring edges; barrel, dynamic-import and member-fact properties', false], [V2, 'APG v2 (option apg2, off by default)', '3 node types, 8 edge types', true]]) {
    b += `<line x1="${rx}" y1="${y}" x2="${rx + 46}" y2="${y}" stroke="${col}" stroke-width="3"${dash ? ' stroke-dasharray="8 5"' : ''}/>`;
    b += text(rx + 58, y + 6, lab, { size: 18, weight: 700, fill: col });
    const words = sub;
    b += text(rx + 58, y + 30, words.length > 44 ? words.slice(0, words.lastIndexOf(' ', 44)) : words, { size: 15, fill: C.muted });
    if (words.length > 44) b += text(rx + 58, y + 50, words.slice(words.lastIndexOf(' ', 44) + 1), { size: 15, fill: C.muted });
    y += 86;
  }
  b += text(rx, y + 10, '↻ = edge from a node type to itself', { size: 16, fill: C.muted });
  b += text(rx, y + 34, 'italic = properties stored on the node or edge', { size: 16, fill: C.muted });
  b += text(rx, y + 58, 'DECLARES: File → Class, Interface, Function', { size: 16, fill: C.muted });
  b += text(rx, y + 82, 'SIGNATURE_USES / EXPORTS_SYMBOL also reach', { size: 16, fill: C.muted });
  b += text(rx, y + 104, 'Class and Function (one arrow drawn)', { size: 16, fill: C.muted });
  const height = Math.max(top + h, y + 120) + 80;
  console.error('A4 scale', sc);
  const svg = frame({
    title: 'The APG schema: node and edge types',
    subtitle: 'What the extractor writes into Neo4j. Black: the v1.2E graph used in Study 1. Blue: v1.3 additions. Orange dashed: APG v2.',
    badgeKind: 'design',
    badgeLabel: 'SCHEMA',
    body: b,
    height,
    footer: ['Sources: src/shared/types/enums.ts (NODE_TYPES, EDGE_TYPES, V13_EDGE_TYPES, APG2_NODE_TYPES, APG2_EDGE_TYPES); src/shared/types/apg.ts (IMPORTS properties); Docs/v1.3/apg2-design.md (APG v2 edge endpoints);', 'src/apg-extractor/nest-module-extractor.ts (MODULE_* edges); Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md §1.1 (member facts on Class nodes).'],
  });
  save(FIG, 'A4-schema', svg, `
# A4 · schema

**Title on slide:** The APG schema: node and edge types

**What it shows.** Every node type and edge type the extractor writes into the Architectural Property Graph, as one compact diagram. Black: the v1.2E core used in Study 1 (6 node types: File, Class, Interface, Method, Function, Package; 9 edge types: IMPORTS, IMPLEMENTS, EXTENDS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS, FLOWS_TO, RE_EXPORTS). Blue: v1.3 additions, on by default (NestJS module wiring edges MODULE_IMPORTS, MODULE_PROVIDES, MODULE_EXPORTS; IMPORTS properties \`viaReExport\`, \`reExportHop\`, \`dynamic\`; class member facts). Orange dashed: APG v2, behind the \`apg2\` extractor option (3 node types: Component, Channel, IOCategory; 8 edge types: SIGNATURE_USES, BELONGS_TO, DEPENDS_ON, EXPORTS_SYMBOL, DEEP_IMPORT, PUBLISHES, SUBSCRIBES, PERFORMS_IO). "↻" marks an edge from a type to itself.

**One idea.** The graph knows more than imports: types, implementations, injections, calls, data flow, and (APG v2) signatures, components, channels and I/O.

**Sources.**
- \`src/shared/types/enums.ts\`: \`NODE_TYPES\`, \`EDGE_TYPES\`, \`V13_EDGE_TYPES\`, \`APG2_NODE_TYPES\`, \`APG2_EDGE_TYPES\`.
- \`src/shared/types/apg.ts\`: \`ImportEdgeProperties\` (\`dynamic\`, \`viaReExport\`, \`reExportBarrels\`, \`reExportHop\`).
- \`Docs/v1.3/apg2-design.md\`: endpoints (SIGNATURE_USES (Method | Function) → (Class | Interface); BELONGS_TO File → Component; DEPENDS_ON Component → Component; EXPORTS_SYMBOL Component → (Class | Interface | Function); DEEP_IMPORT File → File; PUBLISHES/SUBSCRIBES owner → Channel; PERFORMS_IO owner → IOCategory). "Owner" is the node that owns the code (drawn from Method).
- \`src/apg-extractor/nest-module-extractor.ts\`: MODULE_* edges between module and provider classes.
- Member facts: \`Docs/DiagnosticRuns/v1.3-reference-after-member-facts-2026-10-15.md\` §1.1 and B2.
- Defaults: \`src/apg-extractor/types.ts\` (\`V13_DEFAULT_OPTIONS\`: apg2 off; \`V13_APG2_OPTIONS\`: on).
`);
}

// ---------------- A5 graph photo ----------------
async function a5() {
  const gv = await graphviz();
  const g = readJson('Docs/presentation-kit/data/hexagonal.clean.apg2.json');
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const center = g.nodes.find((n) => n.type === 'Class' && n.name === 'BookRoomService');
  const file = g.nodes.find((n) => n.type === 'File' && n.file === center.file);
  const keep = new Set([center.id, file.id]);
  const edges = [];
  for (const e of g.edges) {
    if (e.source === center.id && ['IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'FLOWS_TO'].includes(e.type)) {
      edges.push(e);
      keep.add(e.target);
    }
    if (e.source === file.id && e.target === center.id) edges.push(e);
  }
  const comp = g.edges.find((e) => e.type === 'BELONGS_TO' && e.source === file.id);
  if (comp) {
    edges.push(comp);
    keep.add(comp.target);
  }
  const NEO = { File: '#F79767', Class: '#4C8EDA', Interface: '#57C7E3', Component: '#8DCC93', Method: '#FFC454' };
  const dot = ['graph G { graph [layout=neato, overlap=false, splines=true, bgcolor="transparent", sep="+18", start=7, pad=0.3]; node [shape=circle, fixedsize=true, width=1.45, style=filled, fontname="Helvetica", fontsize=15, fontcolor="#1F2937", penwidth=0]; edge [fontname="Helvetica", fontsize=13, fontcolor="#5B6472", color="#A5ABB6", penwidth=2, len=2.6];'];
  for (const id of keep) {
    const n = byId.get(id);
    const label = n.type === 'File' ? n.file.split('/').pop() : n.name;
    const wrapped = label.length > 13 ? label.replace(/([a-z])([A-Z])/g, '$1\\n$2').replace(/\\n(?=[^\\]*$)/, '\\n') : label;
    dot.push(`"${id}" [label="${wrapped}", fillcolor="${NEO[n.type] ?? '#D9C8AE'}"${id === center.id ? ', penwidth=5, color="#1F2937"' : ''}];`);
  }
  for (const e of edges) dot.push(`"${e.source}" -- "${e.target}" [label="${e.type}"];`);
  dot.push('}');
  const svgG = gv.layout(dot.join('\n'), 'svg', 'neato');
  const top = 150;
  // query bar
  let b = '';
  b += rect(48, top, W - 96, 52, { rx: 8, fill: '#F4F5F7', stroke: '#D7DCE3' });
  b += `<text x="70" y="${top + 33}" font-family="${MONO}" font-size="17" fill="#1F2937" xml:space="preserve"><tspan fill="#C2671B">neo4j$</tspan> MATCH (c:Class {name: 'BookRoomService'})-[r]-(n) OPTIONAL MATCH (n)-[b:BELONGS_TO]->(k) RETURN c, r, n, b, k</text>`;
  const gw = 900;
  const [emb, h] = embedGv(svgG, 60, top + 74, gw);
  b += rect(48, top + 66, gw + 24, h + 16, { rx: 8, fill: '#FFFFFF', stroke: '#D7DCE3' });
  b += emb;
  // properties panel (real values, no ids)
  const px = 48 + gw + 44;
  const pw = W - 48 - px;
  let y = top + 66;
  b += rect(px, y, pw, h + 16, { rx: 8, fill: '#FAFBFC', stroke: '#D7DCE3' });
  b += `<circle cx="${px + 26}" cy="${y + 30}" r="10" fill="${NEO.Class}"/>` + text(px + 44, y + 36, 'Class  BookRoomService', { size: 19, weight: 700 });
  y += 64;
  const props = [
    ['name', 'BookRoomService'],
    ['filePath', center.file],
    ['layer', center.layer],
    ['type', 'Class'],
  ];
  for (const [k, v] of props) {
    b += text(px + 20, y, k, { size: 15, fill: C.muted, family: MONO });
    b += text(px + 130, y, v.length > 34 ? '…' + v.slice(-33) : v, { size: 15, family: MONO });
    y += 28;
  }
  y += 10;
  b += text(px + 20, y, 'Relationships shown', { size: 16, weight: 700 });
  y += 26;
  const counts = {};
  for (const e of edges) counts[e.type] = (counts[e.type] ?? 0) + 1;
  for (const [k, v] of Object.entries(counts)) {
    b += text(px + 20, y, `${k}`, { size: 15, family: MONO });
    b += text(px + pw - 20, y, String(v), { size: 15, family: MONO, anchor: 'end' });
    y += 24;
  }
  y += 10;
  b += text(px + 20, y, 'Node colours', { size: 16, weight: 700 });
  y += 24;
  for (const [k, c] of Object.entries(NEO)) {
    if (k === 'Method') continue;
    b += `<circle cx="${px + 28}" cy="${y - 5}" r="8" fill="${c}"/>` + text(px + 44, y, k, { size: 15 });
    y += 24;
  }
  const height = top + 66 + h + 16 + 90;
  const svg = frame({
    title: 'A photo of the graph: one class and its neighbours',
    subtitle: 'Real extracted rows from the hexagonal reference project, drawn the way the Neo4j browser draws them. A rendering, not a live screenshot.',
    badgeKind: 'dev',
    badgeLabel: 'DEVELOPMENT SET: reference project',
    body: b,
    height,
    footer: ['Data: extractAPG (V13_APG2_OPTIONS) on tests/fixtures/v1.3-reference/hexagonal, clean variant: Docs/presentation-kit/data/hexagonal.clean.apg2.json (the BookRoomService node and its IMPLEMENTS, CONSTRUCTOR_INJECTS and FLOWS_TO edges, its DECLARES edge and its file\'s BELONGS_TO).'],
  });
  save(FIG, 'A5-graph-photo', svg, `
# A5 · graph-photo

**Title on slide:** A photo of the graph: one class and its neighbours

**What it shows.** A Neo4j-browser-style rendering of real rows from the extracted graph: the use case \`BookRoomService\` of the hexagonal reference project, the file that declares it, the driving port it implements (\`BookRoom\`), the five driven ports it receives in its constructor (\`RoomRepository\`, \`BookingRepository\`, \`GuestRepository\`, \`PaymentGateway\`, \`NotificationSender\`), the two domain services it holds in fields (FLOWS_TO \`AvailabilityChecker\`, \`PriceCalculator\`), and the \`application\` component its file belongs to (APG v2). The query bar shows the Cypher that returns this neighbourhood; the right panel shows the node's properties.

**One idea.** The graph is ordinary, inspectable data: nodes with properties and typed relationships.

**Sources and honesty notes.**
- Every node, edge and property is taken from \`extractAPG\` with \`V13_APG2_OPTIONS\` on \`tests/fixtures/v1.3-reference/hexagonal\` (clean variant): \`Docs/presentation-kit/data/hexagonal.clean.apg2.json\` (CONSTRUCTOR_INJECTS ×5, IMPLEMENTS ×1, FLOWS_TO ×2 for BookRoomService; see also A3).
- It is drawn by the kit (Graphviz neato, Neo4j browser colours), not a screenshot of a live Neo4j; the internal node ids are not shown. In Neo4j the edges are directed; the photo omits arrowheads as the browser's compact view does.
`);
}

await a4();
await a5();
