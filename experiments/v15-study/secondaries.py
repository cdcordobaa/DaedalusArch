"""v1.5 final study, descriptive secondaries 3-7 (registration §4), zero calls. Secondaries 1-2 come from
scripts/v1.5/final-study-analyse.ts. Reads both lanes' scores.json and run/sessions/*.json from their results branches.
Run: python3 experiments/v15-study/secondaries.py > results/v1.5-study/analysis/secondaries.json
"""
import json, subprocess, collections, statistics

LANES = {'a': 'origin/results/v15-lane-a', 'b': 'origin/results/v15-lane-b'}
runs = []
for l, ref in LANES.items():
    d = json.loads(subprocess.check_output(['git', 'show', f'{ref}:results/v1.5-study/lane-{l}/scores/scores.json']))
    for r in d['runs']:
        if r['counted']:
            # run/*.jsonl are git-ignored; per-turn records are kept in run/sessions/<id>.json.
            sess = json.loads(subprocess.check_output(['git', 'show', f"{ref}:results/v1.5-study/lane-{l}/run/sessions/{r['session']}.json"]))
            r['_turns'] = sess['steps']; runs.append(r)

def by(style, arm):
    return [r for r in runs if r['style'] == style and r['arm'] == arm]

out = {}
for style in ('ddd', 'hexagonal'):
    s = {}
    for arm in ('none', 'combined'):
        rs = by(style, arm)
        # 3. repair: admitted identities present at some step and absent at the final step.
        repaired = 0
        for r in rs:
            seen = set().union(*[set(st['admittedNewVsSeed']) for st in r['steps'][1:-1]] or [set()])
            repaired += len(seen - set(r['steps'][-1]['admittedNewVsSeed']))
        # 4. attribution and gate activity (combined only).
        att = collections.Counter(); push = pull = refused = 0; pull_tools = collections.Counter()
        for r in rs:
            a = r.get('attribution') or {}
            att.update(a.get('counts', {})); push += a.get('pushEvents', 0); pull += a.get('pullCalls', 0)
            pull_tools.update(a.get('pullByTool', {})); refused += (r.get('integrity') or {}).get('refused', 0)
        # 5. exploratory rows.
        expl = collections.Counter(i.split('|')[0] for r in rs for i in r['exploratoryNew'])
        # 6. cost.
        walls = [t['wallMs'] for r in rs for t in r['_turns'] if 'wallMs' in t]
        # 7. graph against imports, count level (score-study records D_frozen counts, not identities).
        trap = [r for r in rs if r['trapFailed']]
        s[arm] = {
            'cells': len(rs),
            'repairedIdentities': repaired,
            'attribution': dict(att), 'pushEvents': push, 'pullCalls': pull, 'pullByTool': dict(pull_tools),
            'editsRefused': refused,
            'exploratoryNewByRule': dict(expl),
            'turnWallMs': {'turns': len(walls), 'median': statistics.median(walls) if walls else None},
            'graphVsImports': {
                'sumD_v15': sum(r['D'] for r in rs), 'sumD_frozen': sum(r['D_frozen']['D'] for r in rs),
                'cellsD_v15Only': sum(1 for r in rs if r['D'] > 0 and r['D_frozen']['D'] == 0),
                'cellsD_frozenOnly': sum(1 for r in rs if r['D'] == 0 and r['D_frozen']['D'] > 0),
                'cellsBoth': sum(1 for r in rs if r['D'] > 0 and r['D_frozen']['D'] > 0),
                'trapFailedCells': len(trap),
                'trapFailedFlaggedByGraph': sum(1 for r in trap if r['Y'] > 0),
                'trapFailedFlaggedByImports': sum(1 for r in trap if r['D_frozen']['D'] > 0),
                'frozenIncomplete': sum(1 for r in rs if r['D_frozen']['incomplete']),
            },
        }
    out[style] = s
print(json.dumps(out, indent=1))
