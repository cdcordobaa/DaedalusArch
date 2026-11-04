// id: R-APPVENDOR
// family: H1
// title: application code imports the vendor package an adapter wraps
// rule: The application layer (use cases and ports) speaks in its own terms and reaches a vendor only through a port that an adapter implements; it never imports the vendor's package itself, not even for a type (Cockburn, ports and adapters).
// fix: Remove the vendor import from the application file. Put what the application needs from the vendor behind a port in the application's own terms, implement it in the adapter that already wraps the package, and let the composition root wire it.
// applies: files the spec puts in an application or port layer that name, in any module edge (an import declaration, type-only or with inline `type`, an `export … from`, `import x = require(…)`, a dynamic `import('…')`, an `import('…').X` type), a package that an adapter file of the same tree imports; relative, `node:` and own-code (`paths` into the tree) specifiers are no packages
// status (v1.5.11, 2026-11-04): exploratory, not admitted, on no row and not delivered; found by the HCAL-08 hand read (glacier EDGE-pos2 and EDGE-pos4, luthier EDGE-pos2, orchard EDGE-pos1 and EDGE-pos2: no rule read an application-layer dependency on the vendor package)
// identity: the subject names the importing file and the package, and the evidence the form, so two forms in one file are two findings
// facts: CoreFile, VendorPackage, APP_IMPORTS_VENDOR (form)
MATCH (a:CoreFile)-[x:APP_IMPORTS_VENDOR]->(v:VendorPackage)
RETURN a.file AS file, x.line AS line, a.file + ' -> ' + v.name AS subject,
       a.file + ' (' + a.role + ') imports ' + v.name + ' (' + x.form + '), the package the adapter ' + v.adapter + ' wraps' AS evidence,
       [] AS path
ORDER BY file, line
