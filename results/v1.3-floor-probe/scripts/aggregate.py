#!/usr/bin/env python3
"""Aggregates the floor-probe step records into summary.json and summary.md. usage: aggregate.py <results dir>"""
import json, os, sys
R = sys.argv[1]
TJ = json.load(open(os.path.join(R, 'tasks.json')))
tasks = TJ['tasks']
PN = TJ.get('pilotPressureNotes', {})
def ident(f):
    return (f['rule'], f['file'], f.get('target'))
out = {'tasks': [], 'totals': {}}
md = []
for t in tasks:
    tid, style = t['id'], t['style']
    none = [json.load(open(os.path.join(R, tid, 'none', f'step-{i:02d}.json'))) for i in range(1, len(t['steps']) + 1)]
    pre = [json.load(open(os.path.join(R, tid, 'tool', f'step-{i:02d}.pre.json'))) for i in range(1, len(t['steps']) + 1)]
    post = [json.load(open(os.path.join(R, tid, 'tool', f'step-{i:02d}.post.json'))) for i in range(1, len(t['steps']) + 1)]
    seen = set(); steps = []
    for i, (n, a, b, s) in enumerate(zip(none, pre, post, t['steps']), 1):
        ids = {ident(f) for f in n['blockingFindings']}
        new = sorted(ids - seen) if i > 1 else []
        seen |= ids
        steps.append({
            'step': i, 'id': s['id'], 'pressure': s.get('pressure') or PN.get(tid, [None] * 9)[i - 1],
            'none': {'blocking': n['blockingViolationCount'], 'blockingByRule': {k: v for k, v in n['blockingByRule'].items() if v},
                     'newBlockingAfterStep1': [list(x) for x in new], 'advisory': n['advisoryViolationCount'],
                     'advisoryByRule': {k: v for k, v in n['advisoryByRule'].items() if v}, 'files': n['srcFiles'], 'loc': n['loc'],
                     'filesTouched': len(n['filesTouched']), 'typecheckErrors': n['typecheckErrors']},
            'toolPre': {'blocking': a['blockingViolationCount'], 'blockingByRule': {k: v for k, v in a['blockingByRule'].items() if v},
                        'checkDiffBlocking': (a.get('checkDiff') or {}).get('blocking', 0), 'advisory': a['advisoryViolationCount']},
            'toolPost': {'blocking': b['blockingViolationCount'], 'advisory': b['advisoryViolationCount'],
                         'advisoryByRule': {k: v for k, v in b['advisoryByRule'].items() if v}, 'files': b['srcFiles'], 'loc': b['loc'],
                         'fixFilesTouched': len(b['filesTouched']), 'checkDiffBlockingOfFix': (b.get('checkDiff') or {}).get('blocking', 0)},
        })
    out['tasks'].append({'id': tid, 'style': style, 'source': t.get('source'), 'steps': steps})
n_steps = sum(len(t['steps']) for t in out['tasks'])
viol = [(t['id'], s['step']) for t in out['tasks'] for s in t['steps'] if s['none']['blocking'] > 0]
viol_after1 = [(t['id'], s['step']) for t in out['tasks'] for s in t['steps'] if s['step'] > 1 and s['none']['newBlockingAfterStep1']]
out['totals'] = {
    'noneSteps': n_steps, 'noneStepsWithBlocking': len(viol), 'shareNoneStepsWithBlocking': round(len(viol) / n_steps, 3),
    'byStyle': {st: {'steps': sum(len(t['steps']) for t in out['tasks'] if t['style'] == st),
                     'stepsWithBlocking': sum(1 for t in out['tasks'] if t['style'] == st for s in t['steps'] if s['none']['blocking'] > 0)}
                for st in ('hexagonal', 'layered')},
    'noneStepsAfterStep1WithNewBlocking': len(viol_after1), 'stepsAfterStep1': n_steps - len(out['tasks']),
    'toolPreStepsWithBlocking': sum(1 for t in out['tasks'] for s in t['steps'] if s['toolPre']['blocking'] > 0),
    'toolPostStepsWithBlocking': sum(1 for t in out['tasks'] for s in t['steps'] if s['toolPost']['blocking'] > 0),
}
json.dump(out, open(os.path.join(R, 'summary.json'), 'w'), indent=2)
# markdown table
md.append('| task | style | step | pressure | none: blocking (rules) | new after step 1 | none: advisory | tool pre-fix blocking | tool post-fix blocking | tool post: advisory | none files/LOC | tool files/LOC |')
md.append('|---|---|---|---|---|---|---|---|---|---|---|---|')
for t in out['tasks']:
    for s in t['steps']:
        n, a, b = s['none'], s['toolPre'], s['toolPost']
        rules = ', '.join(f'{k}×{v}' for k, v in n['blockingByRule'].items()) or '–'
        md.append(f"| {t['id']} | {t['style']} | {s['step']} {s['id']} | {s['pressure']} | {n['blocking']} ({rules}) | {len(n['newBlockingAfterStep1'])} | {n['advisory']} | {a['blocking']} | {b['blocking']} | {b['advisory']} | {n['files']}/{n['loc']} | {b['files']}/{b['loc']} |")
open(os.path.join(R, 'summary.md'), 'w').write('\n'.join(md) + '\n')
print(json.dumps(out['totals'], indent=1))
for t in out['tasks']:
    for s in t['steps']:
        if s['none']['newBlockingAfterStep1']: print(t['id'], s['step'], s['none']['newBlockingAfterStep1'])
