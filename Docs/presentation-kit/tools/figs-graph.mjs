// A1, A2: the real APG of the hexagonal reference project (file level), clean and v01.
import { C, FIG, W, frame, embedGv, graphviz, readJson, save, text, rect, pill, line, esc } from './kit.mjs';

const LAYERS = ['config', 'adapters-inbound', 'application', 'domain', 'adapters-outbound'];
const LABEL = { config: 'config', 'adapters-inbound': 'adapters-inbound', application: 'application (use cases + ports)', domain: 'domain (core)', 'adapters-outbound': 'adapters-outbound' };
const short = (f) => f.split('/').pop().replace(/\.ts$/, '');

function dot(g, highlight) {
  const files = g.nodes.filter((n) => n.type === 'File');
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = [];
  out.push('digraph G { graph [rankdir=LR, newrank=true, nodesep=0.10, ranksep=0.45, splines=true, fontname="Helvetica", pad=0.1, bgcolor="transparent"];');
  out.push(`node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=22, height=0.46, margin="0.12,0.04", penwidth=1.4];`);
  out.push('edge [arrowsize=0.6, penwidth=1.0];');
  for (const L of LAYERS) {
    out.push(`subgraph "cluster_${L}" { label=<&#160;&#160;${LABEL[L]}>; labeljust=l; fontsize=23; fontcolor="${C.layer[L]}"; fontname="Helvetica-Bold"; style="rounded,filled"; color="${C.layer[L]}"; fillcolor="${C.layerSoft[L]}"; penwidth=1.5; margin=18;`);
    for (const f of files.filter((n) => n.layer === L)) {
      out.push(`"${f.id}" [label="${short(f.file)}", fillcolor="white", color="${C.layer[L]}", fontcolor="${C.ink}"];`);
    }
    out.push('}');
  }
  for (const e of g.edges) {
    if (e.type !== 'IMPORTS' && e.type !== 'RE_EXPORTS') continue;
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (s?.type !== 'File' || t?.type !== 'File') continue;
    const hot = highlight && s.file === highlight.from && t.file === highlight.to;
    const col = hot ? C.red : C.layer[s.layer] + '80';
    const attrs = hot ? `color="${C.red}", penwidth=5, arrowsize=1.2, constraint=false, xlabel=<<B>FF-S01 + FF-S04</B>>, fontcolor="${C.red}", fontsize=24, fontname="Helvetica"` : `color="${col}"`;
    // Outbound adapters are drawn on the right: reverse the layout direction of their edges, keep the arrowhead.
    if (s.layer === 'adapters-outbound' && !hot) out.push(`"${t.id}" -> "${s.id}" [dir=back, ${attrs}];`);
    else out.push(`"${s.id}" -> "${t.id}" [${attrs}];`);
  }
  out.push('}');
  return out.join('\n');
}

function legend(x, y, extra) {
  let s = '';
  let cx = x;
  for (const L of LAYERS) {
    s += rect(cx, y, 22, 22, { rx: 5, fill: C.layerSoft[L], stroke: C.layer[L], sw: 2 });
    s += text(cx + 30, y + 17, L, { size: 17 });
    cx += 30 + L.length * 9.5 + 30;
  }
  s += line(cx, y + 11, cx + 46, y + 11, { stroke: C.muted, sw: 2, marker: 'arrM' });
  s += text(cx + 56, y + 17, 'IMPORTS (file to file, arrow = importer to imported)', { size: 17 });
  if (extra) {
    s += line(x, y + 50, x + 46, y + 50, { stroke: C.red, sw: 4, marker: 'arrR' });
    s += text(x + 56, y + 56, extra, { size: 17, fill: C.red, weight: 600 });
  }
  return s;
}

