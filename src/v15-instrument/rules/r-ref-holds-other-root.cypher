// id: R-REF
// family: D4
// title: an aggregate holds another aggregate's object instead of its identity
// rule: An aggregate refers to another aggregate by its identity only, so each stays its own consistency boundary and can be loaded and saved alone (Vernon: reference other aggregates by identity).
// fix: Replace the field with the other aggregate's id (or a value object of it), and load the other aggregate through its repository when it is needed.
// applies: aggregate roots declared (or inferred)
// facts: Root, REFERENCES_ROOT (member)
MATCH (a:Root)-[x:REFERENCES_ROOT]->(b:Root)
RETURN x.file AS file, x.line AS line, a.name + '.' + x.member AS subject,
       a.name + '.' + x.member + ' holds a ' + b.name + ' object; it should hold its id' AS evidence,
       [] AS path
ORDER BY file, line
