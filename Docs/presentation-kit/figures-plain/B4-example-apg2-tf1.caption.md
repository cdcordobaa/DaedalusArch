# B4-example-apg2-tf1 (plain set)

**Slide claim.** A web controller hands out a storage type through a return type the compiler infers; no import links the two files. Only the richer map holds that link, so only it can report the leak; an import checker cannot.

**NUMBERS.md rows used.**
- APG v2: "5 rows (live 5 = mirror 5); TF1 row UserController.get → UserRecord, return, inferred" (boundary-type-leak on the type-flow fixture).

**Notes.**
- Panels are headed "1. What the team wrote", "2. The query the tool generates", "3. The code that breaks it", "4. What the tool reports". YAML, Cypher and code lines are verbatim from the kit, trimmed with "…"; rule ids, file paths and variant codes are left out of the figure (the full card is in examples/).
