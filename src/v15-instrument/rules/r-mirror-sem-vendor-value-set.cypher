// id: R-MIRROR-SEM
// family: H11
// title: a core value set is a renamed copy of a vendor SDK's value set, and the core branches on it (neuro-symbolic: the structure is symbolic, the mirror judgement is a model fact)
// rule: The core's values express distinctions the domain owns; an outbound adapter translates the vendor's values into them, so a vendor that adds, splits or renames a value changes the adapter, not the core's branches (Cockburn, ports and adapters; Evans, anticorruption layer).
// fix: Decide which distinctions the domain needs (its spec and rules name them), declare the core set with those (often fewer) members, map the vendor's values onto them in the outbound adapter, and let the core branch only on its own members.
// applies: a core value set (string-literal union, enum, or const array / Set / object of strings) in a domain, application or port file with >= 3 members; an outbound adapter maps >= 2 values of one vendor value set (a literal set of an export of a module an adapter imports through a bare specifier, as R-MIRROR2) onto >= 2 of its members (switch case, object table, conditional, if, Map); the core branches on it at least once outside its own declaration (comparison, switch case, includes / has argument, lookup table); not a set the baseline tree's core already declares with the same name and members (ownedBy 'baseline'); and the model fact (MirrorJudgement, claude-opus-5-5, mirror-sem.ts) says the core set mirrors the vendor's distinctions (mirror = 'yes'). 'unsure', 'no', a failed call and an unasked candidate never fire.
// facts: MirrorCandidate, MirrorJudgement, JUDGED
MATCH (c:MirrorCandidate)-[:JUDGED]->(j:MirrorJudgement)
WHERE c.ownedBy = '' AND c.coreSize >= 3 AND c.mappedFrom >= 2 AND c.mappedTo >= 2 AND c.branchCount >= 1 AND j.mirror = 'yes'
RETURN c.file AS file, toInteger(c.line) AS line, c.coreSet AS subject,
       '[value-set] ' + c.file + ':' + toString(toInteger(c.line)) + ' ' + c.coreSet + ' mirrors ' + c.vendorSet + ' of ' + c.module
         + ' (' + reduce(s = '', x IN c.pairs | s + CASE WHEN s = '' THEN '' ELSE ', ' END + x) + '; mapped at ' + c.mapSite
         + CASE WHEN c.oneToOne THEN ', one to one' ELSE '' END + ') and the core branches on it at ' + c.branchSites[0]
         + ' | model fact: ' + j.reason AS evidence,
       [] AS path
ORDER BY file, line, subject
