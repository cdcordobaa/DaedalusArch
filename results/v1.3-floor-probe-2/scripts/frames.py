#!/usr/bin/env python3
"""Floor probe 2: renders the three conditions' step prompts by hand (prompts.ts/style.ts are NOT edited or imported).

usage: frames.py <out dir>   -> writes <out>/<task>/<cond>/step-NN.prompt.txt, <out>/frames.json and <out>/order.json.

C1 = style sentence + layout sentence (the styled loop frame, as rendered by style.ts for clean/hexagonal; replicates #161)
C2 = style sentence only (the layout line dropped)
C3 = no style wording; "Follow the architecture spec at spec.yaml." with the pilot spec copied into the project as spec.yaml
The trajectory order comes from a committed seed (ORDER_SEED).
"""
import json, os, random, sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ORDER_SEED = 20261017
TYPECHECK = './node_modules/.bin/tsc -p tsconfig.json'
TASK_IDS = ('shelter-adoptions', 'market-vendors')
CONDS = ('C1', 'C2', 'C3')

# Style texts copied from the output of scripts/lib/loop/style.ts styleFrame() on origin/v1.3 (not imported).
STYLE = {
    'hexagonal': {
        'styleSentence': 'Organise the code following Hexagonal Architecture (ports and adapters).',
        'styleName': 'Hexagonal Architecture, ports and adapters',
        'layoutSentence': 'Organise the source code under src/ in exactly five folders: src/domain, src/application, src/adapters/inbound, src/adapters/outbound and src/config.',
    },
    'clean': {
        'styleSentence': 'Organise the code following Clean Architecture.',
        'styleName': 'Clean Architecture',
        'layoutSentence': 'Organise the source code under src/ in exactly three folders: src/domain, src/application and src/infrastructure.',
    },
}
# The pilot plan's evaluator spec per task (experiments/loop-pilot/plan.json taskProfiles); copied as spec.yaml in C3.
TASK_STYLE = {'shelter-adoptions': 'hexagonal', 'market-vendors': 'clean'}
PILOT_SPEC = {'shelter-adoptions': 'presets/hexagonal.yaml', 'market-vendors': 'specs/clean-arch.yaml'}

HEAD1 = ['You are building a new TypeScript backend service in the current directory, in several feature steps.',
         'This is step {n} of {k} of "{title}".', '', 'Feature request:', '{req}', '']
HEADN = ['The current directory holds a TypeScript backend service built in earlier feature steps.',
         'This is step {n} of {k} of "{title}". Extend the existing service; keep every existing feature working.', '',
         'Feature request:', '{req}', '']
TAIL = ['Before you finish, type-check the project with exactly this command and fix every error it reports:', TYPECHECK, '']

ARCH = {
    'C1': (['Put the source under src/. {styleSentence}', '{layoutSentence}'],
           ['Keep the source under src/ and follow the architecture the project already uses ({styleName}).', '{layoutSentence}']),
    'C2': (['Put the source under src/. {styleSentence}'],
           ['Keep the source under src/ and follow the architecture the project already uses ({styleName}).']),
    'C3': (['Put the source under src/. Follow the architecture spec at spec.yaml.'],
           ['Keep the source under src/ and follow the architecture spec at spec.yaml.']),
}


def render(task, i, cond):
    st = STYLE[TASK_STYLE[task['id']]]
    step = task['steps'][i]
    head = HEAD1 if i == 0 else HEADN
    arch = ARCH[cond][0 if i == 0 else 1]
    lines = head + arch + TAIL
    return '\n'.join(lines).format(n=i + 1, k=len(task['steps']), title=task['title'], req=step['request'].strip(), **st)


def order():
    traj = [f'{t}/{c}' for t in TASK_IDS for c in CONDS]
    random.Random(ORDER_SEED).shuffle(traj)
    return traj


def main(out):
    tasks = {t['id']: t for t in json.load(open(os.path.join(REPO, 'experiments/loop-pilot/pilot-tasks.json')))['tasks'] if t['id'] in TASK_IDS}
    for tid, t in tasks.items():
        for c in CONDS:
            d = os.path.join(out, tid, c)
            os.makedirs(d, exist_ok=True)
            for i in range(len(t['steps'])):
                with open(os.path.join(d, f'step-{i + 1:02d}.prompt.txt'), 'w') as fh:
                    fh.write(render(t, i, c))
    json.dump({'orderSeed': ORDER_SEED, 'order': order()}, open(os.path.join(out, 'order.json'), 'w'), indent=1)
    json.dump({'typecheck': TYPECHECK, 'style': STYLE, 'taskStyle': TASK_STYLE, 'pilotSpec': PILOT_SPEC,
               'arch': {c: {'first': v[0], 'next': v[1]} for c, v in ARCH.items()}},
              open(os.path.join(out, 'frames.json'), 'w'), indent=1)
    print(order())


if __name__ == '__main__':
    main(sys.argv[1])
