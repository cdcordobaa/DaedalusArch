# B2-example-ffdt03-ddd (plain set)

**Slide claim.** In a DDD app, a value object (Quantity) can be changed through a set accessor. The first run missed it; once the map recorded setters, the query found it, and DDD violations found went from 8/9 to 9/9 (author key).

**NUMBERS.md rows used.**
- Development set: rules, "8/9 → 9/9 (ddd), 53/54 → 54/54 (pooled; was 56/57 → 57/57 before the FF-P06 correction)" (effect of member facts, g01 found).

**Notes.**
- Panels are headed "1. What the team wrote", "2. The query the tool generates", "3. The code that breaks it", "4. What the tool reports". YAML, Cypher and code lines are verbatim from the kit, trimmed with "…"; rule ids, file paths and variant codes are left out of the figure (the full card is in examples/).
