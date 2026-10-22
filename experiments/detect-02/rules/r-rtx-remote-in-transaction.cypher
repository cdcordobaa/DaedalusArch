// id: R-RTX
// family: RTX
// title: a remote or vendor call runs inside a transaction or lock scope
// rule: A transaction or lock covers local state only; remote calls (payment, HTTP, vendor SDK) run before or after it, so a slow or failing remote never holds the lock (Nygard, Release It!: integration points).
// fix: Call the remote service outside the scoped callback (before it, or after commit through an event/outbox), and pass only its result into the transaction.
// applies: every style
// facts: Unit, REMOTE_IN_TX (scope, via), IOSite
MATCH (u:Unit)-[x:REMOTE_IN_TX]->(s:IOSite)
RETURN u.file AS file, x.line AS line, u.name AS subject,
       'inside ' + x.scope + '(...) reaches ' + s.module + ' at ' + s.file + ':' + toString(toInteger(s.line)) AS evidence, x.via AS path
ORDER BY file, line
