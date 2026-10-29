"""SO5 taxonomy, first-coder codes (design: ops/notes/so5-taxonomy-design.md §5 steps 2-3).

Every card gets one primary category of codebook.md. `basis` says how: `hunk` (the code was read), `evidence` (no hunk;
coded from the rule ids or the oracle sub-goal family), `metric` (an advisory metric finding, not a construct; excluded).
Explicit per-card readings (READ) override the evidence rules; they are the cards whose hunk was read and coded by hand.
Zero model calls. Run: python3 experiments/so5-taxonomy/code-cards.py
"""
import json, os, subprocess, collections

HERE = os.path.dirname(os.path.abspath(__file__))
cards = json.load(open(os.path.join(HERE, 'cards.json')))['cards']

# Hand readings of hunk cards (first coder), category and a short open code.
READ = {
    'E121': ('A7', 'booking rule checked in the service'),
    'E122': ('A4', 'repository port method persists two aggregates'),
    'E123': ('A9', 'revenue split over bookings computed in a report service'),
    'E124': ('R2', 'controller switched from the concrete store to the port'),
    'E125': ('A11', 'lock callback and audit write in the repository port'),
    'E126': ('A5', 'payment command notifies ordering synchronously'),
    'E127': ('A7', 'order-line and credit rules checked in the command'),
    'E128': ('A7', 'tax-rate rule checked in the command'),
    'E129': ('A5', 'invoice command changes ordering through a notifier'),
    'E130': ('A12', 'order entity exposed through a published shape'),
    'E136': ('A8', 'daily transfer limit kept in a service-held tally map'),
    'E141': ('A8', 'daily transfer limit kept in a separate in-memory tally'),
    'E142': ('A10', 'vendor rate type in the port, vendor fields read in the service'),
    'E143': ('A10', 'vendor SDK imported at run time by the core'),
    'E160': ('A10', 'vendor rate type in the port, vendor fields read in the service'),
    'E161': ('A10', 'vendor rate type in the port, vendor fields read in the service'),
    'E170': ('A7', 'blocked-pass rule checked in an application function'),
    'E175': ('A7', 'cancellation rules checked in the use case'),
    'E204': ('A7', 'cancellation rules checked in the use case'),
    'E213': ('A5', 'booking command adds visits to the member synchronously'),
    'E245': ('A5', 'booking command adds visits to the member synchronously'),
    'E211': ('A2', 'MQTT adapter mutates lockers through the concrete store'),
    'E250': ('A2', 'MQTT adapter mutates lockers through the concrete store'),
}
FACADE_FILES = ('index.ts', 'main.ts', 'Facade.ts', 'facade.ts')

# TRAPRATE-01 oracle-only cards carry the sub-goal id; its family comes from the task's puzzle.json (neutral id map).
def _git(path):
    return json.loads(subprocess.check_output(['git', 'show', f'origin/main:{path}'], cwd=HERE))
_idmap = _git('results/v1.5-traprate-01/private-id-map.json')
SG_FAMILY = {tid: {g['id']: g.get('family', '') for g in _git(f"experiments/trap-families/{v['task']}/puzzle.json").get('subGoals', [])}
             for tid, v in _idmap.items()}

def facade(f):
    return f is not None and (f.endswith(FACADE_FILES) or '/api/' in f and 'Facade' in f)

def code(c):
    ev = c['evidence']; rules = ev.get('ruleIds') or []; f = c['file']
    if c['id'] in READ:
        cat, oc = READ[c['id']]; return cat, oc, 'hunk'
    basis = 'hunk' if c.get('hunk') else 'evidence'
    if c['source'] == 'study1':
        return 'M0', 'advisory metric finding (' + ','.join(rules) + ')', 'metric'
    if c['source'] == 'study2b':
        return ('R1', 'inherited composition wiring removed', basis) if c['kind'] == 'repair' else ('A1', 'repositories wired in the presentation app file', basis)
    fam = ev.get('oracleFamily') or ev.get('handReadFamily') or ''
    if not fam and c['source'] == 'traprate01' and ev.get('oracleSubGoal'):
        fam = SG_FAMILY.get(c['facets'].get('task'), {}).get(ev['oracleSubGoal'], '')
    if not rules and fam:  # oracle or hand-read evidence
        if fam.startswith('D4 cross-context'): return ('A6' if facade(f) else 'A5'), 'cross-context change inside the command', basis
        if fam == 'D4': return 'A3', 'second aggregate changed in the same command', basis
        if fam.startswith('H5'): return 'A10', 'vendor shape or vocabulary in the core', basis
        if fam.startswith('H7') or 'bypass' in fam: return 'A2', 'driving adapter bypasses the in-port', basis
        if fam.startswith('D5'): return 'A7', 'rule checked outside the aggregate', basis
        if fam.startswith('D3'): return 'A9', 'calculation outside the aggregate', basis
        if fam.startswith('H2') or fam.startswith('H1'): return 'A10', 'vendor dependency in the core', basis
    if 'R-D4R' in rules: return 'A4', 'repository gains a persist-many method', basis
    if 'R-XCTX' in rules or ('R-D4' in rules and facade(f)):
        return ('A6' if facade(f) else 'A5'), 'cross-context or cross-aggregate write in ' + ('a facade or module wiring' if facade(f) else 'the command'), basis
    if 'R-D4' in rules: return 'A3', 'second aggregate changed in the same command', basis
    if 'R-D5' in rules or 'R-D5S' in rules: return 'A7', 'rule checked outside the aggregate', basis
    if 'R-D3' in rules: return 'A9', 'calculation outside the aggregate', basis
    if 'R-AXA' in rules: return 'A2', 'adapter depends on another adapter package', basis
    if 'R-LOCK' in rules: return 'A8', 'process-local lock as consistency guard', basis
    return 'U', 'uncoded', basis

out, rows = [], collections.Counter()
for c in cards:
    cat, oc, basis = code(c)
    fx = c['facets']
    out.append({'id': c['id'], 'category': cat, 'openCode': oc, 'basis': basis, 'kind': c['kind'], 'source': c['source'],
                'style': fx.get('style'), 'model': fx.get('model'), 'specLevel': fx.get('specLevel'), 'arm': fx.get('arm'),
                'multiplicity': c.get('multiplicity', 1)})
json.dump({'coder': 'first coder (this session)', 'codebook': 'codebook.md v0 (draft, not frozen)', 'codes': out},
          open(os.path.join(HERE, 'codes-first.json'), 'w'), indent=1)
cnt = collections.Counter((o['category'], o['basis']) for o in out)
by = collections.Counter((o['category'], o['style']) for o in out)
print('category x basis:', sorted(cnt.items()))
print('category x style:', sorted(by.items()))
print('uncoded:', [o['id'] for o in out if o['category'] == 'U'])
