/**
 * Self-contained HTML dashboard template.
 *
 * Data is injected by replacing the __DASHBOARD_DATA__ and __GRAPH_DATA__
 * placeholders with serialized JSON at generation time.
 *
 * CDN dependencies:
 * - Tailwind CSS (Play CDN)
 * - Cytoscape.js + dagre layout
 */
export function getHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Architectonic Firewall — Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/cytoscape@3.30.4/dist/cytoscape.min.js"></script>
  <script src="https://unpkg.com/dagre@0.8.5/dist/dagre.min.js"></script>
  <script src="https://unpkg.com/cytoscape-dagre@2.5.0/cytoscape-dagre.js"></script>
  <style>
    #cy { width: 100%; height: 500px; border: 1px solid #e5e7eb; border-radius: 0.5rem; }
    .gauge-ring { transition: stroke-dashoffset 1s ease-in-out; }
    .verdict-pass { color: #10b981; }
    .verdict-warning { color: #f59e0b; }
    .verdict-soft-block { color: #f97316; }
    .verdict-hard-block { color: #ef4444; }
    .severity-critical { background: #fef2f2; color: #991b1b; border-color: #fecaca; }
    .severity-major { background: #fff7ed; color: #9a3412; border-color: #fed7aa; }
    .severity-minor { background: #fefce8; color: #854d0e; border-color: #fef08a; }
    .severity-advisory { background: #f0f9ff; color: #075985; border-color: #bae6fd; }
    .baseline-tag { background: #e5e7eb; color: #4b5563; }
    .new-tag { background: #fee2e2; color: #991b1b; }
    .route-symbolic { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .route-neuronal { background: #f5f3ff; color: #6b21a8; border: 1px solid #ddd6fe; }
    .route-hybrid { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    table th { cursor: pointer; user-select: none; }
    table th:hover { background: #f3f4f6; }
    .sort-asc::after { content: ' \\u25B2'; font-size: 0.65rem; }
    .sort-desc::after { content: ' \\u25BC'; font-size: 0.65rem; }
    .pipeline-arrow { color: #94a3b8; font-size: 1.5rem; line-height: 1; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

  <!-- ═══ HEADER ═══ -->
  <header class="bg-white border-b border-gray-200 shadow-sm" data-testid="report-header">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900" data-testid="header-product-name"></h1>
          <p class="mt-1 text-sm text-gray-500">
            Project: <span class="font-medium text-gray-700" data-testid="header-project-name"></span>
          </p>
        </div>
        <div class="text-right text-sm text-gray-500">
          <p>Evaluated: <span data-testid="header-timestamp"></span></p>
          <p>Spec: <span class="font-mono" data-testid="header-spec-version"></span></p>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

    <!-- ═══ HOW IT WORKS ═══ -->
    <section data-testid="how-it-works-section" class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-5">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-base font-semibold text-indigo-900 mb-2">How this evaluation works</h2>
          <p class="text-sm text-indigo-800 leading-relaxed">
            <strong>Two evaluation paths run side-by-side.</strong>
            The <span class="px-1.5 py-0.5 rounded text-xs route-symbolic">symbolic</span> path compiles fitness functions to Cypher queries that run against the Architectural Property Graph (APG) — fast, deterministic, structural.
            The <span class="px-1.5 py-0.5 rounded text-xs route-neuronal">neuronal</span> path sends code + graph context to an LLM (Gemini) for semantic judgment — slow, probabilistic, intent-aware.
            <span class="px-1.5 py-0.5 rounded text-xs route-hybrid">hybrid</span> functions run both, requiring agreement.
            The combined score reflects what graphs can prove plus what reading the code reveals.
          </p>
        </div>
        <button data-testid="toggle-explainer" class="text-xs text-indigo-600 hover:text-indigo-800 underline ml-4 flex-shrink-0">Hide</button>
      </div>
    </section>

    <!-- ═══ DUAL SCORE COMPARISON ═══ -->
    <section data-testid="dual-score-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Symbolic vs Combined Score</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 text-center">
          <p class="text-xs uppercase tracking-wide text-blue-700 font-semibold">Symbolic AHS</p>
          <p class="text-3xl font-bold text-blue-900 mt-1" data-testid="dual-symbolic-ahs"></p>
          <p class="text-xs text-blue-600 mt-1"><span data-testid="dual-symbolic-count"></span> Cypher checks</p>
        </div>
        <div class="border-2 border-purple-200 bg-purple-50 rounded-lg p-4 text-center" data-testid="dual-combined-card">
          <p class="text-xs uppercase tracking-wide text-purple-700 font-semibold">Combined AHS</p>
          <p class="text-3xl font-bold text-purple-900 mt-1" data-testid="dual-combined-ahs"></p>
          <p class="text-xs text-purple-600 mt-1">+ <span data-testid="dual-neuronal-count"></span> LLM judgments</p>
        </div>
        <div class="border-2 border-gray-200 rounded-lg p-4 text-center" data-testid="dual-delta-card">
          <p class="text-xs uppercase tracking-wide text-gray-600 font-semibold">LLM Adjustment</p>
          <p class="text-3xl font-bold mt-1" data-testid="dual-delta"></p>
          <p class="text-xs text-gray-500 mt-1" data-testid="dual-delta-explainer"></p>
        </div>
      </div>
      <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 hidden" data-testid="no-llm-warning">
        <strong>Symbolic-only mode.</strong> Set <code class="font-mono bg-amber-100 px-1">GEMINI_API_KEY</code> and re-run to enable neuronal evaluation. The combined score will only differ from the symbolic score when neuronal functions have run.
      </div>
      <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-800 hidden" data-testid="llm-error-warning">
        <strong>LLM call failed.</strong> The neuronal evaluations were attempted but the LLM rejected them. Likely causes: API quota exhausted, invalid key, or rate limit. See details below.
        <ul class="mt-2 ml-4 list-disc space-y-1" data-testid="llm-error-list"></ul>
      </div>
    </section>

    <!-- ═══ PIPELINE TRACE ═══ -->
    <section data-testid="pipeline-trace-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Pipeline Trace</h2>
      <div class="flex flex-wrap items-center justify-around gap-2">
        <div class="text-center">
          <p class="text-2xl font-bold text-gray-900" data-testid="trace-apg-nodes"></p>
          <p class="text-xs text-gray-500">APG nodes</p>
          <p class="text-xs text-gray-400" data-testid="trace-apg-edges"></p>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="text-center">
          <p class="text-2xl font-bold text-blue-700" data-testid="trace-symbolic-queries"></p>
          <p class="text-xs text-blue-600">Cypher queries</p>
          <p class="text-xs text-gray-400">symbolic</p>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="text-center">
          <p class="text-2xl font-bold text-purple-700" data-testid="trace-neuronal-calls"></p>
          <p class="text-xs text-purple-600">LLM calls</p>
          <p class="text-xs text-gray-400" data-testid="trace-llm-status"></p>
        </div>
        <span class="pipeline-arrow">→</span>
        <div class="text-center">
          <p class="text-2xl font-bold text-gray-900" data-testid="trace-disabled"></p>
          <p class="text-xs text-gray-500">disabled</p>
          <p class="text-xs text-gray-400">skipped</p>
        </div>
      </div>
    </section>

    <!-- ═══ AHS SCORE ═══ -->
    <section data-testid="ahs-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Architectural Health Score</h2>
      <div class="flex flex-col md:flex-row items-center gap-8">
        <!-- Gauge -->
        <div class="flex-shrink-0 relative" data-testid="ahs-gauge">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="80" fill="none" stroke="#e5e7eb" stroke-width="12" />
            <circle cx="90" cy="90" r="80" fill="none" stroke="#6366f1" stroke-width="12"
              stroke-dasharray="502.65" stroke-dashoffset="502.65"
              stroke-linecap="round" transform="rotate(-90 90 90)"
              class="gauge-ring" data-testid="ahs-gauge-ring" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-3xl font-bold" data-testid="ahs-score-value"></span>
            <span class="text-sm font-medium uppercase" data-testid="ahs-verdict"></span>
          </div>
        </div>
        <!-- Score Details -->
        <div class="flex-1 w-full">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="ahs-scores-detail">
            <div class="text-sm"><span class="text-gray-500">Deterministic:</span> <span class="font-mono font-medium" data-testid="ahs-deterministic"></span></div>
            <div class="text-sm" data-testid="ahs-combined-row"><span class="text-gray-500">Combined:</span> <span class="font-mono font-medium" data-testid="ahs-combined"></span></div>
          </div>
          <!-- Dimension Breakdown -->
          <div class="mt-4 space-y-2" data-testid="dimension-breakdown"></div>
        </div>
      </div>
    </section>

    <!-- ═══ ARCHITECTURE MAP ═══ -->
    <section data-testid="graph-section" class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Architecture Map</h2>
        <div class="flex gap-2 text-xs" data-testid="graph-legend"></div>
      </div>
      <div id="cy" data-testid="cytoscape-container"></div>
      <div class="mt-3 p-3 bg-gray-50 rounded text-sm hidden" data-testid="node-detail-panel">
        <h3 class="font-medium" data-testid="node-detail-title"></h3>
        <p class="text-gray-600 text-xs mt-1" data-testid="node-detail-info"></p>
      </div>
    </section>

    <!-- ═══ FITNESS FUNCTION CARDS — grouped by route ═══ -->
    <section data-testid="fitness-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Fitness Functions</h2>

      <!-- Symbolic group -->
      <div class="mb-6" data-testid="fitness-group-symbolic">
        <h3 class="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-xs route-symbolic">symbolic</span>
          <span class="text-gray-600 font-normal" data-testid="group-symbolic-summary"></span>
        </h3>
        <p class="text-xs text-gray-500 mb-3">Cypher queries against the APG. Deterministic structural checks.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="fitness-grid-symbolic"></div>
      </div>

      <!-- Neuronal group -->
      <div class="mb-6" data-testid="fitness-group-neuronal">
        <h3 class="text-sm font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-xs route-neuronal">neuronal</span>
          <span class="text-gray-600 font-normal" data-testid="group-neuronal-summary"></span>
        </h3>
        <p class="text-xs text-gray-500 mb-3">LLM judgment on semantic intent. Reads code and graph context.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="fitness-grid-neuronal"></div>
      </div>

      <!-- Hybrid group -->
      <div data-testid="fitness-group-hybrid">
        <h3 class="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <span class="px-2 py-0.5 rounded text-xs route-hybrid">hybrid</span>
          <span class="text-gray-600 font-normal" data-testid="group-hybrid-summary"></span>
        </h3>
        <p class="text-xs text-gray-500 mb-3">Symbolic check first, then LLM confirmation. Highest confidence when both agree.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="fitness-grid-hybrid"></div>
      </div>
    </section>

    <!-- ═══ NEURONAL VERDICTS DETAIL ═══ -->
    <section data-testid="neuronal-section" class="bg-white rounded-lg shadow p-6 hidden">
      <h2 class="text-lg font-semibold mb-2">Neuronal Verdicts</h2>
      <p class="text-xs text-gray-500 mb-4">Each neuronal function ran 3 times. ICC measures inter-run agreement (1.0 = identical, &lt; 0.7 = unstable).</p>
      <div class="space-y-3" data-testid="neuronal-verdicts-list"></div>
    </section>

    <!-- ═══ VIOLATIONS EXPLORER ═══ -->
    <section data-testid="violations-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Violations Explorer</h2>
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-4" data-testid="violations-filters">
        <select data-testid="filter-severity" class="text-sm border border-gray-300 rounded px-2 py-1">
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="major">Major</option>
          <option value="minor">Minor</option>
          <option value="advisory">Advisory</option>
        </select>
        <select data-testid="filter-dimension" class="text-sm border border-gray-300 rounded px-2 py-1">
          <option value="">All Dimensions</option>
        </select>
        <select data-testid="filter-baseline" class="text-sm border border-gray-300 rounded px-2 py-1">
          <option value="">All Status</option>
          <option value="new">New Only</option>
          <option value="baseline">Baseline Only</option>
        </select>
        <input type="text" data-testid="filter-search" placeholder="Search file path..."
          class="text-sm border border-gray-300 rounded px-2 py-1 w-48" />
        <span class="text-sm text-gray-500 self-center" data-testid="violations-count"></span>
      </div>
      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="violations-table">
          <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th class="px-3 py-2" data-sort="where">File</th>
              <th class="px-3 py-2" data-sort="functionId">Rule ID</th>
              <th class="px-3 py-2" data-sort="what">Rule</th>
              <th class="px-3 py-2" data-sort="severity">Severity</th>
              <th class="px-3 py-2" data-sort="dimension">Dimension</th>
              <th class="px-3 py-2" data-sort="baselineStatus">Status</th>
              <th class="px-3 py-2">Fix</th>
            </tr>
          </thead>
          <tbody data-testid="violations-tbody" class="divide-y divide-gray-100"></tbody>
        </table>
      </div>
    </section>

    <!-- ═══ BASELINE VS NEW ═══ -->
    <section data-testid="baseline-section" class="bg-white rounded-lg shadow p-6 hidden">
      <h2 class="text-lg font-semibold mb-4">Baseline vs New Violations</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="rounded-lg border border-gray-200 p-4 text-center" data-testid="baseline-inherited">
          <p class="text-3xl font-bold text-gray-400" data-testid="baseline-count"></p>
          <p class="text-sm text-gray-500 mt-1">Baseline (inherited)</p>
        </div>
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-center" data-testid="baseline-new">
          <p class="text-3xl font-bold text-red-600" data-testid="new-count"></p>
          <p class="text-sm text-red-500 mt-1">New (blocks CI)</p>
        </div>
        <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-center" data-testid="baseline-removed">
          <p class="text-3xl font-bold text-green-600" data-testid="removed-count"></p>
          <p class="text-sm text-green-500 mt-1">Removed from baseline</p>
        </div>
      </div>
    </section>

    <!-- ═══ SUMMARY STATS ═══ -->
    <section data-testid="summary-section" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">Summary</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="summary-grid">
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-files"></p>
          <p class="text-xs text-gray-500">Files Analyzed</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-components"></p>
          <p class="text-xs text-gray-500">Components</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-layers"></p>
          <p class="text-xs text-gray-500">Layers</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-compliance"></p>
          <p class="text-xs text-gray-500">Compliance</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-mode"></p>
          <p class="text-xs text-gray-500">Eval Mode</p>
        </div>
        <div class="text-center">
          <p class="text-2xl font-bold" data-testid="summary-duration"></p>
          <p class="text-xs text-gray-500">Duration</p>
        </div>
      </div>
    </section>

  </main>

  <footer class="border-t border-gray-200 mt-8 py-4 text-center text-xs text-gray-400">
    Generated by Architectonic Firewall v1.1
  </footer>

  <!-- ═══ EMBEDDED DATA ═══ -->
  <script>
    const DASHBOARD_DATA = __DASHBOARD_DATA__;
    const GRAPH_DATA = __GRAPH_DATA__;
  </script>

  <!-- ═══ APPLICATION LOGIC ═══ -->
  <script>
  (function() {
    'use strict';

    // ── Helpers ───────────────────────────────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    const setText = (sel, text) => { const el = $(sel); if (el) el.textContent = String(text); };

    // ── Header ───────────────────────────────────────────────────────
    function renderHeader() {
      const h = DASHBOARD_DATA.header;
      setText('[data-testid="header-product-name"]', h.productName);
      setText('[data-testid="header-project-name"]', h.projectName);
      setText('[data-testid="header-timestamp"]', new Date(h.evaluationTimestamp).toLocaleString());
      setText('[data-testid="header-spec-version"]', h.specVersion);
    }

    // ── AHS Score + Gauge ────────────────────────────────────────────
    function renderAHS() {
      const a = DASHBOARD_DATA.ahsScore;
      const score = a.deterministic;
      const pct = (score * 100).toFixed(1);

      setText('[data-testid="ahs-score-value"]', pct + '%');
      const verdictEl = $('[data-testid="ahs-verdict"]');
      if (verdictEl) {
        verdictEl.textContent = a.verdict.replace('-', ' ');
        verdictEl.className = 'text-sm font-medium uppercase verdict-' + a.verdict;
      }

      // Animate gauge ring
      const ring = $('[data-testid="ahs-gauge-ring"]');
      if (ring) {
        const circumference = 2 * Math.PI * 80;
        const offset = circumference * (1 - score);
        // Color based on verdict
        const colors = { pass: '#10b981', warning: '#f59e0b', 'soft-block': '#f97316', 'hard-block': '#ef4444' };
        ring.setAttribute('stroke', colors[a.verdict] || '#6366f1');
        setTimeout(() => { ring.style.strokeDashoffset = String(offset); }, 100);
      }

      setText('[data-testid="ahs-deterministic"]', (a.deterministic * 100).toFixed(2) + '%');
      const combinedRow = $('[data-testid="ahs-combined-row"]');
      if (a.combined != null) {
        setText('[data-testid="ahs-combined"]', (a.combined * 100).toFixed(2) + '%');
      } else if (combinedRow) {
        combinedRow.style.display = 'none';
      }

      // Dimension bars
      const container = $('[data-testid="dimension-breakdown"]');
      if (!container) return;
      container.innerHTML = '';
      for (const d of a.dimensions) {
        const scorePct = (d.score * 100).toFixed(1);
        const barColor = d.score >= 0.8 ? 'bg-green-500' : d.score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
        container.innerHTML += '<div class="flex items-center gap-2">' +
          '<span class="w-24 text-xs text-gray-600 capitalize">' + d.dimension + '</span>' +
          '<div class="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">' +
            '<div class="h-full rounded-full ' + barColor + '" style="width:' + scorePct + '%"></div>' +
          '</div>' +
          '<span class="text-xs font-mono w-12 text-right">' + scorePct + '%</span>' +
          '<span class="text-xs text-gray-400 w-20">' + d.violationCount + ' violations</span>' +
        '</div>';
      }
    }

    // ── Architecture Graph ───────────────────────────────────────────
    function renderGraph() {
      if (typeof cytoscape === 'undefined' || GRAPH_DATA.nodes.length === 0) {
        const container = $('[data-testid="graph-section"]');
        if (container && GRAPH_DATA.nodes.length === 0) {
          $('#cy').innerHTML = '<p class="text-gray-400 text-center py-12">No graph data available</p>';
        }
        return;
      }

      // Legend
      const legend = $('[data-testid="graph-legend"]');
      if (legend) {
        legend.innerHTML = '';
        for (const [layer, color] of Object.entries(GRAPH_DATA.layerColors)) {
          legend.innerHTML += '<span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full" style="background:' +
            color + '"></span>' + layer + '</span>';
        }
      }

      const cy = cytoscape({
        container: $('#cy'),
        elements: [
          ...GRAPH_DATA.nodes,
          ...GRAPH_DATA.edges,
        ],
        layout: {
          name: 'dagre',
          rankDir: 'TB',
          spacingFactor: 1.2,
          nodeSep: 30,
          rankSep: 60,
        },
        style: [
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'background-color': function(ele) {
                var layer = ele.data('layer');
                return GRAPH_DATA.layerColors[layer] || '#94a3b8';
              },
              'color': '#374151',
              'font-size': '8px',
              'text-wrap': 'ellipsis',
              'text-max-width': '80px',
              'width': function(ele) { return 20 + ele.data('violationCount') * 4; },
              'height': function(ele) { return 20 + ele.data('violationCount') * 4; },
              'border-width': function(ele) { return ele.data('violationCount') > 0 ? 2 : 0; },
              'border-color': '#ef4444',
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 1,
              'line-color': function(ele) { return ele.data('isViolation') ? '#ef4444' : '#d1d5db'; },
              'target-arrow-color': function(ele) { return ele.data('isViolation') ? '#ef4444' : '#d1d5db'; },
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.6,
              'opacity': function(ele) { return ele.data('isViolation') ? 1 : 0.4; },
            },
          },
        ],
        minZoom: 0.3,
        maxZoom: 3,
      });

      // Click handler for node details
      cy.on('tap', 'node', function(evt) {
        var node = evt.target;
        var panel = $('[data-testid="node-detail-panel"]');
        if (panel) {
          panel.classList.remove('hidden');
          setText('[data-testid="node-detail-title"]', node.data('label'));
          setText('[data-testid="node-detail-info"]',
            'Layer: ' + node.data('layer') + ' | Path: ' + node.data('filePath') +
            ' | Violations: ' + node.data('violationCount'));
        }
      });

      cy.on('tap', function(evt) {
        if (evt.target === cy) {
          var panel = $('[data-testid="node-detail-panel"]');
          if (panel) panel.classList.add('hidden');
        }
      });
    }

    // ── Fitness Cards (grouped by route) ─────────────────────────────
    function buildCardHtml(ff) {
      var badge = ff.passed
        ? '<span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">PASS</span>'
        : '<span class="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">FAIL</span>';

      var threshold = ff.threshold != null ? '<p class="text-xs text-gray-400 mt-1">Threshold: ' + ff.threshold + '</p>' : '';

      var routeBadge = '<span class="px-1.5 py-0.5 text-xs rounded route-' + ff.route + '">' + ff.route + '</span>';

      var neuronalInfo = '';
      if (ff.neuronalVerdict) {
        var nv = ff.neuronalVerdict;
        var iccColor = nv.icc >= 0.85 ? 'text-green-600' : nv.icc >= 0.7 ? 'text-yellow-600' : 'text-red-600';
        neuronalInfo = '<div class="mt-2 pt-2 border-t border-gray-100 text-xs">' +
          '<p class="text-gray-500">LLM confidence: <span class="font-mono font-medium">' + (nv.confidence * 100).toFixed(0) + '%</span></p>' +
          '<p class="text-gray-500">ICC (3 runs): <span class="font-mono font-medium ' + iccColor + '">' + nv.icc.toFixed(2) + '</span>' +
          (nv.flaggedUnstable ? ' <span class="text-red-600">⚠ unstable</span>' : '') + '</p>' +
        '</div>';
      }

      return '<div class="border rounded-lg p-4 ' + (ff.passed ? 'border-green-200' : 'border-red-200') +
        '" data-testid="fitness-card">' +
        '<div class="flex items-center justify-between mb-2">' +
          '<span class="text-xs font-mono text-gray-400">' + ff.id + '</span>' +
          '<div class="flex gap-1">' + routeBadge + ' ' + badge + '</div>' +
        '</div>' +
        '<h3 class="text-sm font-medium">' + ff.name + '</h3>' +
        '<p class="text-xs text-gray-500 capitalize mt-1">' + ff.dimension + ' | ' + ff.severity + '</p>' +
        threshold +
        (ff.violationCount > 0 ? '<p class="text-xs text-red-500 mt-1">' + ff.violationCount + ' violation(s)</p>' : '') +
        neuronalInfo +
      '</div>';
    }

    function renderFitnessCards() {
      var groups = { symbolic: [], neuronal: [], hybrid: [] };
      for (var i = 0; i < DASHBOARD_DATA.fitnessFunctions.length; i++) {
        var ff = DASHBOARD_DATA.fitnessFunctions[i];
        if (groups[ff.route]) groups[ff.route].push(ff);
      }

      ['symbolic', 'neuronal', 'hybrid'].forEach(function(route) {
        var grid = $('[data-testid="fitness-grid-' + route + '"]');
        var summary = $('[data-testid="group-' + route + '-summary"]');
        var groupSection = $('[data-testid="fitness-group-' + route + '"]');
        var items = groups[route];

        if (items.length === 0) {
          if (groupSection) groupSection.style.display = 'none';
          return;
        }

        var passed = items.filter(function(f) { return f.passed; }).length;
        if (summary) summary.textContent = '— ' + passed + '/' + items.length + ' passed';

        if (grid) {
          grid.innerHTML = '';
          for (var j = 0; j < items.length; j++) {
            grid.innerHTML += buildCardHtml(items[j]);
          }
        }
      });
    }

    // ── Neuronal Verdicts Detail Panel ───────────────────────────────
    function renderNeuronalVerdicts() {
      var withVerdicts = DASHBOARD_DATA.fitnessFunctions.filter(function(f) { return f.neuronalVerdict; });
      var section = $('[data-testid="neuronal-section"]');
      if (!section || withVerdicts.length === 0) return;

      section.classList.remove('hidden');
      var list = $('[data-testid="neuronal-verdicts-list"]');
      if (!list) return;
      list.innerHTML = '';

      for (var i = 0; i < withVerdicts.length; i++) {
        var ff = withVerdicts[i];
        var nv = ff.neuronalVerdict;
        var verdictBg = nv.verdict === 'pass' ? 'bg-green-50 border-green-200' :
                       nv.verdict === 'fail' ? 'bg-red-50 border-red-200' :
                       'bg-yellow-50 border-yellow-200';
        var verdictColor = nv.verdict === 'pass' ? 'text-green-700' :
                          nv.verdict === 'fail' ? 'text-red-700' : 'text-yellow-700';
        var iccColor = nv.icc >= 0.85 ? 'text-green-600' : nv.icc >= 0.7 ? 'text-yellow-600' : 'text-red-600';

        var evidence = '';
        if (nv.evidence && nv.evidence.length > 0) {
          evidence = '<div class="mt-2"><p class="text-xs font-semibold text-gray-600">Evidence:</p><ul class="text-xs text-gray-700 list-disc list-inside ml-2">';
          for (var e = 0; e < nv.evidence.length; e++) {
            evidence += '<li>' + escapeHtml(nv.evidence[e]) + '</li>';
          }
          evidence += '</ul></div>';
        }

        list.innerHTML += '<div class="border rounded-lg p-4 ' + verdictBg + '">' +
          '<div class="flex items-center justify-between mb-2">' +
            '<div>' +
              '<span class="text-xs font-mono text-gray-500">' + escapeHtml(ff.id) + '</span> ' +
              '<span class="font-medium">' + escapeHtml(ff.name) + '</span>' +
              ' <span class="px-1.5 py-0.5 text-xs rounded route-' + ff.route + '">' + ff.route + '</span>' +
            '</div>' +
            '<span class="px-2 py-0.5 text-xs rounded font-semibold uppercase ' + verdictColor + '">' + nv.verdict + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-3 gap-2 text-xs mt-2">' +
            '<div><span class="text-gray-500">Confidence:</span> <span class="font-mono font-medium">' + (nv.confidence * 100).toFixed(0) + '%</span></div>' +
            '<div><span class="text-gray-500">ICC (' + nv.runCount + ' runs):</span> <span class="font-mono font-medium ' + iccColor + '">' + nv.icc.toFixed(3) + '</span></div>' +
            '<div><span class="text-gray-500">Std dev:</span> <span class="font-mono font-medium">±' + nv.confidenceStdDev.toFixed(3) + '</span></div>' +
          '</div>' +
          '<div class="mt-2 pt-2 border-t border-gray-200">' +
            '<p class="text-xs font-semibold text-gray-600">LLM reasoning:</p>' +
            '<p class="text-xs text-gray-700 mt-1 whitespace-pre-wrap">' + escapeHtml(nv.reasoning) + '</p>' +
          '</div>' +
          evidence +
        '</div>';
      }
    }

    // ── Dual Score ──────────────────────────────────────────────────
    function renderDualScore() {
      var d = DASHBOARD_DATA.dualScore;
      var t = DASHBOARD_DATA.pipelineTrace;
      setText('[data-testid="dual-symbolic-ahs"]', (d.symbolicAhs * 100).toFixed(1) + '%');
      setText('[data-testid="dual-symbolic-count"]', d.symbolicCount);

      var combinedCard = $('[data-testid="dual-combined-card"]');
      var deltaCard = $('[data-testid="dual-delta-card"]');
      var warning = $('[data-testid="no-llm-warning"]');
      var errWarning = $('[data-testid="llm-error-warning"]');
      var errList = $('[data-testid="llm-error-list"]');

      // Surface LLM failures (e.g. 429 quota exhausted) prominently
      if (t.llmWarnings && t.llmWarnings.length > 0 && errWarning && errList) {
        errWarning.classList.remove('hidden');
        errList.innerHTML = '';
        for (var w = 0; w < t.llmWarnings.length; w++) {
          var msg = t.llmWarnings[w].message;
          // Truncate very long error messages
          if (msg.length > 250) msg = msg.slice(0, 250) + '...';
          errList.innerHTML += '<li><span class="font-mono text-red-700">' + escapeHtml(t.llmWarnings[w].code) + '</span> — ' + escapeHtml(msg) + '</li>';
        }
      }

      if (d.combinedAhs != null && d.hasNeuronal) {
        setText('[data-testid="dual-combined-ahs"]', (d.combinedAhs * 100).toFixed(1) + '%');
        setText('[data-testid="dual-neuronal-count"]', d.neuronalCount);

        var deltaPct = (d.delta * 100);
        var deltaText = (deltaPct >= 0 ? '+' : '') + deltaPct.toFixed(1) + '%';
        var deltaEl = $('[data-testid="dual-delta"]');
        if (deltaEl) {
          deltaEl.textContent = deltaText;
          deltaEl.className = 'text-3xl font-bold mt-1 ' + (deltaPct > 0 ? 'text-green-600' : deltaPct < 0 ? 'text-red-600' : 'text-gray-600');
        }
        var explainer = deltaPct > 0 ? 'LLM agrees + finds passes Cypher missed' :
                       deltaPct < 0 ? 'LLM finds violations Cypher missed' :
                       'LLM agrees with symbolic verdict';
        setText('[data-testid="dual-delta-explainer"]', explainer);
      } else {
        if (combinedCard) combinedCard.style.opacity = '0.4';
        if (deltaCard) deltaCard.style.opacity = '0.4';
        setText('[data-testid="dual-combined-ahs"]', '—');
        setText('[data-testid="dual-neuronal-count"]', '0');
        setText('[data-testid="dual-delta"]', '—');
        setText('[data-testid="dual-delta-explainer"]', 'No LLM provider');
        if (warning) warning.classList.remove('hidden');
      }
    }

    // ── Pipeline Trace ──────────────────────────────────────────────
    function renderPipelineTrace() {
      var t = DASHBOARD_DATA.pipelineTrace;
      setText('[data-testid="trace-apg-nodes"]', t.apgNodes);
      setText('[data-testid="trace-apg-edges"]', t.apgEdges + ' edges');
      setText('[data-testid="trace-symbolic-queries"]', t.symbolicQueries);
      setText('[data-testid="trace-neuronal-calls"]', t.llmAvailable ? t.neuronalCalls : '0');
      setText('[data-testid="trace-llm-status"]', t.llmAvailable ? (t.llmModel || 'gemini') : 'no LLM');
      setText('[data-testid="trace-disabled"]', t.disabledFunctions);
    }

    // ── Explainer toggle ────────────────────────────────────────────
    function setupExplainerToggle() {
      var btn = $('[data-testid="toggle-explainer"]');
      var section = $('[data-testid="how-it-works-section"]');
      if (!btn || !section) return;
      var p = section.querySelector('p');
      btn.addEventListener('click', function() {
        if (p.style.display === 'none') {
          p.style.display = '';
          btn.textContent = 'Hide';
        } else {
          p.style.display = 'none';
          btn.textContent = 'Show';
        }
      });
    }

    // ── Violations Explorer ──────────────────────────────────────────
    var currentSort = { col: '', dir: 'asc' };
    var filteredViolations = [];

    function getNestedValue(obj, path) {
      return path.split('.').reduce(function(o, k) { return o && o[k]; }, obj);
    }

    function applyFilters() {
      var severity = $('[data-testid="filter-severity"]').value;
      var dimension = $('[data-testid="filter-dimension"]').value;
      var baseline = $('[data-testid="filter-baseline"]').value;
      var search = $('[data-testid="filter-search"]').value.toLowerCase();

      filteredViolations = DASHBOARD_DATA.violations.filter(function(v) {
        if (severity && v.severity !== severity) return false;
        if (dimension && v.dimension !== dimension) return false;
        if (baseline && v.baselineStatus !== baseline) return false;
        if (search && v.where.toLowerCase().indexOf(search) === -1) return false;
        return true;
      });

      if (currentSort.col) {
        filteredViolations.sort(function(a, b) {
          var av = getNestedValue(a, currentSort.col) || '';
          var bv = getNestedValue(b, currentSort.col) || '';
          var cmp = String(av).localeCompare(String(bv));
          return currentSort.dir === 'asc' ? cmp : -cmp;
        });
      }

      renderViolationsTable();
    }

    function renderViolationsTable() {
      var tbody = $('[data-testid="violations-tbody"]');
      if (!tbody) return;
      tbody.innerHTML = '';

      var countEl = $('[data-testid="violations-count"]');
      if (countEl) countEl.textContent = filteredViolations.length + ' of ' + DASHBOARD_DATA.violations.length + ' violations';

      for (var i = 0; i < filteredViolations.length; i++) {
        var v = filteredViolations[i];
        var statusClass = v.baselineStatus === 'baseline' ? 'baseline-tag' : v.baselineStatus === 'new' ? 'new-tag' : '';
        var statusLabel = v.baselineStatus === 'none' ? '-' : v.baselineStatus;

        tbody.innerHTML += '<tr class="hover:bg-gray-50">' +
          '<td class="px-3 py-2 font-mono text-xs max-w-xs truncate" title="' + escapeHtml(v.where) + '">' + escapeHtml(v.where) + '</td>' +
          '<td class="px-3 py-2 font-mono text-xs">' + escapeHtml(String(v.functionId)) + '</td>' +
          '<td class="px-3 py-2 text-xs max-w-xs">' +
            '<p class="font-medium">' + escapeHtml(v.what) + '</p>' +
            '<p class="text-gray-500 mt-0.5">' + escapeHtml(v.why) + '</p>' +
          '</td>' +
          '<td class="px-3 py-2"><span class="px-2 py-0.5 text-xs rounded border severity-' + v.severity + '">' + v.severity + '</span></td>' +
          '<td class="px-3 py-2 text-xs capitalize">' + v.dimension + '</td>' +
          '<td class="px-3 py-2">' + (statusClass ? '<span class="px-2 py-0.5 text-xs rounded ' + statusClass + '">' + statusLabel + '</span>' : statusLabel) + '</td>' +
          '<td class="px-3 py-2 text-xs text-gray-600 max-w-xs">' + escapeHtml(v.fix) + '</td>' +
        '</tr>';
      }
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function setupViolationsFilters() {
      // Populate dimension filter from data
      var dimSelect = $('[data-testid="filter-dimension"]');
      if (dimSelect) {
        var dims = new Set(DASHBOARD_DATA.violations.map(function(v) { return v.dimension; }));
        dims.forEach(function(d) {
          var opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d.charAt(0).toUpperCase() + d.slice(1);
          dimSelect.appendChild(opt);
        });
      }

      // Filter event listeners
      $$('[data-testid="filter-severity"], [data-testid="filter-dimension"], [data-testid="filter-baseline"]')
        .forEach(function(el) { el.addEventListener('change', applyFilters); });
      var searchEl = $('[data-testid="filter-search"]');
      if (searchEl) searchEl.addEventListener('input', applyFilters);

      // Sort headers
      $$('[data-testid="violations-table"] th[data-sort]').forEach(function(th) {
        th.addEventListener('click', function() {
          var col = th.getAttribute('data-sort');
          if (currentSort.col === col) {
            currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            currentSort = { col: col, dir: 'asc' };
          }
          // Update sort indicators
          $$('[data-testid="violations-table"] th').forEach(function(h) {
            h.classList.remove('sort-asc', 'sort-desc');
          });
          th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
          applyFilters();
        });
      });

      // Initial render
      filteredViolations = DASHBOARD_DATA.violations.slice();
      renderViolationsTable();
    }

    // ── Baseline Section ─────────────────────────────────────────────
    function renderBaseline() {
      var b = DASHBOARD_DATA.baseline;
      if (!b) return;

      var section = $('[data-testid="baseline-section"]');
      if (section) section.classList.remove('hidden');

      setText('[data-testid="baseline-count"]', b.baselineCount);
      setText('[data-testid="new-count"]', b.newCount);
      setText('[data-testid="removed-count"]', b.removedCount);
    }

    // ── Summary Stats ────────────────────────────────────────────────
    function renderSummary() {
      var s = DASHBOARD_DATA.summary;
      setText('[data-testid="summary-files"]', s.totalFiles);
      setText('[data-testid="summary-components"]', s.totalComponents);
      setText('[data-testid="summary-layers"]', s.layersDetected);
      setText('[data-testid="summary-compliance"]', s.compliancePercentage + '%');
      setText('[data-testid="summary-mode"]', s.evaluationMode);
      setText('[data-testid="summary-duration"]', (s.durationMs / 1000).toFixed(1) + 's');
    }

    // ── Boot ─────────────────────────────────────────────────────────
    function init() {
      renderHeader();
      setupExplainerToggle();
      renderDualScore();
      renderPipelineTrace();
      renderAHS();
      renderGraph();
      renderFitnessCards();
      renderNeuronalVerdicts();
      setupViolationsFilters();
      renderBaseline();
      renderSummary();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  </script>
</body>
</html>`;
}
