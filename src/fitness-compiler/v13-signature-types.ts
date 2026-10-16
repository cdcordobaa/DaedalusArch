/**
 * v1.3 FF-P05 controller-no-entity through type edges (fix batch; construct reason in `Docs/v1.3/ffp05-type-edges.md`).
 *
 * Martin 2017 ch. 22: entities should not cross the boundary as they are; the boundary takes DTOs. A controller's
 * boundary is its public surface, so the construct fact is "a public method of an exported controller class names a
 * domain entity class in its parameter or return type". The frozen template walks IMPORTS | CONSTRUCTOR_INJECTS
 * between Class nodes and so never sees an entity a controller only returns (nestjs v09).
 *
 * When `CompileOptions.signatureTypes` is set (`V13_COMPILE_OPTIONS`), the FF-P05 template text gets a second branch
 * over the APG v2 SIGNATURE_USES edge (the checker-resolved type edge), joined with `UNION` inside `CALL { }` and
 * ordered as before. The frozen template text is not edited, and without the option it compiles unchanged (v1.2E).
 * On a graph without APG v2 edges the branch returns no rows. FF-P05 stays advisory (`Docs/v1.3/rule-tiers.md`).
 *
 * `ffp05SignatureEntity` is the branch's in-memory mirror (same rows), unit-tested on the reference variants.
 */
import type { CypherTemplate } from './types.js';
import type { MemGraph, Row } from './apg2-in-memory.js';

export const FF_P05_TEMPLATE = 'controller-no-entity';

/** The signature branch. Uses only the frozen template's own parameters ($controllerLayer, $domainLayer). */
export const FF_P05_SIGNATURE_BRANCH = `MATCH (ctrl:Class)-[:CONTAINS]->(:Method)-[u:SIGNATURE_USES]->(entity:Class)
WHERE u.publicSurface = true
  AND ctrl.layer = $controllerLayer AND entity.layer = $domainLayer
  AND ctrl.name ENDS WITH 'Controller' /*EXCLUDE:ctrl*/
RETURN ctrl.name AS controller, entity.name AS entity, ctrl.filePath AS filePath`;

const ORDER_BY = '\nORDER BY ';

/**
 * The FF-P05 template with the signature branch; any other template is returned unchanged. Applied to the template
 * text before instantiation, so the exclude markers of both branches are injected alike.
 */
export function applySignatureTypes(template: CypherTemplate): CypherTemplate {
  if (template.functionName !== FF_P05_TEMPLATE) return template;
  const text = template.template;
  const at = text.lastIndexOf(ORDER_BY);
  if (at < 0) throw new Error(`signature types: ${FF_P05_TEMPLATE} no longer ends with an ORDER BY`);
  const body = text.slice(0, at);
  const orderBy = text.slice(at + ORDER_BY.length);
  const combined = `CALL {\n${body}\nUNION\n${FF_P05_SIGNATURE_BRANCH}\n}\nRETURN controller, entity, filePath\nORDER BY ${orderBy}`;
  return { ...template, template: combined };
}

/** Parameters of the mirror, as the compiler binds them (`bindLayerParams`). */
export interface Ffp05SignatureParams {
  readonly controllerLayer?: string;
  readonly domainLayer?: string;
}

/** In-memory mirror of `FF_P05_SIGNATURE_BRANCH`: the rows the branch returns, distinct and in the template's order. */
export function ffp05SignatureEntity(g: MemGraph, p: Ffp05SignatureParams): Row[] {
  if (p.controllerLayer === undefined || p.domainLayer === undefined) return [];
  const ownersOf = new Map<string, string[]>();
  for (const e of g.edgesOf('CONTAINS')) {
    const list = ownersOf.get(e.targetId);
    if (list === undefined) ownersOf.set(e.targetId, [e.sourceId]);
    else list.push(e.sourceId);
  }
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const e of g.edgesOf('SIGNATURE_USES')) {
    if (e.properties.publicSurface !== true) continue;
    const m = g.node(e.sourceId);
    const entity = g.node(e.targetId);
    if (m.type !== 'Method' || entity.type !== 'Class' || g.layer.get(entity.id) !== p.domainLayer) continue;
    for (const ctrlId of ownersOf.get(m.id) ?? []) {
      const ctrl = g.node(ctrlId);
      if (ctrl.type !== 'Class' || g.layer.get(ctrl.id) !== p.controllerLayer || !ctrl.name.endsWith('Controller')) continue;
      const row = { controller: ctrl.name, entity: entity.name, filePath: ctrl.filePath };
      const key = JSON.stringify(row);
      if (!seen.has(key)) { seen.add(key); rows.push(row); }
    }
  }
  const order = (r: Row): string => JSON.stringify([r.filePath, r.controller, r.entity]);
  return rows.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0));
}
