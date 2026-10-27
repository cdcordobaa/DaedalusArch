// id: R-D3
// family: D5
// title: a domain value is computed outside the aggregate from its state and handed back to it
// rule: A calculation over an aggregate's state that sets its state belongs to the aggregate (a method or a value object), so the rule has one home (Evans: put the behaviour where the data is; anaemic domain model).
// fix: Move the calculation into an aggregate method (or a value object) that takes the inputs and sets the result itself; let the service call that method.
// applies: aggregate roots declared (or inferred); application code only
// facts: Unit, CALC_OUTSIDE (expression, root)
MATCH (u:Unit)-[c:CALC_OUTSIDE]->(r:Root)
RETURN c.file AS file, c.line AS line, u.name AS subject,
       'computes ' + c.expr + ' from the state of ' + r.name + ' and hands it back to it' AS evidence,
       [] AS path
ORDER BY file, line
