// id: R-MIRROR2
// family: H11
// title: domain, application or port code uses a vendor SDK's own vocabulary (its codes, field names, error names or a renamed copy of its value set)
// rule: The core speaks a language the domain owns; an outbound adapter translates the vendor's codes, fields and errors into it, so a vendor change stays in the adapter (Cockburn, ports and adapters; Evans, anticorruption layer).
// fix: Translate at the adapter into a core term the domain owns: give the value, field or error a domain name (a decline reason, a rate's fixed-at time, a provider outage), map the vendor's code to it in the adapter, and let the core compare only its own terms.
// applies: domain, application and port files; vendor terms are the declaration names, string-literal values, field and method names of the exports of every module an adapter imports through a bare specifier (as R-MIRROR); a vendor term owned by the project is not counted (ownedBy: a single lower-case word or a literal of at most 2 characters, a one-word name, a generic compound, a word of the spec file, or a term of a baseline tree's core; see vendor-lexicon.ts); shapes: literal (a vendor code or declaration name as a string anywhere in the core, comparisons, switch cases, includes/has arguments, unions, enums and constant sets included), error (the same inside a core error, or a vendor error recognised by its name), field (a core field or method named like a vendor field or method, casing aside), field-set (a core type whose >= 3 non-id field names are all fields of one vendor declaration), value-set (a core value set of >= 3 values that the adapters map one-to-one from a vendor value set of the same size, and the core branches on)
// facts: VendorTerm, CoreTerm, ValueMap, Token, TERM_TOKEN, MAPS_FROM, MAPS_TO
CALL {
  MATCH (c:CoreTerm {kind: 'literal'})-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm)
  WHERE v.kind IN ['literal', 'decl'] AND v.ownedBy = ''
  WITH c.file AS file, c.symbol AS symbol, c.text AS term, min(c.line) AS line, collect(DISTINCT c.context) AS contexts,
       collect(DISTINCT v.decl + ' of ' + v.module) AS sources, collect(DISTINCT v.kind) AS kinds, max(CASE WHEN v.isError THEN 1 ELSE 0 END) AS err
  WITH file, line, symbol + " '" + term + "'" AS subject,
       CASE WHEN err = 1 OR 'error' IN contexts THEN 'error' ELSE 'literal' END AS shape,
       symbol + CASE WHEN 'decl' IN kinds THEN " names the vendor declaration '" ELSE " uses the vendor code '" END + term + "' (" + sources[0] + ') in ' + reduce(s = '', x IN contexts | s + CASE WHEN s = '' THEN '' ELSE ', ' END + x) AS detail
  RETURN file, line, subject, shape, detail
  UNION
  MATCH (c:CoreTerm)-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm)
  WHERE ((c.kind = 'field' AND v.kind = 'field') OR (c.kind = 'method' AND v.kind = 'method')) AND v.ownedBy = ''
  WITH c.file AS file, c.symbol AS symbol, c.kind AS kind, min(c.line) AS line, collect(DISTINCT v.decl + '.' + v.text + ' of ' + v.module) AS sources
  RETURN file, line, symbol AS subject, 'field' AS shape,
         symbol + ' is named like the vendor ' + kind + ' ' + sources[0] AS detail
  UNION
  MATCH (c:CoreTerm {kind: 'field'})-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm {kind: 'field'})
  WHERE c.ownerFields >= 3 AND c.text <> 'id'
  WITH c.file AS file, c.owner AS owner, c.ownerFields AS n, v.decl AS decl, v.module AS module, collect(DISTINCT c.text) AS names, min(c.line) AS line
  WHERE size(names) = n
  RETURN file, line, owner AS subject, 'field-set' AS shape,
         owner + ' copies the fields of ' + decl + ' of ' + module + ': ' + reduce(s = '', x IN names | s + CASE WHEN s = '' THEN '' ELSE ', ' END + "'" + x + "'") AS detail
  UNION
  MATCH (m:ValueMap)-[:MAPS_FROM]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm {kind: 'literal'})
  MATCH (m)-[:MAPS_TO]->(:Token)<-[:TERM_TOKEN]-(c:CoreTerm {kind: 'literal'})
  WHERE c.set <> '' AND v.setSize >= 3 AND c.setSize = v.setSize
  WITH v.set AS vset, v.module AS module, v.setSize AS n, c.file AS file, c.set AS cset, min(c.line) AS line,
       collect(DISTINCT v.text) AS vs, collect(DISTINCT c.text) AS cs, collect(DISTINCT v.text + ' -> ' + c.text) AS pairs, collect(DISTINCT m.file + ':' + toString(m.line)) AS maps
  WHERE size(vs) = n AND size(cs) = n AND size(pairs) = n
  MATCH (b:CoreTerm {kind: 'literal'})
  WHERE b.text IN cs AND b.context IN ['compare', 'switch', 'includes']
  WITH file, line, cset, vset, module, pairs, maps, collect(DISTINCT b.file + ':' + toString(b.line)) AS branches
  RETURN file, line, cset AS subject, 'value-set' AS shape,
         cset + ' renames ' + vset + ' of ' + module + ' one to one (' + reduce(s = '', x IN pairs | s + CASE WHEN s = '' THEN '' ELSE ', ' END + x) + '; mapped at ' + maps[0] + ') and the core branches on it at ' + branches[0] AS detail
}
RETURN file, line, subject, '[' + shape + '] ' + file + ':' + toString(line) + ' ' + detail AS evidence, [] AS path
ORDER BY file, line, subject
