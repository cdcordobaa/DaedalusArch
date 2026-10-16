/**
 * Renders the architect report model as one static HTML file: inline CSS, inline JS, an inline SVG layer diagram and
 * no third-party library. A Content-Security-Policy blocks every network request, so the file works offline.
 */
import type { ArchitectReportModel, FindingModel, LayerBox, LayerEdge } from './model.js';
import type { DisplayTier } from './rule-text.js';
import { ARCHITECT_CLIENT_SCRIPT } from './client-script.js';
import { ARCHITECT_STYLES } from './styles.js';

const TIERS: readonly DisplayTier[] = ['defining', 'warning', 'not-counted'];

export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ruleTip = (id: string): string => `Rule id: ${id}`;
const plural = (n: number, one: string, many = `${one}s`): string => `${String(n)} ${n === 1 ? one : many}`;
const score = (n: number | null): string => (n === null ? 'n/a' : n.toFixed(2));

// ── Summary ────────────────────────────────────────────────────────────────

function renderSummary(m: ArchitectReportModel): string {
  const s = m.summary;
  const blockers = s.blockers.length > 0
    ? `<ul class="blockers">${s.blockers.map((b) => `<li><span class="rule-name" title="${esc(ruleTip(b.ruleId))}">${esc(b.title)}</span> <span class="count">${esc(plural(b.count, 'finding'))}</span><br><span class="muted">${esc(b.says)}</span></li>`).join('')}</ul>`
    : `<p class="muted">${s.scoringMode === 'v1.3' ? 'Nothing blocks the verdict.' : 'Not applicable in the v1.2e scoring.'}</p>`;
  const tierCount = (t: DisplayTier): string =>
    `<div class="stat stat-${t}"><span class="stat-n">${String(s.counts[t])}</span><span class="stat-l" title="${esc(m.tierExplanations[t])}">${esc(m.tierLabels[t])}</span></div>`;
  return `<section class="summary verdict-${s.verdict}" aria-labelledby="summary-h">
  <div class="verdict-card">
    <p class="verdict-word">${s.verdict === 'fail' ? 'FAIL' : s.verdict === 'incomplete' ? 'INCOMPLETE' : 'PASS'}</p>
    <h2 id="summary-h">${esc(s.headline)}</h2>
    <ul class="explain">${s.explanation.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
  </div>
  <div class="summary-grid">
    <div class="panel">
      <h3>What blocks the verdict</h3>
      ${blockers}
    </div>
    <div class="panel">
      <h3>Scores</h3>
      <dl class="scores">
        <div><dt title="Health score over the defining rules only (1 = no defining rule broken)">Defining-rule score</dt><dd>${esc(score(s.definingScore))}</dd></div>
        <div><dt title="Health score over every deterministic rule, warnings included">Overall health score</dt><dd>${esc(score(s.overallScore))}</dd></div>
        <div><dt>Rules checked</dt><dd>${String(s.rulesChecked)}</dd></div>
      </dl>
      <div class="stats">${TIERS.map(tierCount).join('')}</div>
    </div>
  </div>
</section>`;
}

// ── Layer diagram ──────────────────────────────────────────────────────────

const BOX_X = 300;
const BOX_W = 300;
const BOX_H = 62;
const GAP = 46;
const TOP = 20;
const VIEW_W = 900;

function edgeClass(e: LayerEdge): string {
  if (e.defining > 0) return 'edge edge-defining';
  if (e.findings > 0) return 'edge edge-warning';
  if (e.allowed === false) return 'edge edge-forbidden';
  return 'edge edge-ok';
}

function edgeLabel(e: LayerEdge): string {
  const parts = [plural(e.imports, 'import')];
  if (e.findings > 0) parts.push(plural(e.findings, 'finding'));
  return parts.join(' · ');
}

/** Display order: outermost declared layer on top, the innermost at the bottom, unassigned files last. */
function displayOrder(layers: readonly LayerBox[]): LayerBox[] {
  const declared = layers.filter((l) => l.name !== '(no layer)').reverse();
  return [...declared, ...layers.filter((l) => l.name === '(no layer)')];
}

