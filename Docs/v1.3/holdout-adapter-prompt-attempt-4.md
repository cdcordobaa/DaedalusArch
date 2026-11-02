# Hold-out attempt 4: the blind adapter prompt (verbatim)

Committed with its sha256 in `Docs/v1.3/sealed-hashes.md` before the session runs (addendum 4 §1). The text between
the two `PROMPT` lines is passed to the session unchanged, with `<SOURCE>`, `<CONVERTED>` and `<REPO>` replaced by the
absolute paths of the work directory's source copy, its empty `converted/` folder and the freeze-tag worktree.

----- PROMPT BEGIN -----
You are a blind layout adapter. You move files; you never change what is in them.

Input: a copy of a sealed test set at <SOURCE>. Output: the same files, re-arranged into the on-disk layout that a
frozen loader reads, at <CONVERTED>. Nobody will read your intermediate output; only your final JSON is used, and an
independent script checks your work by content hash.

The target layout is defined in the header comment of <REPO>/scripts/v1.3/lib/reference-model.ts ("Patch format").
For each style that is stored in that format (expected: clean-architecture, layered, nestjs, hexagonal) create
<CONVERTED>/<style>/ holding:
- project/ (the clean variant: src/, types/, tsconfig.json, package.json, as the source has them)
- spec.yaml, reference.json, expected-graph.json (the files that play these roles in the source)
- variants/<id>/variant.patch and variants/<id>/expected-findings.json for every variant, where <id> is the variant id
  its own manifest gives. Every variant directory must contain its expected-findings.json.
You may read the loader files <REPO>/scripts/v1.3/lib/reference-model.ts, <REPO>/scripts/v1.3/lib/holdout-run-main.ts,
<REPO>/scripts/v1.3/lib/materialise.ts and <REPO>/schemas/ to learn the layout and the file names. Do not read any
other repository file.

Rules:
1. Path only. Use only mkdir, cp, mv, ls and shasum. Never edit, rewrite, reformat, rename inside, merge or create the
   content of any data file. If a role has no matching source file, leave it missing and say so; do not make one.
2. A style stored in another format (for example ddd, if it is not in patch format) is not converted; list it under
   stylesIncomplete with a one-line reason that names formats, not file contents.
3. Files the loader does not need are not copied; count them.
4. Write <CONVERTED>/MAP.sha256: one line per converted file, `<sha256>  <path relative to CONVERTED>`.
5. Never print or repeat file contents, variant ids, case names or file paths in your final answer.

Final answer: one JSON object and nothing else:
{"filesIn": <int>, "filesOut": <int, excluding MAP.sha256>, "contentHashMultisetEqual": <bool>,
 "stylesComplete": [<style>...], "stylesIncomplete": [{"style": <style>, "reason": <string>}], "notes": <string, no
 paths, no names>}
----- PROMPT END -----
