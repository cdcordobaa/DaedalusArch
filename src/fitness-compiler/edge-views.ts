/**
 * v1.3 edge views (ADR-V13-01). With `reExportEdges: 'both'` the extractor records two IMPORTS edges for an import of
 * a name through a re-export file (a barrel): the LITERAL edge to the file the specifier resolves to, and the RESOLVED
 * edge to the declaring file (`viaReExport: true`). A literal edge that only exists because of the barrel carries
 * `reExportHop: true`. Each template reads one view:
 * - `literal`: IMPORTS edges without `viaReExport`, plus RE_EXPORTS (the module graph tsc and dependency-cruiser see);
 * - `resolved`: IMPORTS edges without `reExportHop`, plus RE_EXPORTS (the v1.2E graph: one edge per declaring file);
 * - `none`: the template reads no IMPORTS edge, so the view does not apply.
 *
 * The frozen template text is not edited: `applyEdgeView` rewrites the compiled Cypher of one template, selected by
 * its name, when `CompileOptions.edgeViews` is on. On a graph without these properties (a v1.2E graph) the added
 * predicates are always true, so the rows do not change. The table and its reasons are `Docs/v1.3/edge-views.md`.
 */

export type EdgeView = 'literal' | 'resolved' | 'none';

export interface EdgeViewEntry {
  readonly view: EdgeView;
  readonly reason: string;
}

const LAYER_DIRECTION = 'layer-direction rule: the module an import statement depends on is what crosses the layer boundary';
const METRIC = 'coupling metric over module dependencies: counts the import statements\' real targets, as tsc and dependency-cruiser do';

/** Every v1.3-active template that reads IMPORTS edges, plus the edge-free ones (view `none`), by template name. */
export const TEMPLATE_EDGE_VIEWS: ReadonlyMap<string, EdgeViewEntry> = new Map<string, EdgeViewEntry>([
  // ── CYPHER_TEMPLATES (frozen v1.2E catalogue, also evaluated under v1.3) ──
  ['dependency-direction', { view: 'literal', reason: LAYER_DIRECTION }],
  ['no-cyclic-deps', { view: 'literal', reason: 'cycle rule: a cycle is between modules as imported; barrel-induced cycles are findings (ADR-V13-01)' }],
  ['no-layer-skip', { view: 'literal', reason: 'layer-skip rule: importing a non-adjacent layer\'s barrel is the skip, wherever the name is declared' }],
  ['no-domain-outward-dep', { view: 'literal', reason: LAYER_DIRECTION }],
  ['domain-purity', { view: 'resolved', reason: 'domain purity by symbol: the forbidden package a name comes from counts even when a barrel re-exports it' }],
  ['domain-state-purity', { view: 'none', reason: 'reads FLOWS_TO and CONSTRUCTOR_INJECTS only' }],
  ['dependency-inversion', { view: 'none', reason: 'reads CONSTRUCTOR_INJECTS only' }],
  ['repository-pattern', { view: 'none', reason: 'reads IMPLEMENTS only' }],
  ['use-case-isolation', { view: 'none', reason: 'reads CONSTRUCTOR_INJECTS only' }],
  ['controller-no-entity', { view: 'resolved', reason: 'usage rule: a controller uses the entity it names, through a barrel or not' }],
  ['domain-stability', { view: 'literal', reason: METRIC }],
  ['module-fan-out', { view: 'literal', reason: METRIC }],
  ['component-instability', { view: 'literal', reason: METRIC }],
  ['no-orphan-files', { view: 'literal', reason: 'connectivity of modules as imported: in the resolved view a barrel imported only by name looks unused' }],
  ['max-fan-in', { view: 'literal', reason: METRIC }],
  ['abstraction-ratio', { view: 'none', reason: 'reads no edge' }],
  ['single-responsibility-proxy', { view: 'none', reason: 'reads CONTAINS and CONSTRUCTOR_INJECTS only' }],
  ['interface-segregation-proxy', { view: 'none', reason: 'reads CONTAINS only' }],
  ['inheritance-depth', { view: 'none', reason: 'reads EXTENDS only' }],
  ['naming-conventions', { view: 'none', reason: 'reads no edge' }],
  ['naming-services', { view: 'none', reason: 'reads no edge' }],
  ['naming-repos', { view: 'none', reason: 'reads no edge' }],
  ['naming-controllers', { view: 'none', reason: 'reads no edge' }],
  ['test-file-pairing', { view: 'none', reason: 'reads no import edge (file names only)' }],
  ['no-index-logic', { view: 'none', reason: 'reads DECLARES only' }],
  // ── HEXAGONAL_TEMPLATES (v1.3) ──
  ['dependency-direction-graph', { view: 'literal', reason: LAYER_DIRECTION }],
  ['layer-skip-graph', { view: 'literal', reason: 'layer rule (no allowed edge either way): the imported module\'s layer is the sideways step' }],
  ['core-isolation', { view: 'literal', reason: LAYER_DIRECTION }],
  ['port-adapter-pattern', { view: 'none', reason: 'reads IMPLEMENTS only' }],
  ['port-dependency-inversion', { view: 'none', reason: 'reads CONSTRUCTOR_INJECTS only' }],
  // ── V13_CYPHER_TEMPLATES (module wiring) ──
  ['module-domain-imports-infrastructure', { view: 'none', reason: 'reads MODULE_IMPORTS only (not IMPORTS)' }],
  // ── DDD templates (PR #83, U-C1; not yet on v1.3; entries ready for the merge) ──
  ['bounded-context-modules', { view: 'none', reason: 'reads no import edge (file placement only)' }],
  ['context-isolation', { view: 'literal', reason: 'context-isolation / public-API rule: whether the import goes through the published barrel is the question (closes M2 once the template reads the literal edge)' }],
  ['aggregate-boundary', { view: 'resolved', reason: 'usage rule: reaching an aggregate\'s inner entity is about the symbol used, through a barrel or not' }],
  ['repository-aggregate-root', { view: 'resolved', reason: 'usage rule: which entity a repository stores is the symbol it imports, wherever re-exported' }],
  ['value-object-immutability', { view: 'none', reason: 'reads CONTAINS only' }],
  ['domain-event-placement', { view: 'none', reason: 'reads IMPLEMENTS and EXTENDS only' }],
  ['application-service-thin', { view: 'none', reason: 'reads CONTAINS only' }],
]);

