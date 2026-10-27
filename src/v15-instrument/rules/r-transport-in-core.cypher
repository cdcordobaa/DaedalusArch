// id: R-TRANSPORT
// family: H7
// title: transport concepts (HTTP status codes, HTTP or SQL error types) in domain, application or port code
// rule: The core speaks in its own terms: domain and application code report domain errors and results, and only an adapter translates them into HTTP statuses or storage errors (Cockburn, ports and adapters).
// fix: Throw or return a domain error (for example SubscriptionNotFound) and map it to an HTTP status in the inbound adapter.
// applies: files the spec puts in the domain or application layer (ports included)
// facts: CoreFile, USES_TRANSPORT
MATCH (c:CoreFile)-[u:USES_TRANSPORT]->(t:TransportConcept)
RETURN c.file AS file, u.line AS line, c.file AS subject,
       c.role + ' code uses a transport concept: ' + t.detail AS evidence,
       [] AS path
ORDER BY file, line