export function renderLayerDiagram(m: ArchitectReportModel): string {
  const order = displayOrder(m.layers);
  const yOf = new Map(order.map((l, i) => [l.name, TOP + i * (BOX_H + GAP)]));
  const height = TOP * 2 + order.length * BOX_H + Math.max(0, order.length - 1) * GAP + 10;
  const idx = (n: string): number => order.findIndex((l) => l.name === n);

  // Downward edges on the left, upward edges on the right; wider arcs for longer spans.
  const left = m.edges.filter((e) => idx(e.to) > idx(e.from));
  const right = m.edges.filter((e) => idx(e.to) < idx(e.from));
  const span = (e: LayerEdge): number => Math.abs(idx(e.to) - idx(e.from));
  const bySpan = (a: LayerEdge, b: LayerEdge): number => span(a) - span(b) || idx(a.from) - idx(b.from);
  const arcs: string[] = [];
  const drawSide = (edges: LayerEdge[], side: 'left' | 'right'): void => {
    const sorted = [...edges].sort(bySpan);
    const step = sorted.length > 1 ? Math.min(30, 150 / (sorted.length - 1)) : 0;
    sorted.forEach((e, k) => {
      const y0 = (yOf.get(e.from) ?? 0) + (side === 'left' ? 40 : 22);
      const y1 = (yOf.get(e.to) ?? 0) + (side === 'left' ? 22 : 40);
      const x = side === 'left' ? BOX_X : BOX_X + BOX_W;
      const d = 34 + k * step;
      const cx = side === 'left' ? x - d : x + d;
      const label = edgeLabel(e);
      const lx = side === 'left' ? cx + 0.25 * d - 6 : cx - 0.25 * d + 6;
      const ly = (y0 + y1) / 2;
      const anchor = side === 'left' ? 'end' : 'start';
      const desc = `${e.from} depends on ${e.to}: ${label}${e.allowed === false ? ' (not allowed by the spec)' : ''}`;
      arcs.push(`<g class="${edgeClass(e)}" data-edge="${esc(`${e.from}>${e.to}`)}"${e.findings > 0 ? ' tabindex="0" role="button"' : ''}>
  <title>${esc(desc)}</title>
  <path d="M${String(x)} ${String(y0)} C${String(cx)} ${String(y0)} ${String(cx)} ${String(y1)} ${String(x)} ${String(y1)}" marker-end="url(#arrow-${e.defining > 0 ? 'defining' : e.findings > 0 ? 'warning' : 'ok'})"/>
  <text x="${String(Math.round(lx))}" y="${String(Math.round(ly + 4))}" text-anchor="${anchor}">${esc(label)}</text>
</g>`);
    });
  };
  drawSide(left, 'left');
  drawSide(right, 'right');

  const boxes = order.map((l) => {
    const y = yOf.get(l.name) ?? 0;
    const cls = ['layer', l.definingCount > 0 ? 'layer-defining' : l.findingCount > 0 ? 'layer-warning' : '', l.name === '(no layer)' ? 'layer-unassigned' : ''].filter(Boolean).join(' ');
    const sub = `${plural(l.fileCount, 'file')} · ${plural(l.findingCount, 'finding')}${l.definingCount > 0 ? ` (${String(l.definingCount)} defining)` : ''}`;
    const internal = l.internalFindings > 0 ? `<text class="internal" x="${String(BOX_X + BOX_W - 10)}" y="${String(y + 20)}" text-anchor="end">↻ ${esc(plural(l.internalFindings, 'finding'))} inside</text>` : '';
    return `<g class="${cls}" data-layer="${esc(l.name)}" tabindex="0" role="button">
  <title>${esc(`${l.name}${l.role !== '' ? ` (${l.role})` : ''}${l.directories.length > 0 ? `: ${l.directories.join(', ')}` : ''}. Click to filter the findings.`)}</title>
  <rect x="${String(BOX_X)}" y="${String(y)}" width="${String(BOX_W)}" height="${String(BOX_H)}" rx="10"/>
  <text class="layer-name" x="${String(BOX_X + 14)}" y="${String(y + 26)}">${esc(l.name)}</text>
  <text class="layer-sub" x="${String(BOX_X + 14)}" y="${String(y + 47)}">${esc(sub)}</text>
  ${internal}
</g>`;
  }).join('\n');

  const marker = (id: string): string =>
    `<marker id="arrow-${id}" class="marker-${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z"/></marker>`;
  const rows = m.edges.map((e) => `<tr><td>${esc(e.from)}</td><td>${esc(e.to)}</td><td>${String(e.imports)}</td><td>${e.allowed === null ? 'n/a' : e.allowed ? 'yes' : 'no'}</td><td>${String(e.findings)}</td><td>${String(e.defining)}</td></tr>`).join('');

  return `<section class="diagram" aria-labelledby="diagram-h">
  <h2 id="diagram-h">Layer diagram</h2>
  <p class="muted">Outer layers on top, the core at the bottom. Arrows on the left point down the layers, arrows on the right point up. Click a layer or a highlighted arrow to filter the findings.</p>
  <div class="diagram-scroll"><svg class="layer-svg" viewBox="0 0 ${String(VIEW_W)} ${String(height)}" role="img" aria-label="Layer dependency diagram">
    <defs>${marker('defining')}${marker('warning')}${marker('ok')}</defs>
    ${arcs.join('\n')}
    ${boxes}
  </svg></div>
  <ul class="legend">
    <li><span class="sw sw-defining"></span>dependency with a defining-rule finding</li>
    <li><span class="sw sw-warning"></span>dependency with warnings only</li>
    <li><span class="sw sw-ok"></span>dependency without findings</li>
    <li><span class="sw sw-forbidden"></span>dependency the spec does not allow, without a finding</li>
  </ul>
  <details><summary>The diagram as a table</summary>
    <div class="table-wrap"><table><thead><tr><th>From layer</th><th>To layer</th><th>Imports</th><th>Allowed</th><th>Findings</th><th>Defining</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No dependency between layers.</td></tr>'}</tbody></table></div>
  </details>
</section>`;
}

