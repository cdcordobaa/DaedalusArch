// id: R-PURE
// family: D2
// title: domain code imports an I/O technology (database, HTTP client, mail, file system, messaging, web framework)
// rule: The domain model depends on nothing technical: it holds state and rules, and reaches the outside world only through ports that adapters implement (Evans: isolate the domain; Cockburn: dependencies point inward).
// fix: Declare a port for what the domain needs (for example a Geocoder), call it from the application service, and implement it in an adapter with the package.
// applies: files the spec puts in the domain layer, and files inside a declared aggregate module; type-only imports are not reported
// facts: DomainFile, DOMAIN_IMPORTS_TECH, TechModule
MATCH (d:DomainFile)-[x:DOMAIN_IMPORTS_TECH]->(t:TechModule)
RETURN d.file AS file, x.line AS line, d.file AS subject,
       'domain code imports ' + t.module + ' (' + t.category + ')' AS evidence,
       [] AS path
ORDER BY file, line
