"""v1.3-validity-predictive: draw the H1 validation sample (prespec: 200 H1-positive, 100 H1-negative, seed 20261016).

    python3 scripts/v1.3/predictive/heuristic_sample.py --clones <dir with <owner>_<repo>.git>

Pool: label-T window commits (history/<id>.T.commits.csv) that touch at least one analysed file. Allocation per
project is proportional to its pool size, at least 3 where available (largest remainder). Writes
results/v1.3-validity-predictive/heuristic-validation/sample.jsonl (subject, body, changed files; no tool output).
"""
import argparse
import csv
import json
import pathlib
import random
import subprocess

REPO = pathlib.Path(__file__).resolve().parents[3]
OUT = REPO / 'results/v1.3-validity-predictive'
SEED = 20261016


def allocate(sizes: dict, n: int, floor: int = 3) -> dict:
    total = sum(sizes.values())
    base = {k: min(v, floor) for k, v in sizes.items()}
    left = n - sum(base.values())
    raw = {k: max(0.0, left * v / total) for k, v in sizes.items()}
    alloc = {k: min(sizes[k], base[k] + int(raw[k])) for k in sizes}
    rem = sorted(sizes, key=lambda k: (-(raw[k] - int(raw[k])), k))
    i = 0
    while sum(alloc.values()) < n and any(alloc[k] < sizes[k] for k in sizes):
        k = rem[i % len(rem)]
        if alloc[k] < sizes[k]:
            alloc[k] += 1
        i += 1
    return alloc


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--clones', required=True)
    a = ap.parse_args()
    sel = {e['id']: e for e in json.loads((OUT / 'selection.json').read_text())['entries']}
    pools = {True: {}, False: {}}
    for f in sorted((OUT / 'history').glob('*.T.commits.csv')):
        for r in csv.DictReader(open(f)):
            if int(r['sample_files_touched']) < 1:
                continue
            pools[r['h1'] == '1'].setdefault(r['project'], []).append(r)
    rnd = random.Random(SEED)
    sample = []
    for pos, n in ((True, 200), (False, 100)):
        alloc = allocate({k: len(v) for k, v in pools[pos].items()}, n)
        for proj in sorted(alloc):
            for r in rnd.sample(sorted(pools[pos][proj], key=lambda x: x['sha']), alloc[proj]):
                sample.append((proj, r))
    rnd.shuffle(sample)
    out = OUT / 'heuristic-validation'
    out.mkdir(parents=True, exist_ok=True)
    with open(out / 'sample.jsonl', 'w') as fh:
        for i, (proj, r) in enumerate(sample):
            gd = f"{a.clones}/{sel[proj]['repo'].replace('/', '_')}.git"
            msg = subprocess.run(['git', '--git-dir', gd, 'show', '-s', '--format=%B', r['sha']], capture_output=True, text=True, errors='replace').stdout
            files = subprocess.run(['git', '--git-dir', gd, 'show', '--format=', '--name-only', r['sha']], capture_output=True, text=True, errors='replace').stdout.split()
            fh.write(json.dumps({'n': i + 1, 'project': proj, 'sha': r['sha'], 'h1': int(r['h1']), 'h2': int(r['h2']), 'h3': int(r['h3']),
                                 'message': msg.strip()[:1500], 'files': files[:25], 'files_total': len(files)}) + '\n')
    print(len(sample), 'commits ->', (out / 'sample.jsonl').relative_to(REPO))


if __name__ == '__main__':
    main()