// ── Findings ───────────────────────────────────────────────────────────────

function edgesOf(f: FindingModel): string[] {
  const out = new Set<string>();
  const steps = f.path.filter((p) => p.external !== true);
  for (let i = 0; i + 1 < steps.length; i++) {
    const a = steps[i]?.layer ?? '(no layer)';
    const b = steps[i + 1]?.layer ?? '(no layer)';
    if (a !== b) out.add(`${a}>${b}`);
  }
  return [...out];
}

function renderPath(f: FindingModel): string {
  if (f.pathKind === 'project') return '<div class="path"><span class="k">Scope:</span> the whole project</div>';
  const what = f.pathKind === 'cycle' ? 'Cycle' : f.pathKind === 'import' ? 'Edge path' : 'File';
  const steps = f.path.map((p) => `<li><code>${esc(p.file)}</code> <span class="layer-tag">${esc(p.external === true ? 'external package' : p.layer ?? 'no layer')}</span></li>`).join('');
  return `<div class="path"><span class="k">${what}:</span><ol class="path-${f.pathKind}">${steps}</ol></div>`;
}

function renderExcerpt(f: FindingModel): string {
  if (f.excerpt === null) return f.line === null ? '' : `<p class="muted">Line ${String(f.line)} (source not available).</p>`;
  const rows = f.excerpt.lines.map((l) => `<span class="row${l.hit ? ' hit' : ''}"><span class="ln">${String(l.n)}</span><span class="src">${esc(l.text) || ' '}</span></span>`).join('');
  return `<figure class="code"><figcaption><code>${esc(f.excerpt.file)}</code></figcaption><pre>${rows}</pre></figure>`;
}

