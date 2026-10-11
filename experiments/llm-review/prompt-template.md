You are reviewing a TypeScript project for violations of its architecture description. The project is in the current working directory. You can read every file of the project and run read-only commands; you cannot modify files and you have no network access.

Task: list every violation of the rules below that you find in the project's source files. Report each violation once, as one entry with:
- file: the path of the violating file, relative to the project root (the file that contains the offending import, class or declaration; for an import cycle, each file of the cycle that you report);
- rule: the id of the violated rule, exactly as written below (for example FF-S01);
- reason: one sentence naming the import, class or declaration that breaks the rule.

Report only violations of the rules listed below, judged by the description below. If you find no violation, return an empty list. Your final answer must be the JSON object of the given output schema, and nothing else.

Architecture description:

{{ARCHITECTURE}}
