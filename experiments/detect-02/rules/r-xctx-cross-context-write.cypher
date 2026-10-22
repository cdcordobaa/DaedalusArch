// id: R-XCTX
// family: D4
// title: a command of one bounded context persists an aggregate owned by another context in the same flow
// rule: A context changes only its own aggregates; another context's aggregate changes when that context reacts to a published event, not inside this command (Vernon; Evans, Bounded Context).
// fix: Record a domain event in this context (saved with this aggregate) and let the owning context subscribe to it through its published interface; do not call its write operation from this command.
// applies: contexts and aggregates declared in the spec's DDD block (or src/<context>/ folders)
// facts: Command, CONTEXT_WRITE (eventPath = the command is a domain-event handler), OWNS
MATCH (c:Command {eventHandler: false, delegating: false})-[x:CONTEXT_WRITE]->(r:Root)
MATCH (o:Context)-[:OWNS]->(r)
RETURN c.file AS file, c.line AS line, c.name AS subject,
       'context ' + x.from + ' writes ' + r.name + ' (owned by ' + o.name + ')' + CASE WHEN x.viaPublished THEN ' through its published interface' ELSE '' END AS evidence,
       x.via AS path
ORDER BY file, line
