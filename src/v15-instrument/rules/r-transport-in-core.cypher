// id: R-TRANSPORT
// family: H7
// title: transport concepts (HTTP status codes, HTTP or SQL error types) in domain, application or port code
// rule: The core speaks in its own terms: domain and application code report domain errors and results, and only an adapter translates them into HTTP statuses or storage errors (Cockburn, ports and adapters).
// fix: Throw or return a domain error (for example SubscriptionNotFound) and map it to an HTTP status in the inbound adapter.
// applies: files the spec puts in the domain or application layer (ports included)
// evidence (v1.5.5, 2026-10-29): only HTTP-transport evidence counts: an HTTP status number (100-599) given to, assigned to or compared with a status-named field or key (`status-code`), an HTTP or SQL error or status type constructed or declared (`transport-type`), or an import of an HTTP-error package or a web framework (`transport-import`). A field merely NAMED like a status (`statusCode`, `httpStatus`; form `status-name`) is not enough: it counts only when its declared type is an HTTP status type (`HttpStatus`, `HttpStatusCode`). So `readonly statusCode: string` holding a vendor or business status is not reported
// facts: CoreFile, USES_TRANSPORT, TransportConcept (form, typeText)
MATCH (c:CoreFile)-[u:USES_TRANSPORT]->(t:TransportConcept)
WHERE t.form <> 'status-name' OR t.typeText =~ '.*Http[A-Za-z]*Status.*'
RETURN c.file AS file, u.line AS line, c.file AS subject,
       c.role + ' code uses a transport concept: ' + t.detail AS evidence,
       [] AS path
ORDER BY file, line
