// id: R-D9
// family: D9
// title: a published contract is, or wraps, a domain entity (or the domain builds the contract's shape)
// rule: The published language of a context is its own types; it never carries an entity or aggregate, and the domain model does not shape itself after a contract (Evans: published language; Fowler: each context has its own model).
// fix: Declare a contract type with only the fields consumers need and map the entity to it in the application layer (or the published module); do not return or re-export the entity.
// applies: published places (public_api globs, contracts/, a context index.ts, inbound ports)
// facts: ContractType, CONTRACT_EXPOSES (form: type | mirror), EntityType
MATCH (c:ContractType)-[x:CONTRACT_EXPOSES]->(e:EntityType)
RETURN c.file AS file, c.line AS line, c.name AS subject,
       CASE WHEN x.form = 'mirror' THEN x.via ELSE c.name + ' exposes ' + e.name + ' (' + e.file + ') via ' + x.via END AS evidence,
       [] AS path
ORDER BY file, line