async function main() {
  const gv = await graphviz();
  const clean = readJson('Docs/presentation-kit/data/hexagonal.clean.json');
  const v01 = readJson('Docs/presentation-kit/data/hexagonal.v01-domain-uses-outbound-adapter-constant.json');
  const nFiles = clean.nodes.filter((n) => n.type === 'File').length;
  const nImp = clean.edges.filter((e) => e.type === 'IMPORTS' && clean.nodes.find((n) => n.id === e.target)?.type === 'File').length;

  // A1
  {
    const g = gv.layout(dot(clean), 'svg', 'dot');
    const [emb, h, sc] = embedGv(g, 48, 150, W - 96); console.error("scale", sc, "font px", 22 * sc);
    const body = emb + legend(48, 150 + h + 24);
    const height = 150 + h + 24 + 40 + 70;
    const svg = frame({
      title: 'The graph the firewall reads: hexagonal reference project',
      subtitle: `${nFiles} files, ${nImp} file-to-file IMPORTS edges, grouped by the layer the spec assigns. Extracted for real (clean variant).`,
      badgeKind: 'dev',
      badgeLabel: 'DEVELOPMENT SET: reference project',
      body,
      height,
      footer: 'Source: extractAPG (V13_DEFAULT_OPTIONS) on tests/fixtures/v1.3-reference/hexagonal, clean variant; layers from tests/fixtures/v1.3-reference/hexagonal/spec.yaml. Data: Docs/presentation-kit/data/hexagonal.clean.json',
    });
    save(FIG, 'A1-apg-hexagonal-overview', svg, `
# A1 · apg-hexagonal-overview

**Title on slide:** The graph the firewall reads: hexagonal reference project

**What it shows.** The Architectural Property Graph (APG) of the hexagonal reference project (hotel room booking), clean variant, at file level. Each box is a File node; each colour band is the layer the spec assigns to it (domain, application, adapters-inbound, adapters-outbound, config). Each arrow is a file-to-file IMPORTS edge, from the importing file to the imported file, coloured by the importer's layer. Outbound adapters are drawn on the right so that every arrow from them points inward, as Cockburn's picture does; only the drawing position changes, not the edge.

**One idea.** The tool does not read code text when it checks a rule; it reads this graph.

**Numbers and their sources.**
- ${nFiles} File nodes and ${nImp} file-to-file IMPORTS edges: counted by the kit from \`extractAPG\` with \`V13_DEFAULT_OPTIONS\` on \`tests/fixtures/v1.3-reference/hexagonal\` (clean variant), the same call as \`scripts/v1.3/ue-graph.ts\`. Data file: \`Docs/presentation-kit/data/hexagonal.clean.json\`.
- The layers come from \`scripts/v1.3/lib/layer-assignment.ts\` under \`tests/fixtures/v1.3-reference/hexagonal/spec.yaml\`. The hand-written expected graph agrees with the tool on every edge and layer of the clean variants (\`Docs/DiagnosticRuns/v1.3-reference-after-fixes-2026-10-15.md\` §1, "Graph": 269/269 edges and 115/115 layers over the four patch styles).
- The full graph also holds Class, Interface, Method and Function nodes and IMPLEMENTS, CONSTRUCTOR_INJECTS, CALLS, DECLARES, CONTAINS and FLOWS_TO edges (110 nodes and 195 edges in total, same data file). They are left out here; A3 shows them.

**Caveat to say.** This is a reference project written for the development set (AI-written), not a real-world codebase.
`);
  }

  // A2
  {
    const hl = { from: 'src/domain/services/PriceCalculator.ts', to: 'src/adapters/outbound/payment/FakePaymentGateway.ts' };
    const g = gv.layout(dot(v01, hl), 'svg', 'dot');
    const [emb, h, sc] = embedGv(g, 48, 170, W - 96); console.error("scale", sc, "font px", 22 * sc);
    const body = emb + legend(48, 170 + h + 20, 'The planted edge: FF-S01 dependency-direction-graph fires (blocking) — so does FF-S04 core-isolation');
    const height = 170 + h + 20 + 80 + 80;
    const svg = frame({
      title: 'One planted violation, seen in the graph',
      subtitle: [
        'Variant v01: domain/services/PriceCalculator.ts imports PAYMENT_FEE_CENTS from adapters/outbound/payment/FakePaymentGateway.ts.',
        'The core points outward to an adapter. The spec allows only adapters-outbound → domain, so this edge runs an allowed edge backwards.',
      ],
      badgeKind: 'dev',
      badgeLabel: 'DEVELOPMENT SET: planted variant',
      body,
      height,
      footer: [
        'Source: extractAPG (V13_DEFAULT_OPTIONS) on hexagonal variant v01 (tests/fixtures/v1.3-reference/hexagonal/variants/v01-domain-uses-outbound-adapter-constant).',
        'Finding: results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json (FF-S01 and FF-S04 rows).',
      ],
    });
    save(FIG, 'A2-apg-violation-highlight', svg, `
# A2 · apg-violation-highlight

**Title on slide:** One planted violation, seen in the graph

**What it shows.** The same file-level APG as A1, for the planted variant v01 of the hexagonal reference project. The variant adds one import: \`src/domain/services/PriceCalculator.ts\` imports the constant \`PAYMENT_FEE_CENTS\` from the outbound adapter \`src/adapters/outbound/payment/FakePaymentGateway.ts\`. That edge is drawn thick and red. Every other edge is the clean project's.

**One idea.** A violation is one edge in the graph that the spec does not allow.

**What the tool reports for this edge** (real rows from the committed run):
- FF-S01 \`dependency-direction-graph\`, severity critical, blocking tier: "src/domain/services/PriceCalculator.ts (domain) imports against the allowed direction from src/adapters/outbound/payment/FakePaymentGateway.ts (adapters-outbound)", line 1.
- FF-S04 \`core-isolation\`, blocking tier: "Core file src/domain/services/PriceCalculator.ts imports from src/adapters/outbound/payment/FakePaymentGateway.ts in adapters-outbound".

**Sources.**
- Variant patch and manifest: \`tests/fixtures/v1.3-reference/hexagonal/variants/v01-domain-uses-outbound-adapter-constant/\` (\`variant.patch\`, \`expected-findings.json\`: both rows expected).
- Tool rows: \`results/v1.3-reference/after-member-facts/evidence/hexagonal/v01-domain-uses-outbound-adapter-constant.json\` and \`raw/hexagonal/v01-domain-uses-outbound-adapter-constant.json\`.
- Tier of FF-S01 and FF-S04 in hexagonal: blocking candidate "yes" in \`results/v1.3-reference/after-member-facts/report.md\`, section hexagonal.
- Graph data: \`Docs/presentation-kit/data/hexagonal.v01-domain-uses-outbound-adapter-constant.json\` (one more IMPORTS edge than the clean variant).

**Caveat to say.** Planted by the development-set author (AI-written); the tool rows are a development-set result, not a validity estimate. The two rows are one defect seen by two rules (the "one edge, one rule" principle, P2 in \`Docs/v1.3/construct-decisions.md\`, flags this overlap as an open point).
`);
  }
}
main();
