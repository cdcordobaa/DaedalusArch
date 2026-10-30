// id: R-MIRROR2
// family: H11
// title: domain, application or port code uses a vendor SDK's own vocabulary (its codes, field names, error names or a copy of its field set)
// rule: The core speaks a language the domain owns; an outbound adapter translates the vendor's codes, fields and errors into it, so a vendor change stays in the adapter (Cockburn, ports and adapters; Evans, anticorruption layer).
// fix: Translate at the adapter into a core term the domain owns: give the value, field or error a domain name (a decline reason, a rate's fixed-at time, a provider outage), map the vendor's code to it in the adapter, and let the core compare only its own terms.
// applies: domain, application and port files; vendor terms are the declaration names, string-literal values, field and method names of the exports of every module an adapter imports through a bare specifier (as R-MIRROR); a vendor term owned by the project is not counted (ownedBy: a single lower-case word or a literal of at most 2 characters, a one-word name, a generic compound, a word of the spec file, or a term of a baseline tree's core; see vendor-lexicon.ts); shapes: literal (a vendor code or declaration name as a string anywhere in the core, comparisons, switch cases, includes/has arguments, unions, enums and constant sets included), error (the same inside a core error, or a vendor error recognised by its name), field (a core field or method named exactly like a vendor field or method: a casing change such as treatment_code -> treatmentCode is a translation and is not counted), field-set (a core type whose >= 3 non-id field names are all fields of one vendor declaration, casing aside). Not detected: a vendor value set renamed one to one into core words (the WIP value-set shape fired on the clean HCAL-05 dental-lab base, where that rename is the adapter's translation, and was dropped)
// v1.5.5 (2026-10-29, HX-RULES-V3): three more readings. key: an identifier key of a core object literal (`{ R70: '…' }`, context `key`) is a core literal like a quoted key; it counts against a vendor code (a literal value), not a vendor declaration name. decl: a core class, interface, type alias or enum named like a vendor declaration (case and separators aside, a trailing Error or Exception word aside: `class AdjudicationFault extends DomainError` for the vendor's `AdjudicationFault`), shape `error` when either is an error class, else `decl`; a one-word name (`Claim`), a name the spec states, or a name the baseline's core already declares is not counted (`declOwnedBy`). field-list: a core array literal or tuple type whose >= 3 non-id string elements are all field names of one vendor declaration, spelled exactly as the vendor spells them (`['claim_ref', 'claim_status', 'patient_pay_amount'] as const`), with at least one of them the vendor's own term (not generic, spec or baseline)
// facts: VendorTerm, CoreTerm, Token, TERM_TOKEN, DECL_TOKEN
CALL {
  MATCH (c:CoreTerm {kind: 'literal'})-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm)
  WHERE v.kind IN ['literal', 'decl'] AND v.ownedBy = '' AND (c.context <> 'key' OR v.kind = 'literal')
  WITH c.file AS file, c.symbol AS symbol, c.text AS term, min(c.line) AS line, collect(DISTINCT c.context) AS contexts,
       collect(DISTINCT v.decl + ' of ' + v.module) AS sources, collect(DISTINCT v.kind) AS kinds, max(CASE WHEN v.isError THEN 1 ELSE 0 END) AS err
  WITH file, line, symbol + " '" + term + "'" AS subject,
       CASE WHEN err = 1 OR 'error' IN contexts THEN 'error' ELSE 'literal' END AS shape,
       symbol + CASE WHEN 'decl' IN kinds THEN " names the vendor declaration '" ELSE " uses the vendor code '" END + term + "' (" + sources[0] + ') in ' + reduce(s = '', x IN contexts | s + CASE WHEN s = '' THEN '' ELSE ', ' END + x) AS detail
  RETURN file, toInteger(line) AS line, subject, shape, detail
  UNION
  MATCH (c:CoreTerm)-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm)
  WHERE ((c.kind = 'field' AND v.kind = 'field') OR (c.kind = 'method' AND v.kind = 'method')) AND v.ownedBy = '' AND c.text = v.text
  WITH c.file AS file, c.symbol AS symbol, c.kind AS kind, min(c.line) AS line, collect(DISTINCT v.decl + '.' + v.text + ' of ' + v.module) AS sources
  RETURN file, toInteger(line) AS line, symbol AS subject, 'field' AS shape,
         symbol + ' is named like the vendor ' + kind + ' ' + sources[0] AS detail
  UNION
  MATCH (c:CoreTerm {kind: 'field'})-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm {kind: 'field'})
  WHERE c.ownerFields >= 3 AND c.text <> 'id'
  WITH c.file AS file, c.owner AS owner, c.ownerFields AS n, v.decl AS decl, v.module AS module, collect(DISTINCT c.text) AS names, min(c.line) AS line
  WHERE size(names) = n
  RETURN file, toInteger(line) AS line, owner AS subject, 'field-set' AS shape,
         owner + ' copies the fields of ' + decl + ' of ' + module + ': ' + reduce(s = '', x IN names | s + CASE WHEN s = '' THEN '' ELSE ', ' END + "'" + x + "'") AS detail
  UNION
  MATCH (c:CoreTerm {kind: 'decl'})-[:DECL_TOKEN]->(:Token)<-[:DECL_TOKEN]-(v:VendorTerm {kind: 'decl'})
  WHERE v.declOwnedBy = ''
  WITH c.file AS file, c.text AS name, min(c.line) AS line, collect(DISTINCT v.decl) AS decls, collect(DISTINCT v.decl + ' of ' + v.module) AS sources, max(CASE WHEN v.isError OR c.text =~ '.*(Error|Exception|Fault)$' THEN 1 ELSE 0 END) AS err
  RETURN file, toInteger(line) AS line, name AS subject, CASE WHEN err = 1 THEN 'error' ELSE 'decl' END AS shape,
         name + " copies the vendor declaration name '" + decls[0] + "' (" + sources[0] + ')' AS detail
  UNION
  MATCH (c:CoreTerm {kind: 'listed'})-[:TERM_TOKEN]->(:Token)<-[:TERM_TOKEN]-(v:VendorTerm {kind: 'field'})
  WHERE c.ownerFields >= 3 AND c.text <> 'id' AND c.text = v.text
  WITH c.file AS file, c.set AS list, c.owner AS owner, c.ownerFields AS n, v.decl AS decl, v.module AS module, collect(DISTINCT c.text) AS names, min(c.line) AS line, max(CASE WHEN v.ownedBy = '' THEN 1 ELSE 0 END) AS own
  WHERE size(names) = n AND own = 1
  RETURN file, toInteger(line) AS line, owner AS subject, 'field-list' AS shape,
         owner + ' lists the fields of ' + decl + ' of ' + module + ': ' + reduce(s = '', x IN names | s + CASE WHEN s = '' THEN '' ELSE ', ' END + "'" + x + "'") AS detail
}
RETURN file, line, subject, '[' + shape + '] ' + file + ':' + toString(toInteger(line)) + ' ' + detail AS evidence, [] AS path
ORDER BY file, line, subject
