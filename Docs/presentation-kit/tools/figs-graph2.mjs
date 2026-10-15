// A3: import graph vs APG on one slice of the hexagonal reference project ("cancel a booking").
import { C, FIG, W, frame, embedGv, graphviz, readJson, save, text, rect, line } from './kit.mjs';

const SLICE = [
  'src/adapters/inbound/http/BookingController.ts',
  'src/application/ports/in/CancelBooking.ts',
  'src/application/services/CancelBookingService.ts',
  'src/application/ports/out/BookingRepository.ts',
  'src/adapters/outbound/persistence/InMemoryBookingRepository.ts',
  'src/domain/model/Booking.ts',
];
const short = (f) => f.split('/').pop();
const EDGE = {
  IMPORTS: { color: '#7B8494', style: 'solid', label: 'IMPORTS' },
  IMPLEMENTS: { color: C.layer.application, style: 'dashed', label: 'IMPLEMENTS', arrowhead: 'empty' },
  CONSTRUCTOR_INJECTS: { color: C.layer['adapters-inbound'], style: 'solid', label: 'CONSTRUCTOR_INJECTS' },
  CALLS: { color: C.layer.domain, style: 'solid', label: 'CALLS' },
  SIGNATURE_USES: { color: C.red, style: 'bold', label: 'SIGNATURE_USES (APG v2)' },
};

export function sliceData() {
  const g = readJson('Docs/presentation-kit/data/hexagonal.clean.apg2.json');
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const inSlice = (n) => n && SLICE.includes(n.file);
  return { g, byId, inSlice };
}

