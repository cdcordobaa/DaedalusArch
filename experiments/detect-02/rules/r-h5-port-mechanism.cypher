// id: R-H5
// family: H5
// title: a port signature carries an infrastructure type or mechanism
// rule: A port states what the application needs in its own terms; vendor types, adapter types and locking or transaction mechanisms stay inside the adapter (Cockburn, Ports and Adapters).
// fix: Express the need as an application-level operation (e.g. `reserve(roomId, dates)`) and keep the lock, transaction or vendor type inside the adapter that implements the port.
// applies: ports (application/ports, or domain interfaces implemented by an adapter)
// facts: PortMethod, PORT_MECHANISM (form: vendor-type | adapter-type | scope-callback)
MATCH (p:PortMethod)-[m:PORT_MECHANISM]->(:Mechanism)
RETURN p.file AS file, p.line AS line, p.name AS subject, m.form + ': ' + m.detail AS evidence, [] AS path
ORDER BY file, line, evidence