/**
 * v1.4 U2: the views of the post-seal templates (`post-seal-rules.ts`, ADR-V14-02). Kept apart from
 * `TEMPLATE_EDGE_VIEWS`, whose 38 entries are a registered v1.3 figure (`Docs/v1.3/edge-views.md`); `edgeViewOf` and
 * `applyEdgeView` read both.
 */
export const POST_SEAL_EDGE_VIEWS: ReadonlyMap<string, EdgeViewEntry> = new Map<string, EdgeViewEntry>([
  ['application-purity', { view: 'resolved', reason: 'usage rule by symbol, as domain-purity: the delivery-framework package a name comes from counts even when a barrel re-exports it' }],
]);

const VIEW_PREDICATE: Readonly<Record<Exclude<EdgeView, 'none'>, (rel: string) => string>> = {
  literal: (rel) => `NOT coalesce(${rel}.viaReExport, false)`,
  resolved: (rel) => `NOT coalesce(${rel}.reExportHop, false)`,
};

/** A relationship pattern `[name?:TYPES(*range)?]` whose type list holds IMPORTS (not MODULE_IMPORTS). */
const REL_PATTERN = /\[([A-Za-z_][A-Za-z0-9_]*)?:([A-Z_]+(?:\|[A-Z_]+)*)(\*[0-9.]*)?\]/g;

function readsImports(types: string): boolean {
  return types.split('|').includes('IMPORTS');
}

/** The view a template reads under v1.3; `undefined` for a name outside the table. */
export function edgeViewOf(templateName: string): EdgeView | undefined {
  return (TEMPLATE_EDGE_VIEWS.get(templateName) ?? POST_SEAL_EDGE_VIEWS.get(templateName))?.view;
}

/** True when the Cypher text has a relationship pattern over IMPORTS. */
export function cypherReadsImports(cypher: string): boolean {
  for (const m of cypher.matchAll(REL_PATTERN)) if (readsImports(m[2] ?? '')) return true;
  return false;
}

/**
 * Rewrites one compiled query to read its template's view: every fixed-length relationship pattern over IMPORTS gets
 * an inline `WHERE` with the view predicate (an unnamed one is named `_evN`); a variable-length one is bound to a
 * list and the next `WHERE` clause gets `ALL(... ) AND` in front. A template outside the table, or with view `none`,
 * is returned unchanged.
 */
export function applyEdgeView(templateName: string, cypher: string): string {
  const view = edgeViewOf(templateName);
  if (view === undefined || view === 'none') return cypher;
  const predicate = VIEW_PREDICATE[view];
  let counter = 0;
  let out = '';
  let last = 0;
  const pendingAll: string[] = [];
  for (const m of cypher.matchAll(REL_PATTERN)) {
    const [whole, name, types = '', range] = m;
    const index = m.index;
    if (!readsImports(types)) continue;
    if (index < last) throw new Error(`edge view: an IMPORTS pattern inside a rewritten WHERE prefix in ${templateName}`);
    const rel = name ?? `_ev${String(counter++)}`;
    out += cypher.slice(last, index);
    if (range === undefined) {
      out += `[${rel}:${types} WHERE ${predicate(rel)}]`;
    } else {
      out += `[${rel}:${types}${range}]`;
      pendingAll.push(rel);
    }
    last = index + whole.length;
    if (pendingAll.length > 0) {
      // Insert the list predicate at the first WHERE after this pattern.
      const rest = cypher.slice(last);
      const where = /\bWHERE\s/.exec(rest);
      if (where === null) throw new Error(`edge view: no WHERE after the variable-length IMPORTS pattern in ${templateName}`);
      const at = last + where.index + where[0].length;
      const list = pendingAll.splice(0).map((r) => `ALL(_evr IN ${r} WHERE ${predicate('_evr')}) AND `).join('');
      out += cypher.slice(last, at) + list;
      last = at;
    }
  }
  return out + cypher.slice(last);
}
