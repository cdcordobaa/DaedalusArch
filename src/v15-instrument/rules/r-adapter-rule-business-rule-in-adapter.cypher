// id: R-ADAPTER-RULE
// family: H6
// title: an adapter decides a business rule on domain state (rejects, prices or changes something)
// rule: Adapters translate between a technology and the core; a decision that accepts, rejects, prices or changes domain state belongs to the domain or a use case, where it is tested and reused without the adapter (Cockburn, ports and adapters).
// fix: Move the decision into the entity, a domain service or the use case, and let the adapter translate its outcome (a domain error into an HTTP status, a domain value into the vendor's call).
// applies: adapter files (inbound and outbound); transport validation (type, presence, parse and format checks), identity and version checks, and error translation in a catch clause are not reported
// facts: AdapterUnit, ADAPTER_DECIDES, Decision
MATCH (u:AdapterUnit)-[x:ADAPTER_DECIDES]->(d:Decision)
RETURN u.file AS file, x.line AS line, u.name AS subject,
       u.name + ' decides on domain state (' + d.reads + ') and ' + d.effect AS evidence,
       [] AS path
ORDER BY file, line
