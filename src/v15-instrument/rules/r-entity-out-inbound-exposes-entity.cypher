// id: R-ENTITY-OUT
// family: H10
// title: an inbound adapter uses a domain entity as its transport shape (response body or request type)
// rule: An inbound adapter translates between the outside world and the core: it reads and writes its own DTOs, so the domain model can change without changing the API (Cockburn, ports and adapters; Evans, published language).
// fix: Define a request or response DTO in the adapter and map the entity to it (or from it) in the handler.
// applies: inbound adapter files (adapters/in, api, controllers); private helpers and mappers are not reported
// facts: InboundHandler, ENTITY_OUT, EntityType
MATCH (h:InboundHandler)-[x:ENTITY_OUT]->(e:EntityType)
RETURN h.file AS file, x.line AS line, h.name AS subject,
       h.name + ' ' + x.form + ' the domain entity ' + e.name AS evidence,
       [] AS path
ORDER BY file, line
