# Sweep defect and diagnostic sweep (2026-10-27, zero calls)

`setup-sandbox.sh` check 2 hands the patterns to grep as `-f /dev/stdin` with stdin redirected from a root-only 0600
file. As the generator user, opening `/dev/stdin` (a reopen through `/proc/self/fd/0`) fails with "Permission denied"
(grep rc 2), stderr goes to /dev/null and `|| true` hides the code, so the scripted `sweep.txt` is empty without any
search having run. The scripted gate therefore passed vacuously (exit 0).

Diagnostic sweep, run by the coordinator before any call, same patterns (85 lines), same exclusions, patterns piped
instead (`cat sweep-patterns.txt | setpriv --reuid=1500 ... grep -rIlF -f - / --exclude-dir=proc --exclude-dir=sys
--exclude-dir=dev`):

- positive control: one pattern written to a gen-owned file under the generator home: found (the file only); control
  removed afterwards;
- real sweep: `sweep-diagnostic.txt`, **0 readable files** (about 8 s).

The listing check (`listing.txt`) denied every closed path. The plan §2 condition (0 readable files) holds on the
diagnostic sweep; the script itself was not edited.
