// id: R-ADAPTER-RULE
// family: H6
// title: an adapter decides a business rule on domain state (rejects, prices or changes something)
// rule: Adapters translate between a technology and the core; a decision that accepts, rejects, prices or changes domain state belongs to the domain or a use case, where it is tested and reused without the adapter (Cockburn, ports and adapters).
// fix: Move the decision into the entity, a domain service or the use case, and let the adapter translate its outcome (a domain error into an HTTP status, a domain value into the vendor's call).
// applies: adapter files (inbound and outbound); transport validation (type, presence, parse and format checks), identity and version checks, and error translation in a catch clause are not reported
// facts: AdapterUnit, ADAPTER_DECIDES, Decision
// v1.5.7 (2026-11-02): the Decision fact also reads plain request and port data shaped like a business rule: a threshold (a numeric value against a non-trivial constant; size, status, retry, paging and timing mechanisms aside), a calendar rule (a Date's day, hour, month or date against a constant), and the same one level down (a local const the condition names, an in-tree adapter helper it calls); nullable reads drop null and undefined; a numeric ternary arm is a price; a code literal chosen by an equality alone is a mapping, not a decision. Development fit on HCAL-01..04 H06 (experiments/h06-adapter-rule-dev/README.md); not admitted, needs a new sealed set.
MATCH (u:AdapterUnit)-[x:ADAPTER_DECIDES]->(d:Decision)
RETURN u.file AS file, x.line AS line, u.name AS subject,
       u.name + ' decides on domain state (' + d.reads + ') and ' + d.effect AS evidence,
       [] AS path
ORDER BY file, line
