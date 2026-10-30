"""SO5 taxonomy panel: labels, agreement and counts (PROTOCOL.md "Labels and agreement"). Zero model calls.

Reads answers.jsonl (raw panel attempts), ../codes-first.json (first coder) and ../cards.json (sources).
Writes labels.json, agreement.json and agreement.md. Run: python3 experiments/so5-taxonomy/panel/analyse.py
"""
import collections, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
UP = os.path.dirname(HERE)
CODERS = ['fable-1', 'fable-2', 'opus-1']
CATS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'R1', 'R2', 'M0', 'none']
SOURCES = ['study1', 'study2b', 'hexddd01', 'puzzle01', 'puzzle03', 'puzzle04', 'traprate01']

first = {c['id']: c for c in json.load(open(os.path.join(UP, 'codes-first.json')))['codes']}
cards = json.load(open(os.path.join(UP, 'cards.json')))['cards']
ids = [c['id'] for c in cards]

votes = collections.defaultdict(dict)  # card -> coder -> (category, reason)
attempts = collections.Counter(); invalid = collections.Counter(); models = collections.Counter()
for line in open(os.path.join(HERE, 'answers.jsonl')):
    if not line.strip(): continue
    r = json.loads(line); attempts[r['coder']] += 1; models[(r['coder'], r['model'])] += 1
    if r['valid']: votes[r['card']][r['coder']] = (r['category'], r['reason'])
    else: invalid[r['coder']] += 1

def label(card):
    v = [votes[card][k][0] for k in CODERS if k in votes[card]]
    top = collections.Counter(v).most_common(1)
    return top[0][0] if top and top[0][1] >= 2 else 'unresolved'

labels = {i: label(i) for i in ids}

def cohen(pairs):
    n = len(pairs)
    if n == 0: return None
    po = sum(a == b for a, b in pairs) / n
    ca = collections.Counter(a for a, _ in pairs); cb = collections.Counter(b for _, b in pairs)
    pe = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return None if pe == 1 else (po - pe) / (1 - pe)

def fleiss(rows):
    n, m = len(rows), 3
    if n == 0: return None
    cats = sorted({x for r in rows for x in r})
    P = [(sum(r.count(c) ** 2 for c in cats) - m) / (m * (m - 1)) for r in rows]
    pj = [sum(r.count(c) for r in rows) / (n * m) for c in cats]
    Pbar, Pe = sum(P) / n, sum(p * p for p in pj)
    return None if Pe == 1 else (Pbar - Pe) / (1 - Pe)

r3 = lambda x: None if x is None else round(x, 3)
lab = [i for i in ids if labels[i] != 'unresolved']
pairs = [(first[i]['category'], labels[i]) for i in lab]
pairs_all = [(first[i]['category'], labels[i]) for i in ids]
raw = lambda ps: round(sum(a == b for a, b in ps) / len(ps), 3) if ps else None

per_cat = {}
for c in sorted({a for a, _ in pairs} | {b for _, b in pairs}, key=lambda x: CATS.index(x) if x in CATS else 99):
    bp = [(a == c, b == c) for a, b in pairs]
    per_cat[c] = {'kappa': r3(cohen(bp)), 'first': sum(a for a, _ in bp), 'panel': sum(b for _, b in bp),
                  'both': sum(a and b for a, b in bp)}

full = [i for i in ids if all(k in votes[i] for k in CODERS)]
fl = fleiss([[votes[i][k][0] for k in CODERS] for i in full])
pairwise = {f'{a}~{b}': raw([(votes[i][a][0], votes[i][b][0]) for i in full]) for x, a in enumerate(CODERS) for b in CODERS[x + 1:]}

by_basis = {}
for b in ['hunk', 'evidence', 'metric']:
    sel = [i for i in ids if first[i]['basis'] == b]
    ps = [(first[i]['category'], labels[i]) for i in sel if labels[i] != 'unresolved']
    by_basis[b] = {'cards': len(sel), 'labelled': len(ps), 'unresolved': len(sel) - len(ps), 'kappa': r3(cohen(ps)), 'raw': raw(ps)}
# TRAPRATE-01 oracle sub-goal cards (shown separately, as declared)
sg = [i for i in ids if next(c for c in cards if c['id'] == i)['evidence'].get('oracleSubGoal')]
ps = [(first[i]['category'], labels[i]) for i in sg if labels[i] != 'unresolved']
by_basis['oracle-subgoal (subset of evidence)'] = {'cards': len(sg), 'labelled': len(ps), 'unresolved': len(sg) - len(ps), 'kappa': r3(cohen(ps)), 'raw': raw(ps)}

conf = collections.Counter(pairs_all)
off = collections.Counter()
for (a, b), n in conf.items():
    if a != b and b != 'unresolved': off[tuple(sorted((a, b), key=lambda x: CATS.index(x)))] += n
src = {c['id']: c['source'] for c in cards}

