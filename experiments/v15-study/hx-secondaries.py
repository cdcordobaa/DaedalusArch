"""v1.5 Hexagonal study, descriptive secondaries 3-6 (registration §1, "Secondary outcomes"), zero calls, after the one
scoring and analysis, plus secondary 7. Secondaries 1-2 come from scripts/v1.5/hx-study-analyse.ts. Secondary 7 (per-shape
view of H11) reads the R-MIRROR2 shape word that the scorer keeps on each final-step hit (`symbolicNewVsSeed[].shape`,
from the finding's evidence; not part of the identity). Reads scores.json and run/sessions/*.json from the results branch.
Run: python3 experiments/v15-study/hx-secondaries.py > results/v1.5-hx-study/hx-study/analysis/secondaries.json
"""
import json, subprocess, collections, statistics

REF = 'origin/results/v15-hx-study'
BASE = 'results/v1.5-hx-study/hx-study'
# §1 secondary 5: the not-counted and advisory rows (H11-d is R-MIRROR2's field shapes, so it is not separable here).
NOT_COUNTED = ('R-MIRROR', 'R-ADAPTER-RULE', 'FF-S03', 'FF-P02')


def show(path):
    return json.loads(subprocess.check_output(['git', 'show', f'{REF}:{BASE}/{path}']))


runs = [r for r in show('scores/scores.json')['runs'] if r['counted']]
for r in runs:
    r['_sess'] = show(f"run/sessions/{r['session']}.json")

out = {}
for arm in ('none', 'combined'):
    rs = [r for r in runs if r['arm'] == arm]
    # 3. repair: counted identities present at an intermediate step and absent at the final step.
    repaired = 0
    for r in rs:
        seen = set().union(*[set(st['admittedNewVsSeed']) for st in r['steps'][1:-1]] or [set()])
        repaired += len(seen - set(r['steps'][-1]['admittedNewVsSeed']))
    # 4. attribution and channel activity (combined only; none has no hub).
    att = collections.Counter(); push = pull = 0; pull_tools = collections.Counter(); findings = 0
    for r in rs:
        a = r.get('attribution') or {}
        att.update(a.get('counts', {})); push += a.get('pushEvents', 0); pull += a.get('pullCalls', 0)
        pull_tools.update(a.get('pullByTool', {})); findings += a.get('findings', 0)
    # 5. not-counted and advisory rows, new identities per rule.
    # exploratoryNew holds every R-MIRROR2 identity, counted shapes included; split it by shape word (secondary 7).
    rows = collections.Counter(i.split('|')[0] for r in rs for i in r['exploratoryNew'] if not i.startswith('R-MIRROR2|'))
    # 7. per-shape view of H11: new R-MIRROR2 identities at the final step, and cells with at least one, per shape word.
    shapes = collections.Counter(); shape_cells = collections.Counter()
    for r in rs:
        m2 = [h for h in r['steps'][-1].get('symbolicNewVsSeed') or [] if h['rule'] == 'R-MIRROR2']
        shapes.update(h.get('shape', 'none') for h in m2)
        shape_cells.update({h.get('shape', 'none') for h in m2})
    # 6. cost per cell.
    steps = [st for r in rs for st in r['_sess']['steps']]
    walls = [st['wallMs'] for st in steps if 'wallMs' in st]
    out[arm] = {
        'cells': len(rs),
        'repairedIdentities': repaired,
        'attribution': {'findings': findings, 'counts': dict(att)},
        'pushEvents': push, 'pullCalls': pull, 'pullByTool': dict(pull_tools),
        'notCountedNewByRule': {k: rows.get(k, 0) for k in NOT_COUNTED} | {k: v for k, v in rows.items() if k not in NOT_COUNTED},
        'mirror2ByShape': {'counted': ['literal', 'error'], 'newIdentities': dict(sorted(shapes.items())), 'cellsWithAny': dict(sorted(shape_cells.items()))},
        'cost': {
            'steps': len(steps),
            'stepWallMsMedian': statistics.median(walls) if walls else None,
            'attemptsTotal': sum(st.get('attempts', 1) for st in steps),
            'permissionDenials': sum(st.get('permissionDenials') or 0 for st in steps),
        },
    }
print(json.dumps(out, indent=1))
