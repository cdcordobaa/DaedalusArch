import json,sys
from collections import Counter
ms=[json.loads(l) for l in open(sys.argv[1])]
print(Counter((m['label'].split(' [')[0],m['verdict']) for m in ms))
for m in ms:
  if 'minimised' in m: print('==',m['seed'],m['label'],m['binding'],m['verdict'],'|',m.get('detail','')[:260]);print('   ',json.dumps(m['minimised']['project']['apg'])[:700]);print('   ',json.dumps(m['minimised']['project']['layerModel'])[:300]); print('   params', json.dumps(m['minimised']['params'])[:300])
