#!/usr/bin/env python3
"""Cell list, seeded order, step texts and the hand-rendered styled next-step frame (prompts.ts is not edited).
usage: cells.py setup <cellsdir>   -> one git project per cell (seed copied, prompt.txt, skeleton linked, commit 'seed')
       cells.py order              -> prints the seeded order"""
import os, random, shutil, subprocess, sys
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
HERE = os.path.dirname(os.path.abspath(__file__))
DOMAINS = {
    'tool-library': ('hexagonal', 'Community tool library'),
    'bike-repair': ('hexagonal', 'Bicycle repair workshop'),
    'choir-rehearsals': ('clean', 'Community choir rehearsals'),
    'kayak-rentals': ('clean', 'Lake kayak rentals'),
}
STEPS = {
    'tool-library': {
        'x1': 'When a borrowed tool comes back damaged, staff record what is broken and the repair fee, and the member who had it gets an e-mail with the details and the fee.',
        'x2': 'Members can join a waiting list for a tool that is out. When the tool is returned, the first member on the list gets an e-mail saying it is ready to collect.'},
    'bike-repair': {
        'x1': 'A mechanic can order a missing part for a work order. The order is placed with SpokeSupply and the work order shows the expected delivery date that SpokeSupply returns.',
        'x2': 'The shop wants a list of open work orders where a quoted part now costs more at SpokeSupply than in the quote, with the old and the new price.'},
    'choir-rehearsals': {
        'x1': 'When a singer misses two rehearsals in a row, they get a text message asking whether they are still able to come.',
        'x2': 'A section leader can move a rehearsal of their section to another date; every singer in that section gets a text message with the new date.'},
    'kayak-rentals': {
        'x1': 'When a kayak comes back late, the customer is charged a late fee through PaddlePay: 5 euros for every started half hour.',
        'x2': 'A customer can cancel a booking up to 24 hours before it starts; the deposit is refunded through PaddlePay.'},
}
STYLE = {
    'hexagonal': ('Hexagonal Architecture, ports and adapters', 'Organise the source code under src/ in exactly five folders: src/domain, src/application, src/adapters/inbound, src/adapters/outbound and src/config.'),
    'clean': ('Clean Architecture', 'Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.'),
}
SPEC = {'hexagonal': 'presets/hexagonal.yaml', 'clean': 'presets/clean-architecture.yaml'}
TYPECHECK = './node_modules/.bin/tsc -p tsconfig.json'

def cells():
    c = [(d, cond, s) for d in DOMAINS for cond in ('planted', 'control') for s in ('x1', 'x2')]
    random.Random(20261016).shuffle(c)
    return c

def prompt(domain, step):
    style, title = DOMAINS[domain]
    name, layout = STYLE[style]
    return '\n'.join([
        'The current directory holds a TypeScript backend service built in earlier feature steps.',
        f'This is step 2 of 3 of "{title}". Extend the existing service; keep every existing feature working.',
        '', 'Feature request:', STEPS[domain][step], '',
        f'Keep the source under src/ and follow the architecture the project already uses ({name}).',
        layout,
        'Before you finish, type-check the project with exactly this command and fix every error it reports:',
        TYPECHECK, ''])

def cell_id(d, cond, s):
    return f'{d}.{cond}.{s}'

if __name__ == '__main__':
    if sys.argv[1] == 'order':
        for i, c in enumerate(cells(), 1): print(i, cell_id(*c))
    elif sys.argv[1] == 'setup':
        root = sys.argv[2]
        for i, (d, cond, s) in enumerate(cells(), 1):
            p = os.path.join(root, f'{i:02d}.{cell_id(d, cond, s)}')
            shutil.rmtree(p, ignore_errors=True)
            shutil.copytree(os.path.join(REPO, 'examples/precedent-probe', d, cond, 'src'), os.path.join(p, 'src'))
            os.symlink(os.path.join(os.environ['PROBE_SKEL'], 'node_modules'), os.path.join(p, 'node_modules'))
            subprocess.run([os.path.join(HERE, 'mktsconfig.sh'), p], check=True)
            open(os.path.join(p, 'prompt.txt'), 'w').write(prompt(d, s))
            open(os.path.join(p, '.gitignore'), 'w').write('node_modules\ntsconfig.json\n')
            for cmd in (['git', 'init', '-q'], ['git', 'config', 'user.email', 'probe@local'], ['git', 'config', 'user.name', 'probe'],
                        ['git', 'add', '-A'], ['git', 'commit', '-qm', 'seed']):
                subprocess.run(cmd, cwd=p, check=True)
            print(p)
