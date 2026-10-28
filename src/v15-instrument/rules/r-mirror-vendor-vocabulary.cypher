// id: R-MIRROR
// family: H11
// title: domain, application or port code re-declares a vendor SDK's vocabulary (its codes or its field names)
// rule: The core speaks its own language; an outbound adapter translates the vendor's codes and fields into it, so a vendor change stays in the adapter (Cockburn, ports and adapters; Evans, anticorruption layer).
// fix: Name the values in the domain's own terms (a decline reason, a match quality) and map the vendor's codes to them in the adapter.
// applies: domain, application and port files; vendor types are the exports of the external packages the tree's adapters import; a value set may add one generic catch-all (other, unknown, none, default, unspecified) to at least 2 vendor values: a vendor code set plus one catch-all is still the vendor's vocabulary
// facts: CoreType, MIRRORS_VENDOR, VendorType
MATCH (c:CoreType)-[x:MIRRORS_VENDOR]->(v:VendorType)
RETURN c.file AS file, x.line AS line, c.name AS subject,
       c.role + ' type ' + c.name + ' mirrors ' + v.name + ' of ' + v.module + ': ' + x.detail AS evidence,
       [] AS path
ORDER BY file, line