out = {
    'protocol': 'PROTOCOL.md (so5-panel-v1)',
    'calls': {'attempts': dict(attempts), 'invalidAttempts': dict(invalid), 'reportedModels': {f'{a}|{b}': n for (a, b), n in models.items()}},
    'cards': len(ids), 'labelled': len(lab), 'unresolved': len(ids) - len(lab),
    'unresolvedIds': [i for i in ids if labels[i] == 'unresolved'],
    'cohenKappa': {'labelled': r3(cohen(pairs)), 'allWithUnresolved': r3(cohen(pairs_all)), 'rawLabelled': raw(pairs), 'rawAll': raw(pairs_all)},
    'fleissKappa': r3(fl), 'fleissCards': len(full), 'pairwiseRaw': pairwise,
    'perCategory': per_cat, 'byBasis': by_basis,
    'confusion': {f'{a}->{b}': n for (a, b), n in sorted(conf.items())},
    'mostConfusedPairs': [{'pair': f'{a}/{b}', 'cards': n} for (a, b), n in off.most_common(10)],
    'panelLabelDistribution': dict(collections.Counter(labels.values())),
}
json.dump(out, open(os.path.join(HERE, 'agreement.json'), 'w'), indent=1)
json.dump({'labels': [{'id': i, 'source': src[i], 'first': first[i]['category'], 'basis': first[i]['basis'], 'panel': labels[i],
                       'votes': {k: votes[i][k][0] for k in CODERS if k in votes[i]}} for i in ids]},
          open(os.path.join(HERE, 'labels.json'), 'w'), indent=1)

# Markdown tables
md = ['# SO5 panel agreement (generated by analyse.py)', '']
md += [f"Cards {len(ids)}; panel-labelled {len(lab)}; unresolved {len(ids) - len(lab)}.", '',
       '| Measure | Value |', '|---|---|',
       f"| Cohen's κ, first coder vs panel (labelled cards) | {out['cohenKappa']['labelled']} |",
       f"| Raw agreement (labelled cards) | {out['cohenKappa']['rawLabelled']} |",
       f"| Cohen's κ, all cards, unresolved as a label | {out['cohenKappa']['allWithUnresolved']} |",
       f"| Raw agreement (all cards) | {out['cohenKappa']['rawAll']} |",
       f"| Panel Fleiss' κ ({len(full)} cards, 3 valid answers) | {out['fleissKappa']} |"]
md += [f"| Pairwise raw {k} | {v} |" for k, v in pairwise.items()]
md += ['', '## Per category (one vs rest, labelled cards)', '', '| Category | κ | First | Panel | Both |', '|---|---|---|---|---|']
md += [f"| {c} | {v['kappa']} | {v['first']} | {v['panel']} | {v['both']} |" for c, v in per_cat.items()]
md += ['', '## By basis of the first code', '', '| Basis | Cards | Labelled | Unresolved | κ | Raw |', '|---|---|---|---|---|---|']
md += [f"| {b} | {v['cards']} | {v['labelled']} | {v['unresolved']} | {v['kappa']} | {v['raw']} |" for b, v in by_basis.items()]
cols = [c for c in CATS if any(b == c for _, b in pairs_all)] + ['unresolved']
rows = [c for c in CATS if any(a == c for a, _ in pairs_all)]
md += ['', '## Confusion (rows first coder, columns panel)', '', '| first \\ panel | ' + ' | '.join(cols) + ' |', '|---' * (len(cols) + 1) + '|']
md += [f"| {a} | " + ' | '.join(str(conf.get((a, b), '')) or '' for b in cols) + ' |' for a in rows]
md += ['', '## Most confused pairs (both directions, unresolved excluded)', '', '| Pair | Cards |', '|---|---|']
md += [f"| {p['pair']} | {p['cards']} |" for p in out['mostConfusedPairs']]
md += ['', '## Counts per category per source (first coder; panel label in brackets)', '',
       '| Category | ' + ' | '.join(SOURCES) + ' | Total |', '|---' * (len(SOURCES) + 2) + '|']
fc = collections.Counter((first[i]['category'], src[i]) for i in ids); pc = collections.Counter((labels[i], src[i]) for i in ids)
for c in CATS + ['unresolved']:
    if not any(fc[(c, s)] or pc[(c, s)] for s in SOURCES): continue
    cell = lambda s: f"{fc[(c, s)]} ({pc[(c, s)]})" if fc[(c, s)] or pc[(c, s)] else '–'
    md.append(f"| {c} | " + ' | '.join(cell(s) for s in SOURCES) + f" | {sum(fc[(c, s)] for s in SOURCES)} ({sum(pc[(c, s)] for s in SOURCES)}) |")
md.append(f"| **total** | " + ' | '.join(str(sum(1 for i in ids if src[i] == s)) for s in SOURCES) + f" | {len(ids)} |")
open(os.path.join(HERE, 'agreement.md'), 'w').write('\n'.join(md) + '\n')
print('\n'.join(md))
