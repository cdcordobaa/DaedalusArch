"""SO5 taxonomy, cross-vendor coder: agreement as fixed in PROTOCOL.md (zero calls).

Usage (repository root): python3 experiments/so5-taxonomy/panel-gemini/analyse.py
Writes agreement.json and agreement.md beside this file.
"""
import json
from collections import Counter
from pathlib import Path

HERE = Path('experiments/so5-taxonomy/panel-gemini')
first = {c['id']: c for c in json.loads(Path('experiments/so5-taxonomy/codes-first.json').read_text())['codes']}
panel = {l['id']: l for l in json.loads(Path('experiments/so5-taxonomy/panel/labels.json').read_text())['labels']}
gem = {}
for line in (HERE / 'answers.jsonl').read_text().splitlines():
    if line.strip():
        r = json.loads(line)
        if r.get('valid'):
            gem[r['card']] = r['category']


def kappa(pairs):
    n = len(pairs)
    if n == 0:
        return None, None
    po = sum(a == b for a, b in pairs) / n
    ca, cb = Counter(a for a, _ in pairs), Counter(b for _, b in pairs)
    pe = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return (po - pe) / (1 - pe) if pe < 1 else 1.0, po


def fleiss(rows):
    n, k = len(rows), len(rows[0]) if rows else 0
    if n == 0:
        return None
    cats = sorted({c for r in rows for c in r})
    p_j = {c: sum(r.count(c) for r in rows) / (n * k) for c in cats}
    p_i = [(sum(r.count(c) ** 2 for c in cats) - k) / (k * (k - 1)) for r in rows]
    pbar, pe = sum(p_i) / n, sum(v * v for v in p_j.values())
    return (pbar - pe) / (1 - pe) if pe < 1 else 1.0


ids = sorted(first)
out = {'cards': len(ids), 'geminiValid': len(gem), 'geminiMissing': sorted(set(ids) - set(gem))}
k, po = kappa([(first[i]['category'], gem[i]) for i in ids if i in gem])
out['primary'] = {'measure': 'Cohen kappa, first coder vs gemini-1', 'n': len(gem), 'kappa': k, 'raw': po, 'bar': 0.6,
                  'barMet': k is not None and k >= 0.6}
pp = [(panel[i]['panel'], gem[i]) for i in ids if i in gem and panel.get(i, {}).get('panel') not in (None, 'unresolved')]
k2, po2 = kappa(pp)
out['panelVsGemini'] = {'n': len(pp), 'kappa': k2, 'raw': po2}
rows = []
for i in ids:
    v = panel.get(i, {}).get('votes', {})
    if i in gem and all(v.get(c) for c in ('fable-1', 'fable-2', 'opus-1')):
        rows.append([v['fable-1'], v['fable-2'], v['opus-1'], gem[i]])
out['fleissFourCoders'] = {'n': len(rows), 'kappa': fleiss(rows)}
by = {}
for b in sorted({first[i]['basis'] for i in ids}):
    kb, pb = kappa([(first[i]['category'], gem[i]) for i in ids if i in gem and first[i]['basis'] == b])
    by[b] = {'n': sum(1 for i in ids if i in gem and first[i]['basis'] == b), 'kappa': kb, 'raw': pb}
out['byBasis'] = by
conf = Counter()
for i in ids:
    if i in gem and first[i]['category'] != gem[i]:
        conf[tuple(sorted((first[i]['category'], gem[i])))] += 1
out['topConfusions'] = [{'pair': '/'.join(p), 'count': c} for p, c in conf.most_common(8)]
(HERE / 'agreement.json').write_text(json.dumps(out, indent=1) + '\n')

f = lambda x: '—' if x is None else f'{x:.3f}'
md = ['# SO5 taxonomy, cross-vendor coder: agreement', '',
      f"Cards {out['cards']}; Gemini valid answers {out['geminiValid']}.", '',
      '| Measure | n | κ | raw |', '|---|---|---|---|',
      f"| First coder vs gemini-1 (primary; bar 0.6) | {len(gem)} | {f(k)} | {f(po)} |",
      f"| Claude panel majority vs gemini-1 | {len(pp)} | {f(k2)} | {f(po2)} |",
      f"| Fleiss, 3 Claude + 1 Gemini | {len(rows)} | {f(out['fleissFourCoders']['kappa'])} | — |", '',
      '| First-coder basis | n | κ | raw |', '|---|---|---|---|']
md += [f"| {b} | {v['n']} | {f(v['kappa'])} | {f(v['raw'])} |" for b, v in by.items()]
md += ['', 'Most confused pairs (first coder vs gemini-1): ' + ', '.join(f"{c['pair']} {c['count']}" for c in out['topConfusions'])]
(HERE / 'agreement.md').write_text('\n'.join(md) + '\n')
print('\n'.join(md))
