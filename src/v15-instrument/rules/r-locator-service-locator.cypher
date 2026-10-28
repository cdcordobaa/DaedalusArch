// id: R-LOCATOR
// family: H8
// title: a dependency pulled from a container, registry or static provider outside the composition root
// rule: Dependencies are handed in through the constructor and wired once in the composition root; a class that asks a container or a static accessor for its collaborators hides them and couples itself to the container (Seemann, Service Locator is an anti-pattern).
// fix: Add the port as a constructor parameter typed by the port, and resolve or construct the adapter only in the composition root.
// applies: every file except the composition root; a Map, or a registry looked up by run-time data, is not reported
// facts: CodeFile, LOCATES, Lookup
MATCH (c:CodeFile)-[x:LOCATES]->(l:Lookup)
RETURN c.file AS file, x.line AS line, c.file AS subject,
       c.role + ' code obtains a dependency at run time: ' + l.detail AS evidence,
       [] AS path
ORDER BY file, line