function renderFinding(f: FindingModel, m: ArchitectReportModel): string {
  const loc = f.line !== null ? `${f.file}:${String(f.line)}` : f.file;
  return `<article class="finding tier-${f.tier}" data-tier="${f.tier}" data-rule="${esc(f.ruleId)}" data-layers="${esc(f.layers.join('|'))}" data-files="${esc([...new Set(f.path.filter((p) => p.external !== true).map((p) => p.file))].join('|'))}" data-edges="${esc(edgesOf(f).join('|'))}">
  <header>
    <span class="tier-badge" title="${esc(m.tierExplanations[f.tier])}">${esc(f.tierLabel)}</span>
    <h3 title="${esc(ruleTip(f.ruleId))}">${esc(f.ruleTitle)}</h3>
    ${f.pathKind === 'project' ? '<span class="loc">whole project</span>' : `<span class="loc">${esc(loc)}</span>`}
  </header>
  <p><span class="k">The rule:</span> ${esc(f.ruleSays)}</p>
  <p><span class="k">What was found:</span> ${esc(f.message)}</p>
  ${renderPath(f)}
  ${renderExcerpt(f)}
  <p class="fix"><span class="k">How to fix:</span> ${esc(f.fixHint)}</p>
</article>`;
}

function renderFilters(m: ArchitectReportModel): string {
  const rules = new Map<string, string>();
  for (const f of m.findings) rules.set(f.ruleId, f.ruleTitle);
  const ruleOpts = [...rules.entries()].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([id, title]) => `<option value="${esc(id)}" title="${esc(ruleTip(id))}">${esc(title)}</option>`).join('');
  const layerOpts = [...new Set(m.findings.flatMap((f) => f.layers))].sort()
    .map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  const fileOpts = [...new Set(m.findings.flatMap((f) => f.path.filter((p) => p.external !== true).map((p) => p.file)))].sort()
    .map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  const tierBoxes = TIERS.map((t) => `<label class="chk chk-${t}" title="${esc(m.tierExplanations[t])}"><input type="checkbox" data-filter-tier="${t}" checked> ${esc(m.tierLabels[t])} (${String(m.summary.counts[t])})</label>`).join('');
  return `<form class="filters" id="filters" onsubmit="return false">
  <fieldset class="tiers"><legend>Tier</legend>${tierBoxes}</fieldset>
  <label>Rule <select id="f-rule"><option value="">All rules</option>${ruleOpts}</select></label>
  <label>Layer <select id="f-layer"><option value="">All layers</option>${layerOpts}</select></label>
  <label>File <select id="f-file"><option value="">All files</option>${fileOpts}</select></label>
  <p class="filter-status"><span id="f-count" aria-live="polite">Showing ${plural(m.findings.length, 'finding')}</span> <span id="f-edge" hidden></span> <button type="button" id="f-clear">Clear filters</button></p>
</form>`;
}

function renderFindings(m: ArchitectReportModel): string {
  const body = m.findings.length > 0
    ? `${renderFilters(m)}<div class="finding-list">${m.findings.map((f) => renderFinding(f, m)).join('\n')}</div><p class="empty" id="f-empty" hidden>No finding matches these filters.</p>`
    : '<p class="empty">No findings: every rule that ran is satisfied.</p>';
  return `<section class="findings" aria-labelledby="findings-h"><h2 id="findings-h">Findings</h2>${body}</section>`;
}

export function renderArchitectHtml(m: ArchitectReportModel): string {
  const title = `Architecture report: ${m.meta.projectName}`;
  const metaBits = [
    `Spec <code>${esc(m.meta.specPath)}</code>`,
    ...(m.meta.style !== null ? [`style ${esc(m.meta.style)}`] : []),
    `${esc(m.meta.evaluationMode)} run`,
    `${esc(m.summary.scoringMode)} scoring`,
  ];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<meta name="generator" content="daedalus-arch evaluate --html">
<title>${esc(title)}</title>
<style>${ARCHITECT_STYLES}</style>
</head>
<body>
<main class="wrap">
<header class="top">
  <h1>${esc(title)}</h1>
  <p class="muted">${metaBits.join(' · ')} · run <code>${esc(m.meta.runId)}</code></p>
</header>
${renderSummary(m)}
${renderLayerDiagram(m)}
${renderFindings(m)}
</main>
<script>${ARCHITECT_CLIENT_SCRIPT}</script>
</body>
</html>
`;
}
