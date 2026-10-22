// id: R-INJ
// family: H4
// title: an application class depends on a concrete adapter class instead of a port
// rule: The application depends on ports; only the composition root knows the adapter classes (Cockburn; dependency inversion).
// fix: Type the dependency with the port interface the adapter implements (add one if missing) and construct the adapter in the composition root.
// applies: hexagonal and DDD styles (Layered services may depend on concrete persistence)
// facts: AppClass, CONCRETE_INJECTION (form: constructor | property | new), AdapterClass
MATCH (a:AppClass)-[i:CONCRETE_INJECTION]->(b:AdapterClass)
RETURN a.file AS file, i.line AS line, a.name AS subject, a.name + ' depends on ' + b.name + ' (' + b.file + ', ' + i.form + ')' AS evidence, [] AS path
ORDER BY file, line
