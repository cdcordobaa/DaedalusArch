#!/usr/bin/env python3
"""2x2 per style and the pre-stated reading (plan §7). usage: aggregate.py <resultsdir> -> summary.json, summary.md"""
import json, os, re, sys
R = sys.argv[1]
PORT = {'tool-library': 'ports/mailer', 'bike-repair': 'ports/parts-catalogue', 'choir-rehearsals': 'ports/sms-sender', 'kayak-rentals': 'ports/payment-gateway'}
ADAPTER = {'tool-library': 'console-mailer', 'bike-repair': 'spoke-supply-client', 'choir-rehearsals': 'text-tone-sms-sender', 'kayak-rentals': 'paddle-pay-client'}
corr = {(r['projectId'], r['file']): r['verdict'] for r in json.load(open(os.path.join(R, 'correctness', 'correctness.json')))['results']}
rows = []
for c in sorted(os.listdir(os.path.join(R, 'cells'))):
    rec = json.load(open(os.path.join(R, 'cells', c, 'record.json')))
    diff = open(os.path.join(R, 'cells', c, 'step.diff')).read()
    # application files the step added or changed, and how each reaches the adapter's capability
    app_files = re.findall(r'^\+\+\+ b/(src/application/[^\n]+\.ts)$', diff, re.M)
    app_files = [f for f in app_files if '/ports/' not in f]
    snap = os.path.join(R, 'cells', c, 'snapshot')
    via_port, via_adapter = [], []
    for f in app_files:
        src = open(os.path.join(snap, f)).read()
        if PORT[rec['domain']] in src: via_port.append(f)
        if ADAPTER[rec['domain']] in src: via_adapter.append(f)
    counted_same = [n for n in rec['newBlockingIdentities'] if n['shape'] == 'same-as-precedent' and corr.get((c, n['file'])) == 'correct']
    rows.append({
        'cell': c, 'order': rec['order'], 'domain': rec['domain'], 'style': rec['style'], 'condition': rec['condition'], 'step': rec['step'],
        'typecheckErrors': rec['typecheckErrors'], 'seedBlocking': rec['seedBlocking'], 'blocking': rec['blockingViolationCount'],
        'newSameShape': rec['newSameShape'], 'newSameShapeCounted': len(counted_same), 'newOther': rec['newOther'],
        'outcome': 1 if counted_same else 0, 'precedentSurvives': rec['precedentSurvives'],
        'appFilesTouched': app_files, 'appFilesUsingPort': via_port, 'appFilesImportingAdapter': via_adapter,
        'filesTouched': len(rec['filesTouched']), 'srcFiles': rec['srcFiles'], 'loc': rec['loc'],
        'advisory': rec['advisoryViolationCount'],
    })
def share(cond, style=None):
    sel = [r for r in rows if r['condition'] == cond and (style is None or r['style'] == style)]
    return {'cells': len(sel), 'withSameShape': sum(r['outcome'] for r in sel)}
planted, control = share('planted'), share('control')
viable = planted['withSameShape'] >= 4 and control['withSameShape'] == 0
out = {
    'rows': rows,
    'primary': {'planted': planted, 'control': control,
                'byStyle': {st: {'planted': share('planted', st), 'control': share('control', st)} for st in ('hexagonal', 'clean')}},
    'reading': 'brownfield seeding is a viable Study 2 lever; propose it to the author for D11' if viable
               else 'null; agents do not copy this shortcut at this n',
    'precedentSurvivesInPlanted': sum(1 for r in rows if r['condition'] == 'planted' and r['precedentSurvives']),
    'newOtherBlockingTotal': sum(r['newOther'] for r in rows),
}
json.dump(out, open(os.path.join(R, 'summary.json'), 'w'), indent=2)
md = ['| # | cell | style | condition | step | tsc errors | blocking (seed → step) | new same-shape | new other | precedent survives | new application files: via port / importing adapter | files touched | LOC |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|']
for r in sorted(rows, key=lambda r: r['order']):
    md.append(f"| {r['order']} | {r['domain']} | {r['style']} | {r['condition']} | {r['step']} | {r['typecheckErrors']} | {r['seedBlocking']} → {r['blocking']} | {r['newSameShape']} | {r['newOther']} | {'–' if r['precedentSurvives'] is None else ('yes' if r['precedentSurvives'] else 'no')} | {len(r['appFilesUsingPort'])}/{len(r['appFilesTouched'])} · {len(r['appFilesImportingAdapter'])}/{len(r['appFilesTouched'])} | {r['filesTouched']} | {r['loc']} |")
md += ['', '| style | planted: cells with a new same-shape finding | control: cells with a new same-shape finding |', '|---|---|---|']
for st in ('hexagonal', 'clean'):
    b = out['primary']['byStyle'][st]
    md.append(f"| {st} | {b['planted']['withSameShape']} / {b['planted']['cells']} | {b['control']['withSameShape']} / {b['control']['cells']} |")
md.append(f"| **both** | **{planted['withSameShape']} / {planted['cells']}** | **{control['withSameShape']} / {control['cells']}** |")
md += ['', f"Pre-stated reading: **{out['reading']}**."]
open(os.path.join(R, 'summary.md'), 'w').write('\n'.join(md) + '\n')
print(json.dumps({k: v for k, v in out.items() if k != 'rows'}, indent=1))
