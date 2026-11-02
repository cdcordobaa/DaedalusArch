// id: R-COREIO
// family: H9
// title: domain or application code performs I/O without a port (network, file system, environment, database or cache client, child process)
// rule: The core reaches the outside world only through ports that adapters implement, so it can run and be tested without that world (Cockburn, ports and adapters).
// fix: Declare an out-port for what the core needs (for example a ConfigSource or a ReportStore), call it from the use case, and implement it in an adapter.
// applies: files the spec puts in the domain or application layer (ports included); type-only imports are not reported
// v1.5.8 (2026-11-02, exploratory, rule review #8; the query is unchanged): an import whose every named binding has the inline `type` modifier (`import { type Pool } from 'pg'`) is type-only and not read; `import x = require('…')` of an I/O package is read; more I/O packages are catalogued (postgres, kysely, @supabase/*, fs-extra, ky and others; `ioCategoryOf` in facts.ts)
// facts: CoreFile, CORE_IO, IoAccess
MATCH (c:CoreFile)-[x:CORE_IO]->(i:IoAccess)
RETURN c.file AS file, x.line AS line, c.file AS subject,
       c.role + ' code performs I/O without a port: ' + i.detail AS evidence,
       [] AS path
ORDER BY file, line
