// Plain set, graph figures: A1 (the tool's map of a real project) and A3 (import checker vs the tool's map).
// Side figures, 1430 x 900, text >= 26 px. A1 is laid out by Graphviz (KIT_TOOLS, as in figures/); A3 is drawn by hand
// from the same extracted rows (data/hexagonal.clean.apg2.json).
import { C, SIDE, T, canvas, rect, line, arrow, poly, legend, savePlain, caption, tw } from './plain-kit.mjs';
import { graphviz, readJson } from './kit.mjs';

const W = SIDE.w;
const LAYERS = ['config', 'adapters-inbound', 'application', 'domain', 'adapters-outbound'];
const LABEL = { config: 'config', 'adapters-inbound': 'inbound adapters', application: 'application', domain: 'domain (core)', 'adapters-outbound': 'outbound adapters' };

/** Embed Graphviz SVG to fit a box; titles and comments (which hold node ids) are removed. Returns [svg, w, h, scale]. */
function fit(gvSvg, x, y, maxW, maxH) {
  const m = gvSvg.match(/viewBox="([\d.\s-]+)"/);
  const [, , vw, vh] = m[1].trim().split(/\s+/).map(Number);
  const sc = Math.min(maxW / vw, maxH / vh);
  const w = vw * sc;
  const h = vh * sc;
  const inner = gvSvg
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<!DOCTYPE[^>]*>/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<svg[^>]*>/, `<svg x="${x + (maxW - w) / 2}" y="${y}" width="${w}" height="${h}" viewBox="${m[1]}" xmlns="http://www.w3.org/2000/svg">`)
    .replace(/<polygon fill="white" stroke="none"[^>]*\/>/, '');
  return [inner, w, h, sc];
}

