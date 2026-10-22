# Docs/sources: the project's source ledger

One place for every literature and evidence source the project has cited, so the thesis can cite each one and
know how far it was read. Started 2026-10-21 from a sweep of `ops/notes/`, `Docs/` (v1.3, v1.4, DiagnosticRuns,
research memos, style-rule sources), `papers/*/refs.bib`, `demo/`, `scripts/` and the branches `explore/puzzle-01`,
`explore/detect-01` and `pilot/hexddd-01`, plus a search session's list.

## Files

| File | What it holds |
|---|---|
| `sources-ledger.md` | One row per source: key, reference, URL, the repo files that cite it, the claim it supports, status, tags. Grouped by each row's first tag. Ends with merged duplicates, the figures the ledger cannot verify, and row counts. |
| `sources.bib` | One BibTeX entry per ledger row. **Keys match the ledger.** |
| `README.md` | This file. |

`papers/*/refs.bib` remain the per-paper bibliographies. Entries copied from them into `sources.bib` are verbatim
(the source file is named in a comment). Those files say their entries were written from general knowledge and are
unchecked, so copying them does not verify them.

## Status

| Status | Meaning |
|---|---|
| read in full | A repo note says the work, or the figures taken from it, was read in the full text. |
| summary only | A repo note summarises it from the abstract, a snippet, documentation pages or a secondary source. |
| search summary only, not read in full | Known only from a search session's result summary. |
| unverified | A bare mention, or an entry written from general knowledge with no reading recorded. |

Default to the lower status when in doubt. Quote a figure in the thesis only from a *read in full* source, or check
it first; the ledger's "Figures the ledger cannot verify" section lists every known exception.

## Tags

`agent-architecture-degradation`, `benchmarks`, `trap-tasks`, `neuro-symbolic`, `LLM-as-judge`,
`ddd-hexagonal-literature`, `style-rule-sources`, `statistics-preregistration`, `architecture-conformance-tools`,
`spec-instruction-following`, `mining-rules`, `measurement-validity`, `software-architecture-classics`. Two were
added for rows that fit none of these: `thesis-examination` and `grey-literature` (vendor, practitioner and
industry pages). A row may carry several tags; the first decides its section.

## Adding a source

1. Search the ledger for the arXiv id, DOI or title first. If the source is there, add the new repo path to its
   "Used in" cell and raise its status only if the new note says it was read further.
2. Otherwise add one row in the section of its main tag. Key: first author's surname, year, one title word
   (`dente2026constraintdecay`). Leave out the year or author from the key when the repo does not record them.
3. Fill only what a repo note or the source itself states. Write "authors not recorded" or "title not recorded"
   rather than guessing.
4. Add the matching entry to `sources.bib` with the same key. Omit unknown fields and put a
   `% missing: <fields>` line above the entry.
5. If a repo note quotes a figure from a source that is not *read in full*, add it to "Figures the ledger cannot
   verify" with its `path:line`.
6. Update the row counts.

Use repo-relative paths only. Write `[br] branch:path` for a file that exists only on a branch.