async function main() {
  const gv = await graphviz();
  const { g, byId, inSlice } = sliceData();
  // LEFT: files + IMPORTS only.
  const L = ['digraph L { graph [rankdir=TB, nodesep=0.25, ranksep=1.1, bgcolor="transparent", pad=0.2];', 'node [shape=note, style=filled, fillcolor="#F3F4F6", color="#7B8494", fontname="Helvetica", fontsize=24, margin="0.14,0.08"];', 'edge [color="#7B8494", penwidth=2.2, arrowsize=1.0];'];
  // Long file names break at a camel-case boundary so the import panel stays narrow.
  const brk = (s) => (s.length <= 16 ? s : s.replace(/^(.{6,}?)([A-Z][a-z]+(?:[A-Z][a-z]+)*\.ts)$/, '$1\\n$2'));
  for (const f of SLICE) L.push(`"${f}" [label="${brk(short(f))}"];`);
  let nImp = 0;
  for (const e of g.edges) {
    if (e.type !== 'IMPORTS') continue;
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s?.type === 'File' && t?.type === 'File' && inSlice(s) && inSlice(t)) {
      L.push(`"${s.file}" -> "${t.file}";`);
      nImp++;
    }
  }
  L.push('}');
  // RIGHT: files as layer-coloured containers; classes, interfaces and the methods that carry CALLS / SIGNATURE_USES.
  const R = ['digraph R { graph [rankdir=TB, nodesep=0.3, ranksep=0.6, bgcolor="transparent", pad=0.2, compound=true];', 'node [shape=box, style="rounded,filled", fillcolor=white, fontname="Helvetica", fontsize=20, margin="0.14,0.06", penwidth=1.6];', 'edge [penwidth=2.2, arrowsize=0.9, fontname="Helvetica", fontsize=17];'];
  const used = new Set();
  const counts = {};
  const keepEdges = [];
  for (const e of g.edges) {
    if (!['IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'CALLS', 'SIGNATURE_USES'].includes(e.type)) continue;
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!inSlice(s) || !inSlice(t)) continue;
    // One SIGNATURE_USES example is enough for the slide: the port method findById returns the domain entity.
    if (e.type === 'SIGNATURE_USES' && !(e.properties.publicSurface && s.name === 'BookingRepository.findById')) continue;
    keepEdges.push(e);
    used.add(s.id);
    used.add(t.id);
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  for (const n of g.nodes) if (inSlice(n) && (n.type === 'Class' || n.type === 'Interface')) used.add(n.id);
  for (const f of SLICE) {
    const fileNode = g.nodes.find((n) => n.type === 'File' && n.file === f);
    const lay = fileNode.layer;
    R.push(`subgraph "cluster_${f}" { label=<${short(f)}  <FONT COLOR="${C.layer[lay]}"><B>${lay}</B></FONT>>; labeljust=l; fontname="Helvetica"; fontsize=17; fontcolor="${C.muted}"; style="rounded,filled"; fillcolor="${C.layerSoft[lay]}"; color="${C.layer[lay]}"; penwidth=1.4;`);
    for (const n of g.nodes) {
      if (n.file !== f || !used.has(n.id)) continue;
      const kind = n.type === 'Interface' ? 'interface' : n.type === 'Class' ? 'class' : n.type === 'Method' ? 'method' : n.type.toLowerCase();
      const label = n.type === 'Method' ? `${n.name.split('.').pop()}()` : n.name;
      R.push(`"${n.id}" [label=<<FONT POINT-SIZE="17" COLOR="${C.muted}">${kind}</FONT><BR/>${label}>, color="${C.layer[lay]}"${n.type === 'Method' ? ', shape=ellipse, style=filled' : ''}];`);
    }
    R.push('}');
  }
  for (const e of keepEdges) {
    const st = EDGE[e.type];
    const lab = e.type === 'SIGNATURE_USES' ? `  ${(e.properties.positions ?? []).join(', ')} type` : '';
    R.push(`"${e.source}" -> "${e.target}" [color="${st.color}", style="${st.style}"${st.arrowhead ? `, arrowhead=${st.arrowhead}` : ''}${lab ? `, label="${lab}", fontcolor="${C.red}"` : ''}];`);
  }
  // Methods sit inside their class's file; DECLARES / CONTAINS are shown by the containment, not drawn.
  R.push('}');
  const gl = gv.layout(L.join('\n'), 'svg', 'dot');
  const gr = gv.layout(R.join('\n'), 'svg', 'dot');
  const top = 200;
  const colL = 48;
  const wL = 470;
  const colR = 560;
  const wR = W - colR - 48;
  const [eL, hL, sL] = embedGv(gl, colL + 20, top + 20, wL - 40);
  const [eR, hR, sR] = embedGv(gr, colR + 10, top + 20, wR - 20);
  const hB = Math.max(hL, hR) + 40;
  let body = '';
  body += rect(colL, top - 54, wL, hB + 54, { rx: 14, fill: '#FAFAFB', stroke: C.grid });
  body += rect(colR, top - 54, wR, hB + 54, { rx: 14, fill: '#FFFFFF', stroke: C.grid });
  body += text(colL + 20, top - 20, 'What an import graph sees', { size: 24, weight: 700 });
  body += text(colR + 20, top - 20, 'What the APG adds on the same six files', { size: 24, weight: 700 });
  body += eL + eR;
  const ly = top + hB + 34;
  body += text(colL + 20, ly, `${SLICE.length} files, ${nImp} import arrows. No layer, no type,`, { size: 19, fill: C.muted });
  body += text(colL + 20, ly + 26, 'no "who implements which port".', { size: 19, fill: C.muted });
  let lx = colR + 20;
  for (const k of ['IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'CALLS', 'SIGNATURE_USES']) {
    const st = EDGE[k];
    body += line(lx, ly - 6, lx + 40, ly - 6, { stroke: st.color, sw: k === 'SIGNATURE_USES' ? 3.5 : 2.5, dash: st.style === 'dashed' ? '7 5' : undefined });
    body += text(lx + 48, ly, st.label, { size: 17, weight: k === 'SIGNATURE_USES' ? 700 : 400, fill: k === 'SIGNATURE_USES' ? C.red : C.ink });
    lx += 48 + st.label.length * 10.2 + 28;
  }
  body += text(colR + 20, ly + 30, 'Coloured boxes = files with the layer the spec assigns. Imports are still in the APG; they are hidden here.', { size: 17, fill: C.muted });
  const height = ly + 30 + 90;
  console.error('A3 scale', sL, sR, counts, nImp);
  const svg = frame({
    title: 'Import graph vs Architectural Property Graph',
    subtitle: 'Same slice of the hexagonal reference project ("cancel a booking"), extracted for real. Left: the edges an import checker has. Right: what the APG adds.',
    badgeKind: 'dev',
    badgeLabel: 'DEVELOPMENT SET: reference project',
    body,
    height,
    footer: [
      'Source: extractAPG (V13_APG2_OPTIONS, components from the spec) on tests/fixtures/v1.3-reference/hexagonal, clean variant. Data: Docs/presentation-kit/data/hexagonal.clean.apg2.json',
      'APG v2 = the extractor option apg2 (Docs/v1.3/apg2-design.md), off by default in v1.3.',
    ],
  });
  save(FIG, 'A3-import-graph-vs-apg', svg, `
# A3 · import-graph-vs-apg

**Title on slide:** Import graph vs Architectural Property Graph

**What it shows.** The same six files of the hexagonal reference project, the "cancel a booking" slice: \`BookingController\` (inbound adapter), the driving port \`CancelBooking\`, the use case \`CancelBookingService\`, the driven port \`BookingRepository\`, its adapter \`InMemoryBookingRepository\`, and the domain entity \`Booking\`.
- **Left, an import graph:** files and import arrows only (${nImp} arrows among these files). This is what dependency-cruiser or a plain import graph holds.
- **Right, the APG:** the same files as containers coloured by the layer the spec assigns, with the classes and interfaces they declare, and the typed edges between them: IMPLEMENTS (which class implements which port), CONSTRUCTOR_INJECTS (who receives which port), CALLS (method to method), and the APG v2 edge SIGNATURE_USES (a public method's signature names a type, here the return type). Imports are still in the APG; they are hidden on the right for clarity.

**One idea.** An import arrow says "file A mentions file B". The APG says *how*: implements a port, is injected with a port, calls a method, exposes a type in its signature. Rules about ports and adapters need those facts.

**Numbers and sources.** All edges are real extractor output: \`extractAPG\` with \`V13_APG2_OPTIONS\` on \`tests/fixtures/v1.3-reference/hexagonal\` (clean variant), components from the spec's layers. Edge counts drawn on the right: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}. Data: \`Docs/presentation-kit/data/hexagonal.clean.apg2.json\`.

**Notes.**
- Methods are drawn inside the file of their class (the APG links them with DECLARES and CONTAINS; those edges are not drawn).
- Role labels (port, use case, adapter) are not drawn: the v1.3 annotator stores a layer on every node, but a role only from name tokens, so a drawn role would be the kit's reading, not the tool's.
- SIGNATURE_USES is APG v2, an extractor option that is off by default in v1.3 (\`Docs/v1.3/apg2-design.md\`); every other edge type is in the default v1.3 graph.
`);
}
main();
