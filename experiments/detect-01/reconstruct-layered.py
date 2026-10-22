#!/usr/bin/env python3
"""DETECT-01: rebuild a v1.4-exploratory Layered snapshot, as far as possible, from the semantic cassettes.

The exploratory snapshots themselves live in out-roots outside the repository
(Docs/DiagnosticRuns/v1.4-exploratory-report-2026-10-20.md, "Data"). The C1d and C4 cassettes under
results/v1.4-exploratory/stage-c/semantic/claude/cassettes/ quote source excerpts with line numbers. This script places
every quoted line at its line number and leaves the rest blank, so the result is a PARTIAL tree: class bodies are
present, but most import lines and type declarations above the first quoted line are not. It reads cassettes only
(no model call) and writes to the directory given; nothing is written into the repository.

Usage: python3 -I experiments/detect-01/reconstruct-layered.py <snapshot-key> <out-dir>
  snapshot-key: e.g. none-L2__hive-health__rep1__step-05
"""
import glob
import json
import os
import re
import sys

CASSETTES = 'results/v1.4-exploratory/stage-c/semantic/claude/cassettes'


def main() -> int:
    key, out = sys.argv[1], sys.argv[2]
    lines: dict[str, dict[int, str]] = {}
    for kind in ('c1d', 'c4'):
        for f in glob.glob(f'{CASSETTES}/{kind}/{key}/**/*.json', recursive=True):
            prompt = json.load(open(f))['prompt']
            for m in re.finditer(r'SOURCE-BEGIN (\S+)[^\n]*\n(.*?)SOURCE-END', prompt, re.S):
                for raw in m.group(2).splitlines():
                    mm = re.match(r'\s*(\d+)\| ?(.*)$', raw)
                    if mm:
                        lines.setdefault(m.group(1), {})[int(mm.group(1))] = mm.group(2)
    report = {}
    for rel, got in sorted(lines.items()):
        last = max(got)
        p = os.path.join(out, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w') as fh:
            fh.write('\n'.join(got.get(i, '') for i in range(1, last + 1)) + '\n')
        report[rel] = {'lines': last, 'quoted': len(got)}
    json.dump({'snapshot': key, 'files': report}, sys.stdout, indent=1)
    print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
