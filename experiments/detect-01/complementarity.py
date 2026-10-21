#!/usr/bin/env python3
"""DETECT-01 step 6: symbolic vs semantic, per family and per fixture variant (zero calls; reads results only).

Usage (repository root): python3 -I experiments/detect-01/complementarity.py
Writes experiments/detect-01/results/complementarity.json and prints a Markdown table.
"""
import json
import os

HERE = 'experiments/detect-01'
fx = json.load(open(f'{HERE}/results/fixtures.json'))
sem_dir = f'{HERE}/results/semantic'

rows = []
for r in fx['rows']:
    sem_file = os.path.join(sem_dir, f"{r['fixture']}__{r['variant']}.json")
    if not os.path.exists(sem_file):
        continue
    sem = json.load(open(sem_file))
    fam = sem['family']
    sym_rules = sorted({f['rule'] for f in r['findings'] if f['family'] == fam})
    sym_flag = len(sym_rules) > 0
    verdict = (sem.get('answer') or {}).get('verdict', 'invalid')
    expected = r['expectedFamily'] == fam
    rows.append({
        'fixture': r['fixture'], 'variant': r['variant'], 'family': fam, 'expected': expected,
        'symbolic': sym_flag, 'symbolicRules': sym_rules, 'semantic': verdict,
        'agree': (verdict == 'present') == sym_flag if verdict in ('present', 'absent') else None,
    })

families = sorted({x['family'] for x in rows})
summary = {}
for fam in families:
    xs = [x for x in rows if x['family'] == fam]
    summary[fam] = {
        'variants': len(xs),
        'symbolicCorrect': sum(1 for x in xs if x['symbolic'] == x['expected']),
        'semanticCorrect': sum(1 for x in xs if (x['semantic'] == 'present') == x['expected'] and x['semantic'] != 'abstain'),
        'agree': sum(1 for x in xs if x['agree'] is True),
        'disagree': [f"{x['fixture']}/{x['variant']}: symbolic={'flag' if x['symbolic'] else 'silent'}, semantic={x['semantic']}, expected={'violation' if x['expected'] else 'clean'}" for x in xs if x['agree'] is False],
    }

os.makedirs(f'{HERE}/results', exist_ok=True)
json.dump({'schema': 'detect-01-complementarity-v1', 'split': 'dev', 'rows': rows, 'perFamily': summary},
          open(f'{HERE}/results/complementarity.json', 'w'), indent=1)
print('| Family | Variants | Symbolic correct | Semantic correct | Agree | Disagreements |')
print('|---|---|---|---|---|---|')
for fam, s in summary.items():
    print(f"| {fam} | {s['variants']} | {s['symbolicCorrect']} | {s['semanticCorrect']} | {s['agree']} | {'; '.join(s['disagree']) or '-'} |")
