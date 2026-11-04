"""V1511-DEV: two runs of experiments/cal-01/score.ts with no judge (zero model calls), before = main at v1.5.10 from a
frozen copy of src/, after = this branch at v1.5.11, each written to <dir>/<set>.json. Per case: pass, the mapped hits and the other hits,
with R-APPVENDOR (new, on no row) and R-MIRROR-SEM (needs the judge; the rerun has none) set aside.

  python3 experiments/v1511-dev/compare-scores.py <before dir> <after dir> cal-01 cal-02 ... > experiments/v1511-dev/results/scorers.json
"""
import json
import sys

SKIP = {'R-APPVENDOR', 'R-MIRROR-SEM'}


def norm(hits):
    return sorted(json.dumps({k: h[k] for k in ('rule', 'file', 'line', 'shape') if k in h}, sort_keys=True) for h in hits if h['rule'] not in SKIP)


def key(r):
    return f"{r['domain']}/{r['case']}"


out = {}
before, after = sys.argv[1], sys.argv[2]
for s in sys.argv[3:]:
    a = {key(r): r for r in json.load(open(f'{before}/{s}.json'))['rows']}
    b = {key(r): r for r in json.load(open(f'{after}/{s}.json'))['rows']}
    diffs = []
    sem_only = []
    for k in sorted(set(a) | set(b)):
        x, y = a.get(k), b.get(k)
        if x is None or y is None:
            diffs.append({'case': k, 'missing': 'before' if x is None else 'after'})
            continue
        same_hits = all(norm(x.get(f, [])) == norm(y.get(f, [])) for f in ('hits', 'mapped', 'other'))
        if x['pass'] != y['pass']:
            # a pass that rested on a judged R-MIRROR-SEM hit cannot reproduce without the judge
            if same_hits and any(h['rule'] == 'R-MIRROR-SEM' for f in ('hits', 'mapped') for h in x.get(f, [])):
                sem_only.append(k)
            else:
                diffs.append({'case': k, 'pass': [x['pass'], y['pass']]})
        elif not same_hits:
            diffs.append({'case': k, 'hits': True})
    av = sorted(f"{k} {h['file']}:{h['line']}" for k, r in b.items() for f in ('hits', 'mapped', 'other') for h in r.get(f, []) if h['rule'] == 'R-APPVENDOR')
    out[s] = {'cases': len(a), 'identical': not diffs, 'differences': diffs, 'judgeOnlyPasses': sem_only, 'appVendorHits': av}
print(json.dumps(out, indent=1))
