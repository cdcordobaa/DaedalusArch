# Study 2b OSF deposit package (prepared 2026-10-20, for the author's account)

The pre-registration says that an OSF deposit under embargo, carrying the registered sha256, is made before the first 2b call. The deposit is made from the author's OSF account; no agent session holds that account. This folder holds what to upload. It is a byte copy of files on `main`; the originals stay where they are.

## Contents

| File | What it is | sha256 |
|---|---|---|
| `study2b-preregistration.md` | The pre-registration as registered (2026-10-20T12:36:37Z); byte copy of `Docs/v1.4/study2b-preregistration.md` | see `SHA256SUMS` |
| `study2b-preregistration.registered.sha256` | The registered hash of that file (copy of `Docs/v1.4/study2b-preregistration.registered.sha256`; its path column names the file's place in the repository) | see `SHA256SUMS` |
| `study2b-preregistration-addendum-1.md` | Addendum 1 (deviations DA1–DA7, dated before any 2b call, readiness gate) | see `SHA256SUMS` |
| `scripts/v1.4/study2b-analyse.ts` | The registered analysis script (pre-registration §4, D9; sha256 in P8) | see `SHA256SUMS` |
| `scripts/v1.4/lib/study2b-analyse.ts`, `scripts/v1.4/lib/study2b-power.ts` | Its helpers, including `exactSignFlipP` (sha256 in P8) | see `SHA256SUMS` |
| `SHA256SUMS` | sha256 of every file above, relative to this folder | — |

The hashes in `SHA256SUMS` equal the ones in P8 and in `Docs/v1.4/study2b-preregistration.registered.sha256`; CI checks the originals on `main` (step "Study 2b registered-artefact hash gate").

## Steps for the author

1. Check the package: `cd ops/osf-deposit-2b && shasum -a 256 -c SHA256SUMS` (every line `OK`).
2. On OSF, create the registration (or a component) under embargo and upload the files above, keeping the folder layout.
3. Put the pre-registration's sha256 (`4d95e26d…3893`, the first field of `study2b-preregistration.registered.sha256`) in the registration's description.
4. Record the OSF id, the embargo end and the deposit time (UTC) in P8 by a dated deviation note, or tell the coordinator, who records it in a dated addendum. The pre-registration text itself is not edited.

Until step 4 is done, gate line D10 reads **PENDING-AUTHOR (deposit)** in `Docs/v1.4/study2b-gate-verdict.md`. The deposit is the author's one action before the run, next to the go.