// ---------------- A1 ----------------
async function a1() {
  const gv = await graphviz();
  const g = readJson('Docs/presentation-kit/data/hexagonal.clean.json');
  const files = g.nodes.filter((n) => n.type === 'File');
  const key = new Map(files.map((f, i) => [f.id, `f_${i + 1}`]));
  const imports = g.edges.filter((e) => (e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') && key.has(e.source) && key.has(e.target));
  const byId = new Map(files.map((n) => [n.id, n]));
  const dot = (fs) => {
    const out = ['digraph G { graph [rankdir=LR, newrank=true, nodesep=0.12, ranksep=0.5, splines=true, fontname="Helvetica", pad=0.05, bgcolor="transparent"];'];
    out.push('node [shape=box, style="rounded,filled", label="", width=0.42, height=0.26, penwidth=1.6];');
    out.push('edge [arrowsize=0.5, penwidth=1.0];');
    for (const L of LAYERS) {
      out.push(`subgraph "cluster_${L}" { label=<${LABEL[L]}&#160;&#160;&#160;&#160;>; labeljust=l; fontsize=${fs}; fontcolor="${C.layer[L]}"; fontname="Helvetica-Bold"; style="rounded,filled"; color="${C.layer[L]}"; fillcolor="${C.layerSoft[L]}"; penwidth=2; margin=14;`);
      for (const f of files.filter((n) => n.layer === L)) out.push(`"${key.get(f.id)}" [fillcolor="white", color="${C.layer[L]}"];`);
      out.push('}');
    }
    for (const e of imports) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      const col = C.layer[s.layer] + '90';
      if (s.layer === 'adapters-outbound') out.push(`"${key.get(t.id)}" -> "${key.get(s.id)}" [dir=back, color="${col}"];`);
      else out.push(`"${key.get(s.id)}" -> "${key.get(t.id)}" [color="${col}"];`);
    }
    out.push('}');
    return out.join('\n');
  };
  // Choose the cluster-label size so that, after fitting, it is drawn at >= 30 px.
  let fs = 20;
  let res;
  for (let i = 0; i < 8; i++) {
    res = fit(gv.layout(dot(fs), 'svg', 'dot'), 30, 20, W - 60, 740);
    if (fs * res[3] >= 30) break;
    fs = Math.ceil((31 / res[3]) * 1.02);
  }
  const [emb, , h] = res;
  let b = emb;
  const ly = 20 + h + 60;
  b += T(30, ly, `${files.length} files · ${imports.length} imports`, { size: 34, weight: 700 });
  const lx = 30 + tw(`${files.length} files · ${imports.length} imports`, 34, 700) + 50;
  b += rect(lx, ly - 24, 40, 24, { rx: 6, fill: '#fff', stroke: C.ink, sw: 2 });
  b += T(lx + 54, ly - 2, 'one file', { size: 28 });
  b += arrow(lx + 200, ly - 12, lx + 270, ly - 12, { color: C.muted, sw: 3 });
  b += T(lx + 284, ly - 2, 'one file imports another', { size: 28 });
  console.error('A1 cluster label drawn at', (fs * res[3]).toFixed(1), 'px; files', files.length, 'imports', imports.length);
  savePlain('A1-apg-hexagonal-overview', canvas(SIDE, b), caption('A1-apg-hexagonal-overview',
    'The tool reads a real project as a map: every file sits in the layer the spec gives it, and every import is an arrow. This is the hexagonal reference project: 30 files, 74 imports.',
    ['Graph: "30 files, 74 file-to-file IMPORTS edges" (hexagonal reference project, clean variant).'],
    ['File names are left out at this type size; each box is one file. The counts are computed by the generator from data/hexagonal.clean.json, as in figures/A1, and match NUMBERS.md.']));
}

// ---------------- A3 ----------------
function a3() {
  // Same six files in both panels, same positions. Plain role names instead of file names.
  const N = {
    ctrl: ['web controller', 'adapters-inbound'],
    svc: ['cancel service', 'application'],
    repoImpl: ['storage', 'adapters-outbound'],
    port: ['cancel contract', 'application'],
    repo: ['storage contract', 'application'],
    booking: ['Booking', 'domain'],
  };
  const bw = 190;
  const bh = 92;
  const pos = (ox) => ({
    ctrl: [ox + 15, 150],
    svc: [ox + 235, 150],
    repoImpl: [ox + 455, 150],
    port: [ox + 115, 380],
    repo: [ox + 355, 380],
    booking: [ox + 355, 600],
  });
  const lw = 690;
  const rx0 = 730;
  let b = '';
  b += rect(20, 20, lw, 780, { rx: 16, fill: '#FAFAFB', stroke: C.grid, sw: 2 });
  b += rect(rx0, 20, W - 20 - rx0, 780, { rx: 16, fill: '#fff', stroke: C.grid, sw: 2 });
  b += T(44, 76, 'Import checker', { size: 32, weight: 700 });
  b += T(rx0 + 24, 76, 'The tool’s map', { size: 32, weight: 700 });
  const drawNodes = (P, colored) => {
    let s = '';
    for (const [k, [name, layer]] of Object.entries(N)) {
      const [x, y] = P[k];
      const lines = name.split(' ');
      s += rect(x, y, bw, bh, { rx: 12, fill: colored ? C.layerSoft[layer] : '#F3F4F6', stroke: colored ? C.layer[layer] : '#7B8494', sw: 2.5 });
      const ls = lines.length > 1 ? [lines[0], lines.slice(1).join(' ')] : lines;
      ls.forEach((l, i) => (s += T(x + bw / 2, y + bh / 2 + 9 + (i - (ls.length - 1) / 2) * 32, l, { size: 28, anchor: 'middle', weight: k === 'booking' ? 700 : 400 })));
    }
    return s;
  };
  const edge = (P, a, z, o = {}) => {
    const [ax, ay] = P[a];
    const [zx, zy] = P[z];
    const acx = ax + bw / 2;
    const zcx = zx + bw / 2;
    const y1 = ay + bh;
    const y2 = zy;
    const dx = o.dx ?? 0;
    return arrow(acx + dx, y1 + 4, zcx + (o.end ?? 0), y2 - 8, o);
  };
  const L = pos(20);
  const R = pos(rx0 + 5);
  const IMPORTS = [['ctrl', 'port'], ['svc', 'port'], ['svc', 'repo'], ['repoImpl', 'repo'], ['repoImpl', 'booking'], ['repo', 'booking']];
  for (const [a, z] of IMPORTS) {
    const dx = a === 'svc' ? (z === 'port' ? -40 : 40) : 0;
    const end = { 'ctrl>port': -45, 'svc>port': 45, 'svc>repo': -45, 'repoImpl>repo': 45 }[`${a}>${z}`] ?? 0;
    if (a === 'repoImpl' && z === 'booking') b += poly([[L.repoImpl[0] + bw - 20, L.repoImpl[1] + bh + 4], [L.repoImpl[0] + bw - 20, L.booking[1] + bh / 2], [L.booking[0] + bw + 10, L.booking[1] + bh / 2]], { color: '#7B8494', sw: 3.5 });
    else b += edge(L, a, z, { color: '#7B8494', sw: 3.5, dx, end });
  }
  b += drawNodes(L, false);
  // right: typed edges
  const IMPL = C.layer.application;
  const INJ = C.layer['adapters-inbound'];
  const CALL = C.layer.domain;
  const SIG = C.red;
  b += edge(R, 'ctrl', 'port', { color: INJ, sw: 4, end: -45 });
  b += edge(R, 'svc', 'port', { color: IMPL, sw: 4, dash: '10 7', dx: -40, end: 45 });
  b += edge(R, 'svc', 'repo', { color: INJ, sw: 4, dx: 40, end: -45 });
  b += edge(R, 'repoImpl', 'repo', { color: IMPL, sw: 4, dash: '10 7', end: 45 });
  b += poly([[R.svc[0] + bw / 2, R.svc[1] + bh + 4], [R.svc[0] + bw / 2, R.booking[1] + bh / 2], [R.booking[0] - 10, R.booking[1] + bh / 2]], { color: CALL, sw: 4 });
  b += edge(R, 'repo', 'booking', { color: SIG, sw: 5 });
  b += drawNodes(R, true);
  // bottom notes
  b += T(44, 760, '6 files, 6 import arrows. Nothing else.', { size: 28, fill: C.muted });
  const items = [[INJ, 'is handed', 'line'], [IMPL, 'implements', 'dash'], [CALL, 'calls', 'line'], [SIG, 'returns (richer map)', 'line']];
  b += legend(rx0 + 24, 730, items.slice(0, 2), 26, 30)[0];
  b += legend(rx0 + 24, 775, items.slice(2), 26, 30)[0];
  b += T(20, 860, 'Same six files of the hexagonal reference project, task “cancel a booking”. Coloured = layer.', { size: 26, fill: C.muted });
  savePlain('A3-import-graph-vs-apg', canvas(SIDE, b), caption('A3-import-graph-vs-apg',
    'On the same six files, an import checker sees only six "uses" arrows; the tool’s map also knows each file’s layer, who implements which contract, who is handed what, who calls whom, and (richer map) which types a method returns.',
    ['Graph: "6 files, 6 import arrows; IMPLEMENTS 2, CONSTRUCTOR_INJECTS 2, CALLS 1, SIGNATURE_USES 1 (drawn)" (the "cancel a booking" slice).'],
    ['Plain role names replace the file names: web controller = BookingController, cancel service = CancelBookingService, storage = InMemoryBookingRepository, cancel contract = CancelBooking, storage contract = BookingRepository.', 'Edges are drawn by hand from the rows of data/hexagonal.clean.apg2.json; the one SIGNATURE_USES drawn is the storage contract returning Booking.']));
}

await a1();
a3();
