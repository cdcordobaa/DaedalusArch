#!/usr/bin/env python3
"""Score every cell snapshot, classify new blocking identities (plan §7) and write the records.
usage: score_cells.py <cellsdir> <resultsdir>
Per cell: <resultsdir>/cells/<NN.domain.condition.step>/{snapshot/src, prompt.txt, step.diff, record.json, report.json}."""
import json, os, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from evalsnap import evaluate
from cells import DOMAINS, SPEC, cells, cell_id

OUT_FOLDER = {'hexagonal': 'src/adapters/outbound/', 'clean': 'src/infrastructure/'}

def ident(f):
    return (f['rule'], f['template'], f['file'], f.get('target'))

def main(cellsdir, res):
    seeds = os.path.join(res, 'seeds')
    for i, (d, cond, s) in enumerate(cells(), 1):
        cid = f'{i:02d}.{cell_id(d, cond, s)}'
        proj = os.path.join(cellsdir, cid)
        style = DOMAINS[d][0]
        seed = json.load(open(os.path.join(seeds, f'{d}.{cond}.json')))
        precedent_rules = {f['rule'] for f in json.load(open(os.path.join(seeds, f'{d}.planted.json')))['blockingFindings']}
        out = os.path.join(res, 'cells', cid)
        shutil.rmtree(out, ignore_errors=True); os.makedirs(os.path.join(out, 'snapshot'))
        subprocess.run(f'git archive HEAD src | tar -x -C {out}/snapshot', shell=True, cwd=proj, check=True)
        shutil.copy(os.path.join(proj, 'prompt.txt'), os.path.join(out, 'prompt.txt'))
        diff = subprocess.run(['git', 'diff', 'HEAD~1', 'HEAD', '--', 'src'], cwd=proj, capture_output=True, text=True, check=True).stdout
        open(os.path.join(out, 'step.diff'), 'w').write(diff)
        touched = subprocess.run(['git', 'diff', '--name-status', 'HEAD~1', 'HEAD'], cwd=proj, capture_output=True, text=True, check=True).stdout.strip().replace('\t', ' ').splitlines()
        rec = evaluate(os.path.join(out, 'snapshot'), SPEC[style], os.path.join(out, 'report.json'))
        seed_ids = {ident(f) for f in seed['blockingFindings']}
        new = []
        for f in rec['blockingFindings']:
            if ident(f) in seed_ids:
                continue
            same = (f['file'] or '').startswith('src/application/') and (f.get('target') or '').startswith(OUT_FOLDER[style]) and f['rule'] in precedent_rules
            new.append({**f, 'shape': 'same-as-precedent' if same else 'other'})
        precedent_ids = {ident(f) for f in seed['blockingFindings']} if cond == 'planted' else set()
        rec.update({
            'cell': cid, 'order': i, 'domain': d, 'style': style, 'condition': cond, 'step': s,
            'filesTouched': touched, 'seedBlocking': seed['blockingViolationCount'],
            'newBlockingIdentities': new,
            'newSameShape': sum(1 for n in new if n['shape'] == 'same-as-precedent'),
            'newOther': sum(1 for n in new if n['shape'] == 'other'),
            'precedentSurvives': (bool(precedent_ids) and precedent_ids <= {ident(f) for f in rec['blockingFindings']}) if cond == 'planted' else None,
        })
        with open(os.path.join(out, 'record.json'), 'w') as fh:
            json.dump(rec, fh, indent=2); fh.write('\n')
        print(f"{cid}: tsc={rec['typecheckErrors']} blocking={rec['blockingViolationCount']} (seed {rec['seedBlocking']}) new-same={rec['newSameShape']} new-other={rec['newOther']} precedentSurvives={rec['precedentSurvives']}")
        for n in new:
            print(f"   NEW {n['shape']}: {n['rule']} {n['file']} -> {n['target']}")

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
