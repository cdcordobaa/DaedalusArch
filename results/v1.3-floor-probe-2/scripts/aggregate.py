#!/usr/bin/env python3
"""Floor probe 2: aggregates the step records into summary.json and summary.md. usage: aggregate.py <results dir>
Applies the plan's identity rule (Docs/DiagnosticRuns/v1.3-floor-probe-2-plan.md §5) and pass criterion (§6)."""
import json, os, sys

R = sys.argv[1]
TASKS = {'shelter-adoptions': 'hexagonal', 'market-vendors': 'clean'}
CONDS = ('C1', 'C2', 'C3')
corr = json.load(open(os.path.join(R, 'correctness', 'correctness.json')))
correct_files = {(r['projectId'], r['ruleId'], r['file']) for r in corr['results'] if r['verdict'] == 'correct'}

rows, per = [], {}
for task, style in TASKS.items():
    for c in CONDS:
        seen = set()
        for i in range(1, 5):
            rec = json.load(open(os.path.join(R, task, c, f'step-{i:02d}.json')))
            pid = f'{task}/{c}/step-{i:02d}'
            ids = {tuple(f['identity']) for f in rec['blockingFindings']}
            new = sorted(ids - seen) if i > 1 else []
            seen |= ids
            n_correct = sum(1 for f in rec['blockingFindings'] if (pid, f['rule'], f['file']) in correct_files)
            row = {'task': task, 'style': style, 'condition': c, 'step': i, 'blocking': rec['blockingViolationCount'],
                   'blockingCorrect': n_correct, 'blockingByRule': {k: v for k, v in rec['blockingByRule'].items() if v},
                   'newBlockingIdentities': [list(x) for x in new], 'advisory': rec['advisoryViolationCount'],
                   'files': rec['srcFiles'], 'loc': rec['loc'], 'unmapped': rec['layerUnmapped'], 'typecheckErrors': rec['typecheckErrors']}
            rows.append(row)

def agg(sel):
    return {'steps': len(sel), 'stepsWithCorrectBlocking': sum(1 for r in sel if r['blockingCorrect'] > 0),
            'newIdentitiesAtStep2plus': sum(len(r['newBlockingIdentities']) for r in sel),
            'rules': sorted({k for r in sel for k in r['blockingByRule']}),
            'unmappedShareFinalStep': [f"{r['unmapped']}/{r['files']}" for r in sel if r['step'] == 4]}

summary = {'byCondition': {}, 'byConditionAndStyle': {}}
for c in CONDS:
    summary['byCondition'][c] = agg([r for r in rows if r['condition'] == c])
    for st in TASKS.values():
        summary['byConditionAndStyle'][f'{c}/{st}'] = agg([r for r in rows if r['condition'] == c and r['style'] == st])
c1 = summary['byCondition']['C1']['stepsWithCorrectBlocking']
lift = [c for c in ('C2', 'C3') if summary['byCondition'][c]['stepsWithCorrectBlocking'] >= 3]
summary['reading'] = {
    'c1ReplicatesFloor': c1 <= 1,
    'conditionsLiftingFloor': lift,
    'recommendation': ('S5 = "no-layout-hint arm or frame"' if lift and c1 <= 1 else
                       'not interpretable (C1 above 1/8)' if c1 > 1 else
                       'keep the frame; move the lever to task design (W3-3)'),
}
json.dump({'rows': rows, 'summary': summary}, open(os.path.join(R, 'summary.json'), 'w'), indent=1)

md = ['| task | style | cond | step | blocking (rules) | correct | new identities (step ≥ 2) | advisory | files | unmapped | LOC |',
      '|---|---|---|---|---|---|---|---|---|---|---|']
for r in rows:
    rules = ', '.join(f'{k}×{v}' for k, v in r['blockingByRule'].items()) or '–'
    md.append(f"| {r['task']} | {r['style']} | {r['condition']} | {r['step']} | {r['blocking']} ({rules}) | {r['blockingCorrect']} | "
              f"{len(r['newBlockingIdentities'])} | {r['advisory']} | {r['files']} | {r['unmapped']} | {r['loc']} |")
md += ['', '| condition | steps with ≥ 1 correct blocking finding | hexagonal | clean | new identities at steps ≥ 2 | rules | unmapped files at step 4 (hex, clean) |',
       '|---|---|---|---|---|---|---|']
for c in CONDS:
    a, h, k = summary['byCondition'][c], summary['byConditionAndStyle'][f'{c}/hexagonal'], summary['byConditionAndStyle'][f'{c}/clean']
    md.append(f"| {c} | {a['stepsWithCorrectBlocking']}/{a['steps']} | {h['stepsWithCorrectBlocking']}/{h['steps']} | "
              f"{k['stepsWithCorrectBlocking']}/{k['steps']} | {a['newIdentitiesAtStep2plus']} | {', '.join(a['rules']) or '–'} | "
              f"{', '.join(h['unmappedShareFinalStep'] + k['unmappedShareFinalStep'])} |")
md += ['', f"Reading (plan §6): {summary['reading']['recommendation']}."]
open(os.path.join(R, 'summary.md'), 'w').write('\n'.join(md) + '\n')
print('\n'.join(md[-8:]))
