/** Inline CSS of the architect HTML report (no external font or stylesheet). */
export const ARCHITECT_STYLES = `
:root{--bg:#f7f8fa;--fg:#1d2433;--muted:#5b6475;--panel:#fff;--line:#d9dee7;--code:#f1f3f7;
--def:#c62828;--def-bg:#fdecec;--warn:#a15c00;--warn-bg:#fff4e0;--na:#55606e;--na-bg:#eceff3;
--ok:#2e7d32;--ok-bg:#e8f5e9;--edge:#8a94a6;--hit:#fff1b8;--accent:#2952cc}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--fg:#e6e9ef;--muted:#a3abba;--panel:#1b2029;--line:#2e3542;
--code:#151a22;--def:#ff6b6b;--def-bg:#3a1d1f;--warn:#ffb74d;--warn-bg:#3a2c16;--na:#aab3c0;--na-bg:#262c36;
--ok:#81c784;--ok-bg:#1d3320;--edge:#7c879a;--hit:#4a4214;--accent:#8fa8ff}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:16px;overflow-wrap:anywhere}
h1{font-size:1.5rem;margin:.2rem 0}
h2{font-size:1.25rem;margin:0 0 .5rem}
h3{font-size:1.02rem;margin:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;overflow-wrap:anywhere}
.muted{color:var(--muted)}
section{margin:20px 0}
.panel,.verdict-card,.finding,.diagram,.filters{background:var(--panel);border:1px solid var(--line);border-radius:12px}
.verdict-card{padding:16px 18px;border-left:8px solid var(--ok)}
.verdict-fail .verdict-card{border-left-color:var(--def)}
.verdict-word{margin:0;font-weight:800;letter-spacing:.08em;font-size:.9rem;color:var(--ok)}
.verdict-fail .verdict-word{color:var(--def)}
.explain{margin:.5rem 0 0;padding-left:1.2rem}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px;margin-top:14px}
.panel{padding:14px 16px;min-width:0}
.blockers{margin:.4rem 0 0;padding-left:1.1rem}
.blockers li{margin-bottom:.4rem}
.rule-name{font-weight:600;border-bottom:1px dotted var(--muted);cursor:help}
.count{color:var(--def);font-weight:600}
.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:.4rem 0}
.scores div{background:var(--code);border-radius:8px;padding:8px 10px}
.scores dt{font-size:.82rem;color:var(--muted);cursor:help}
.scores dd{margin:0;font-size:1.3rem;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.stat{border-radius:8px;padding:8px 10px;display:flex;flex-direction:column}
.stat-n{font-size:1.3rem;font-weight:700}
.stat-l{font-size:.82rem;cursor:help}
.stat-defining{background:var(--def-bg);color:var(--def)}
.stat-warning{background:var(--warn-bg);color:var(--warn)}
.stat-not-counted{background:var(--na-bg);color:var(--na)}
.diagram{padding:14px 16px}
.diagram-scroll{overflow-x:auto;max-width:100%}
.layer-svg{display:block;width:100%;min-width:560px;height:auto;font-family:inherit}
.layer rect{fill:var(--panel);stroke:var(--line);stroke-width:2}
.layer-warning rect{fill:var(--warn-bg);stroke:var(--warn)}
.layer-defining rect{fill:var(--def-bg);stroke:var(--def)}
.layer-unassigned rect{stroke-dasharray:6 4}
.layer{cursor:pointer}
.layer.selected rect{stroke:var(--accent);stroke-width:4}
.layer-name{font-weight:700;font-size:17px;fill:var(--fg)}
.layer-sub{font-size:13px;fill:var(--muted)}
.internal{font-size:12px;fill:var(--def)}
.edge path{fill:none;stroke:var(--edge);stroke-width:1.6}
.edge text{font-size:12px;fill:var(--muted)}
.edge-forbidden path{stroke-dasharray:5 4}
.edge-warning path{stroke:var(--warn);stroke-width:2.6}
.edge-warning text{fill:var(--warn);font-weight:600}
.edge-defining path{stroke:var(--def);stroke-width:3.4}
.edge-defining text{fill:var(--def);font-weight:700}
.edge-defining,.edge-warning{cursor:pointer}
.edge.selected path{stroke:var(--accent)}
.marker-defining path{fill:var(--def)}
.marker-warning path{fill:var(--warn)}
.marker-ok path{fill:var(--edge)}
.legend{list-style:none;padding:0;margin:.6rem 0;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.88rem;color:var(--muted)}
.sw{display:inline-block;width:26px;height:0;border-top:3px solid var(--edge);vertical-align:middle;margin-right:6px}
.sw-defining{border-top-color:var(--def);border-top-width:4px}
.sw-warning{border-top-color:var(--warn)}
.sw-forbidden{border-top-style:dashed}
.table-wrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{text-align:left;border-bottom:1px solid var(--line);padding:4px 8px}
.filters{padding:12px 14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px;margin-bottom:14px}
.filters label{display:flex;flex-direction:column;font-size:.85rem;color:var(--muted);min-width:0}
.filters select{margin-top:3px;font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:5px;width:100%;max-width:100%;min-width:0}
fieldset.tiers{grid-column:1/-1;border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px 16px;min-width:0}
fieldset.tiers legend{font-size:.85rem;color:var(--muted);padding:0;margin-bottom:3px}
.chk{flex-direction:row!important;align-items:center;gap:6px;color:var(--fg)!important;font-size:.92rem!important}
.filter-status{grid-column:1/-1;margin:0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.filter-status button{font:inherit;border:1px solid var(--line);background:var(--code);color:var(--fg);border-radius:6px;padding:3px 10px;cursor:pointer}
#f-edge{color:var(--accent)}
.finding-list{display:flex;flex-direction:column;gap:12px}
.finding{padding:12px 16px;border-left:6px solid var(--na);min-width:0}
.finding.tier-defining{border-left-color:var(--def)}
.finding.tier-warning{border-left-color:var(--warn)}
.finding header{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;margin-bottom:.3rem}
.finding h3{cursor:help}
.finding p{margin:.3rem 0}
.loc{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82rem;color:var(--muted);overflow-wrap:anywhere;min-width:0}
.tier-badge{font-size:.78rem;font-weight:700;border-radius:999px;padding:1px 10px;background:var(--na-bg);color:var(--na);cursor:help;white-space:nowrap}
.tier-defining .tier-badge{background:var(--def-bg);color:var(--def)}
.tier-warning .tier-badge{background:var(--warn-bg);color:var(--warn)}
.k{font-weight:600}
.path{margin:.3rem 0}
.path ol{list-style:none;margin:.2rem 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.path li{background:var(--code);border-radius:6px;padding:2px 8px;min-width:0;max-width:100%}
.path li+li::before{content:"→ ";color:var(--muted)}
.layer-tag{font-size:.75rem;color:var(--muted);white-space:nowrap}
figure.code{margin:.5rem 0;min-width:0}
figure.code figcaption{font-size:.8rem;color:var(--muted);margin-bottom:2px}
figure.code pre{margin:0;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:6px 0;overflow-x:auto;max-width:100%;font:12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.row{display:block;width:max-content;min-width:100%;padding:0 10px;white-space:pre}
.row.hit{background:var(--hit)}
.ln{display:inline-block;min-width:3ch;text-align:right;margin-right:12px;color:var(--muted);user-select:none}
.fix{background:var(--ok-bg);border-radius:8px;padding:6px 10px}
.empty{color:var(--muted);font-style:italic}
[hidden]{display:none!important}
`;
