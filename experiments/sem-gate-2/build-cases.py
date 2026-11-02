"""SEM-GATE-2: builds the hxpb1 / hxpb2 case trees (zero model calls).

Each tree starts as a copy of the task's reference shortcut tree (`solutions/trap`, copied by the caller into
`cases/<id>/tree`) and this script rewrites the files named below. Run from the repository root:

    python3 -I experiments/sem-gate-2/build-cases.py

The hxa2 trees (from a kept Hexagonal study tree) are written by hand; see cases.json.
"""
import os
import re

ROOT = os.path.join('experiments', 'sem-gate-2', 'cases')


def write(case, rel, text):
    p = os.path.join(ROOT, case, 'tree', rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(text)


def edit(case, rel, pairs):
    p = os.path.join(ROOT, case, 'tree', rel)
    s = open(p).read()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{case} {rel}: missing {old[:60]!r}')
        s = s.replace(old, new, 1)
    with open(p, 'w') as f:
        f.write(s)


# ── hxpb1-pottery-kiln: vendor KilnwisePhase SCHEDULED CANDLING RAMPING HOLDING COOLING COMPLETE FAULTED ──
P1_SVC = 'src/application/services/pieces/PieceService.ts'
P1_DECL = """/** The kiln's phases, in our spelling. */
type KilnPhase = 'scheduled' | 'candling' | 'ramping' | 'holding' | 'cooling' | 'complete' | 'faulted';
"""
P1_STATUS = """    const phase = (await this.readings.newest(p.firingId)).phaseCode as KilnPhase;
    switch (phase) {
      case 'scheduled':
      case 'candling':
        return { pieceId, status: 'WAITING' };
      case 'ramping':
      case 'holding':
        return { pieceId, status: 'IN_THE_KILN' };
      case 'cooling': return { pieceId, status: 'COOLING_DOWN' };
      case 'complete': return { pieceId, status: 'READY_FOR_PICKUP' };
      case 'faulted': return { pieceId, status: 'FIRING_FAILED' };
    }
"""
P1_WITHDRAW = """      const phase = (await this.readings.newest(p.firingId)).phaseCode as KilnPhase;
      if (phase !== 'scheduled' && phase !== 'candling') throw new StudioError('The piece is already in the kiln.');
"""


def hxpb1(case, decl, status, withdraw, files=None, arch=None):
    edit(case, P1_SVC, [(P1_DECL, decl), (P1_STATUS, status), (P1_WITHDRAW, withdraw)])
    for rel, text in (files or {}).items():
        write(case, rel, text)
    if arch is not None:
        with open(os.path.join(ROOT, case, 'tree', 'ARCHITECTURE.md'), 'a') as f:
            f.write(arch)


# hxpb1-p1 (positive, cast): an exported lower-case copy in a domain file; the service casts and looks up a display table.
hxpb1('hxpb1-p1',
      "import type { KilnPhase } from '../../../domain/model/KilnPhase';\n\n"
      "const PICKUP: Record<KilnPhase, string> = {\n"
      "  scheduled: 'WAITING', candling: 'WAITING', ramping: 'IN_THE_KILN', holding: 'IN_THE_KILN',\n"
      "  cooling: 'COOLING_DOWN', complete: 'READY_FOR_PICKUP', faulted: 'FIRING_FAILED',\n"
      "};\n",
      "    const phase = (await this.readings.newest(p.firingId)).phaseCode as KilnPhase;\n"
      "    return { pieceId, status: PICKUP[phase] };\n",
      "      const phase = (await this.readings.newest(p.firingId)).phaseCode as KilnPhase;\n"
      "      if (phase !== 'scheduled' && phase !== 'candling') throw new StudioError('The piece is already in the kiln.');\n",
      {'src/domain/model/KilnPhase.ts': "/** Where a firing is, as the kiln reports it. */\n"
       "export type KilnPhase = 'scheduled' | 'candling' | 'ramping' | 'holding' | 'cooling' | 'complete' | 'faulted';\n"})

# hxpb1-p2 (positive, switch in a domain function): renamed union, one case per phase.
P2_STEP = """/** Where a firing is. */
export type KilnStep = 'booked' | 'drying' | 'climbing' | 'atPeak' | 'coolingDown' | 'finished' | 'failed';

/** The step for the phase text a kiln reading carries. */
export function kilnStepOf(phaseCode: string): KilnStep {
  switch (phaseCode) {
    case 'scheduled': return 'booked';
    case 'candling': return 'drying';
    case 'ramping': return 'climbing';
    case 'holding': return 'atPeak';
    case 'cooling': return 'coolingDown';
    case 'complete': return 'finished';
    case 'faulted': return 'failed';
    default: throw new Error('unknown kiln phase ' + phaseCode);
  }
}
"""
hxpb1('hxpb1-p2',
      "import { kilnStepOf } from '../../../domain/model/KilnStep';\n",
      """    const step = kilnStepOf((await this.readings.newest(p.firingId)).phaseCode);
    switch (step) {
      case 'booked':
      case 'drying':
        return { pieceId, status: 'WAITING' };
      case 'climbing':
      case 'atPeak':
        return { pieceId, status: 'IN_THE_KILN' };
      case 'coolingDown': return { pieceId, status: 'COOLING_DOWN' };
      case 'finished': return { pieceId, status: 'READY_FOR_PICKUP' };
      case 'failed': return { pieceId, status: 'FIRING_FAILED' };
    }
""",
      """      const step = kilnStepOf((await this.readings.newest(p.firingId)).phaseCode);
      if (step !== 'booked' && step !== 'drying') throw new StudioError('The piece is already in the kiln.');
""",
      {'src/domain/model/KilnStep.ts': P2_STEP})

# hxpb1-p3 (positive, Map in the service into a const object of renamed members).
hxpb1('hxpb1-p3',
      """/** Where the kiln is in a firing. */
const KilnState = {
  Booked: 'Booked', Candling: 'Candling', Climbing: 'Climbing', Holding: 'Holding', Cooling: 'Cooling', Done: 'Done', Faulted: 'Faulted',
} as const;
type KilnState = (typeof KilnState)[keyof typeof KilnState];

const STATE_OF_PHASE = new Map<string, KilnState>([
  ['scheduled', KilnState.Booked], ['candling', KilnState.Candling], ['ramping', KilnState.Climbing], ['holding', KilnState.Holding],
  ['cooling', KilnState.Cooling], ['complete', KilnState.Done], ['faulted', KilnState.Faulted],
]);
""",
      """    const state = STATE_OF_PHASE.get((await this.readings.newest(p.firingId)).phaseCode);
    if (state === KilnState.Booked || state === KilnState.Candling) return { pieceId, status: 'WAITING' };
    if (state === KilnState.Climbing || state === KilnState.Holding) return { pieceId, status: 'IN_THE_KILN' };
    if (state === KilnState.Cooling) return { pieceId, status: 'COOLING_DOWN' };
    if (state === KilnState.Done) return { pieceId, status: 'READY_FOR_PICKUP' };
    return { pieceId, status: 'FIRING_FAILED' };
""",
      """      const state = STATE_OF_PHASE.get((await this.readings.newest(p.firingId)).phaseCode);
      if (state !== KilnState.Booked && state !== KilnState.Candling) throw new StudioError('The piece is already in the kiln.');
""")

# hxpb1-p4 (positive, if chain on the upper-cased text into a renamed enum).
hxpb1('hxpb1-p4',
      """/** The kiln's condition. */
enum KilnCondition { Idle = 'idle', Venting = 'venting', Rising = 'rising', Steady = 'steady', Falling = 'falling', Cold = 'cold', Tripped = 'tripped' }

function conditionOf(phaseCode: string): KilnCondition {
  const code = phaseCode.toUpperCase();
  if (code === 'SCHEDULED') return KilnCondition.Idle;
  if (code === 'CANDLING') return KilnCondition.Venting;
  if (code === 'RAMPING') return KilnCondition.Rising;
  if (code === 'HOLDING') return KilnCondition.Steady;
  if (code === 'COOLING') return KilnCondition.Falling;
  if (code === 'COMPLETE') return KilnCondition.Cold;
  return KilnCondition.Tripped;
}
""",
      """    const c = conditionOf((await this.readings.newest(p.firingId)).phaseCode);
    switch (c) {
      case KilnCondition.Idle:
      case KilnCondition.Venting:
        return { pieceId, status: 'WAITING' };
      case KilnCondition.Rising:
      case KilnCondition.Steady:
        return { pieceId, status: 'IN_THE_KILN' };
      case KilnCondition.Falling: return { pieceId, status: 'COOLING_DOWN' };
      case KilnCondition.Cold: return { pieceId, status: 'READY_FOR_PICKUP' };
      case KilnCondition.Tripped: return { pieceId, status: 'FIRING_FAILED' };
    }
""",
      """      const c = conditionOf((await this.readings.newest(p.firingId)).phaseCode);
      if (c !== KilnCondition.Idle && c !== KilnCondition.Venting) throw new StudioError('The piece is already in the kiln.');
""")

# hxpb1-p5 (positive, a port method returning the vendor's phase; the service lower-cases and casts it).
hxpb1('hxpb1-p5',
      """/** The kiln's phases, as we keep them. */
type FiringPhase = 'scheduled' | 'candling' | 'ramping' | 'holding' | 'cooling' | 'complete' | 'faulted';
""",
      """    const phase = (await this.readings.phaseOf(p.firingId)).toLowerCase() as FiringPhase;
    if (phase === 'scheduled' || phase === 'candling') return { pieceId, status: 'WAITING' };
    if (phase === 'ramping' || phase === 'holding') return { pieceId, status: 'IN_THE_KILN' };
    if (phase === 'cooling') return { pieceId, status: 'COOLING_DOWN' };
    if (phase === 'complete') return { pieceId, status: 'READY_FOR_PICKUP' };
    return { pieceId, status: 'FIRING_FAILED' };
""",
      """      const phase = (await this.readings.phaseOf(p.firingId)).toLowerCase() as FiringPhase;
      if (phase !== 'scheduled' && phase !== 'candling') throw new StudioError('The piece is already in the kiln.');
""")
edit('hxpb1-p5', 'src/application/ports/out/kiln/KilnReadings.ts', [
    ("  newest(firingId: string): Promise<KilnReading>;\n",
     "  newest(firingId: string): Promise<KilnReading>;\n  /** The kiln's own word for the phase of a firing. */\n  phaseOf(firingId: string): Promise<string>;\n")])
edit('hxpb1-p5', 'src/adapters/outbound/kilnwise/KilnwiseReadingsAdapter.ts', [
    ("    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase() };\n  }\n",
     "    return { takenAt: top.takenAt, celsius: top.celsius, phaseCode: top.phase.toLowerCase() };\n  }\n\n"
     "  async phaseOf(firingId: string): Promise<string> {\n"
     "    const status = await this.client.firingStatus(firingId);\n"
     "    const top = status.readings[0];\n"
     "    if (top === undefined) throw new Error('kiln sent no reading for ' + firingId);\n"
     "    return top.phase;\n  }\n")])

# hxpb1-q1 (negative, coarser): a core table into the studio's five-step progress (the clean set), in the service.
hxpb1('hxpb1-q1',
      """import type { FiringProgress } from '../../../domain/model/FiringProgress';

const PROGRESS_OF_PHASE: Readonly<Record<string, FiringProgress>> = {
  scheduled: 'waiting', candling: 'waiting', ramping: 'firing', holding: 'firing',
  cooling: 'cooling', complete: 'finished', faulted: 'failed',
};
""",
      """    const progress = PROGRESS_OF_PHASE[(await this.readings.newest(p.firingId)).phaseCode];
    switch (progress) {
      case 'waiting': return { pieceId, status: 'WAITING' };
      case 'firing': return { pieceId, status: 'IN_THE_KILN' };
      case 'cooling': return { pieceId, status: 'COOLING_DOWN' };
      case 'finished': return { pieceId, status: 'READY_FOR_PICKUP' };
      default: return { pieceId, status: 'FIRING_FAILED' };
    }
""",
      """      const progress = PROGRESS_OF_PHASE[(await this.readings.newest(p.firingId)).phaseCode];
      if (progress !== 'waiting') throw new StudioError('The piece is already in the kiln.');
""",
      {'src/domain/model/FiringProgress.ts': "/** How far a firing has got, as the pickup page tells students. */\n"
       "export type FiringProgress = 'waiting' | 'firing' | 'cooling' | 'finished' | 'failed';\n"})

# hxpb1-q2 (negative, coarser): a domain switch into six steps (the two pre-heat phases are one studio step).
hxpb1('hxpb1-q2',
      "import { firingStepOf } from '../../../domain/model/FiringStep';\n",
      """    const step = firingStepOf((await this.readings.newest(p.firingId)).phaseCode);
    switch (step) {
      case 'booked': return { pieceId, status: 'WAITING' };
      case 'heating':
      case 'soaking':
        return { pieceId, status: 'IN_THE_KILN' };
      case 'cooling': return { pieceId, status: 'COOLING_DOWN' };
      case 'ready': return { pieceId, status: 'READY_FOR_PICKUP' };
      case 'failed': return { pieceId, status: 'FIRING_FAILED' };
    }
""",
      """      const step = firingStepOf((await this.readings.newest(p.firingId)).phaseCode);
      if (step !== 'booked') throw new StudioError('The piece is already in the kiln.');
""",
      {'src/domain/model/FiringStep.ts': """/** The steps of a firing the studio tells apart. */
export type FiringStep = 'booked' | 'heating' | 'soaking' | 'cooling' | 'ready' | 'failed';

/** The studio step for the phase text a kiln reading carries. */
export function firingStepOf(phaseCode: string): FiringStep {
  switch (phaseCode) {
    case 'scheduled':
    case 'candling':
      return 'booked';
    case 'ramping': return 'heating';
    case 'holding': return 'soaking';
    case 'cooling': return 'cooling';
    case 'complete': return 'ready';
    default: return 'failed';
  }
}
"""})

# hxpb1-q3 (negative, twin): a one-for-one renamed enum filled by a core table, and ARCHITECTURE.md names every member
# as a studio stage with its own rule (the SEM-GATE twin glossary, the same seven stage words).
Q3_GLOSSARY = """
## Studio glossary: firing stages

The studio's firing book distinguishes seven stages of a firing, and each one carries a studio rule.

- **queued**: the firing is booked but the kiln has not started; a student may still take a piece back.
- **drying**: the low drying hold that drives the last water out; a student may still take a piece back, and the
  studio lets the kiln door be opened once to add a forgotten piece.
- **heating**: the climb to peak; the kiln room is closed to students.
- **soaking**: the hold at peak; the technician logs the cone reading at the start and the end of it.
- **easing**: the slow cool-down; the pickup page shows cooling down and the door stays shut below the studio's
  safe-touch line.
- **done**: the kiln is cold and unloaded; pieces wait on the pickup shelf for seven days.
- **broken**: the firing failed; the technician inspects the kiln and the studio offers a free re-fire.
"""
hxpb1('hxpb1-q3',
      "import { FiringStage, STAGE_OF_PHASE } from '../../../domain/model/FiringStage';\n",
      """    const stage = STAGE_OF_PHASE[(await this.readings.newest(p.firingId)).phaseCode];
    if (stage === FiringStage.Queued || stage === FiringStage.Drying) return { pieceId, status: 'WAITING' };
    if (stage === FiringStage.Heating || stage === FiringStage.Soaking) return { pieceId, status: 'IN_THE_KILN' };
    if (stage === FiringStage.Easing) return { pieceId, status: 'COOLING_DOWN' };
    if (stage === FiringStage.Done) return { pieceId, status: 'READY_FOR_PICKUP' };
    return { pieceId, status: 'FIRING_FAILED' };
""",
      """      const stage = STAGE_OF_PHASE[(await this.readings.newest(p.firingId)).phaseCode];
      if (stage !== FiringStage.Queued && stage !== FiringStage.Drying) throw new StudioError('The piece is already in the kiln.');
""",
      {'src/domain/model/FiringStage.ts': """/** The firing stages of the studio's firing book (ARCHITECTURE.md, studio glossary). */
export enum FiringStage {
  Queued = 'queued',
  Drying = 'drying',
  Heating = 'heating',
  Soaking = 'soaking',
  Easing = 'easing',
  Done = 'done',
  Broken = 'broken',
}

/** The stage for the phase text a kiln reading carries. */
export const STAGE_OF_PHASE: Readonly<Record<string, FiringStage>> = {
  scheduled: FiringStage.Queued,
  candling: FiringStage.Drying,
  ramping: FiringStage.Heating,
  holding: FiringStage.Soaking,
  cooling: FiringStage.Easing,
  complete: FiringStage.Done,
  faulted: FiringStage.Broken,
};
"""},
      Q3_GLOSSARY)

# hxpb1-q4 (negative, twin): the cast of the shortcut, but the studio's own text names the seven phases as its stages.
Q4_GLOSSARY = """
## Studio glossary: firing phases

The studio runs its firing book on seven phases, the words the technicians and students use, and each carries a rule.

- **scheduled**: the firing is booked; a student may still take a piece back.
- **candling**: the overnight low hold that dries the ware; a student may still take a piece back.
- **ramping**: the climb to peak; the kiln room is closed to students.
- **holding**: the soak at peak; the technician logs the cone reading at its start and end.
- **cooling**: the slow cool-down; the door stays shut below the safe-touch line.
- **complete**: the kiln is cold and unloaded; pieces wait on the pickup shelf for seven days.
- **faulted**: the firing failed; the technician inspects the kiln and the studio offers a free re-fire.
"""
hxpb1('hxpb1-q4',
      """/** The studio's firing phases (ARCHITECTURE.md, studio glossary). */
type FiringPhase = 'scheduled' | 'candling' | 'ramping' | 'holding' | 'cooling' | 'complete' | 'faulted';
""",
      P1_STATUS.replace('as KilnPhase', 'as FiringPhase'),
      P1_WITHDRAW.replace('as KilnPhase', 'as FiringPhase'),
      None, Q4_GLOSSARY)

# ── hxpb2-translation-portal: vendor JobState posted claimed drafting proofreading delivered disputed ──
P2_SVC = 'src/application/services/jobs/TranslationOrderService.ts'
P2_DECL = """/** The marketplace's job states, as we keep them. */
type MarketState = 'posted' | 'claimed' | 'drafting' | 'proofreading' | 'delivered' | 'disputed';

const SHOWN: Record<MarketState, string> = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'BEING_CHECKED',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
};
"""
P2_PROGRESS = """    const state = (await this.lookup.snapshot(order.jobId)).stateCode as MarketState;
    return { orderNo, stage: SHOWN[state] };
"""
P2_INVOICE = """    const state = order.jobId === undefined ? null : (await this.lookup.snapshot(order.jobId)).stateCode;
    if (state !== 'delivered') throw new BureauError('The translation is not finished yet.');
"""


def hxpb2(case, decl, progress, invoice, files=None, arch=None):
    edit(case, P2_SVC, [(P2_DECL, decl), (P2_PROGRESS, progress), (P2_INVOICE, invoice)])
    for rel, text in (files or {}).items():
        write(case, rel, text)
    if arch is not None:
        with open(os.path.join(ROOT, case, 'tree', 'ARCHITECTURE.md'), 'a') as f:
            f.write(arch)


# hxpb2-p1 (positive, table in a domain file into a renamed enum).
hxpb2('hxpb2-p1',
      """import { ORDER_STEP_OF, OrderStep } from '../../../domain/model/OrderStep';

const SHOWN: Record<OrderStep, string> = {
  [OrderStep.Listed]: 'FINDING_TRANSLATOR',
  [OrderStep.Picked]: 'IN_TRANSLATION',
  [OrderStep.Writing]: 'IN_TRANSLATION',
  [OrderStep.Checking]: 'BEING_CHECKED',
  [OrderStep.Shipped]: 'READY_TO_DOWNLOAD',
  [OrderStep.Contested]: 'ON_HOLD',
};
""",
      """    const step = ORDER_STEP_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    return { orderNo, stage: step === undefined ? 'ON_HOLD' : SHOWN[step] };
""",
      """    const step = order.jobId === undefined ? undefined : ORDER_STEP_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    if (step !== OrderStep.Shipped) throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/OrderStep.ts': """/** Where a translation order's job is. */
export enum OrderStep {
  Listed = 'listed',
  Picked = 'picked',
  Writing = 'writing',
  Checking = 'checking',
  Shipped = 'shipped',
  Contested = 'contested',
}

/** The step for the state text a job snapshot carries. */
export const ORDER_STEP_OF: Readonly<Record<string, OrderStep | undefined>> = {
  posted: OrderStep.Listed,
  claimed: OrderStep.Picked,
  drafting: OrderStep.Writing,
  proofreading: OrderStep.Checking,
  delivered: OrderStep.Shipped,
  disputed: OrderStep.Contested,
};
"""})

# hxpb2-p2 (positive, cast): an exported same-spelling copy in a domain file, cast in the service, switched on.
hxpb2('hxpb2-p2',
      "import type { JobState } from '../../../domain/model/JobState';\n",
      """    const state = (await this.lookup.snapshot(order.jobId)).stateCode as JobState;
    switch (state) {
      case 'posted': return { orderNo, stage: 'FINDING_TRANSLATOR' };
      case 'claimed':
      case 'drafting':
        return { orderNo, stage: 'IN_TRANSLATION' };
      case 'proofreading': return { orderNo, stage: 'BEING_CHECKED' };
      case 'delivered': return { orderNo, stage: 'READY_TO_DOWNLOAD' };
      case 'disputed': return { orderNo, stage: 'ON_HOLD' };
    }
""",
      """    const state = order.jobId === undefined ? null : (await this.lookup.snapshot(order.jobId)).stateCode as JobState;
    if (state !== 'delivered') throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/JobState.ts': "/** Where a marketplace job is. */\n"
       "export type JobState = 'posted' | 'claimed' | 'drafting' | 'proofreading' | 'delivered' | 'disputed';\n"})

# hxpb2-p3 (positive, if chain in a domain function into a renamed union, one branch per state).
hxpb2('hxpb2-p3',
      "import { jobPhaseOf } from '../../../domain/model/JobPhase';\n",
      """    const phase = jobPhaseOf((await this.lookup.snapshot(order.jobId)).stateCode);
    if (phase === 'advertised') return { orderNo, stage: 'FINDING_TRANSLATOR' };
    if (phase === 'accepted' || phase === 'inDraft') return { orderNo, stage: 'IN_TRANSLATION' };
    if (phase === 'inProof') return { orderNo, stage: 'BEING_CHECKED' };
    if (phase === 'handedOver') return { orderNo, stage: 'READY_TO_DOWNLOAD' };
    return { orderNo, stage: 'ON_HOLD' };
""",
      """    const phase = order.jobId === undefined ? null : jobPhaseOf((await this.lookup.snapshot(order.jobId)).stateCode);
    if (phase !== 'handedOver') throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/JobPhase.ts': """/** The phase of a marketplace job. */
export type JobPhase = 'advertised' | 'accepted' | 'inDraft' | 'inProof' | 'handedOver' | 'challenged';

/** The phase for the state text a job snapshot carries. */
export function jobPhaseOf(stateCode: string): JobPhase {
  if (stateCode === 'posted') return 'advertised';
  if (stateCode === 'claimed') return 'accepted';
  if (stateCode === 'drafting') return 'inDraft';
  if (stateCode === 'proofreading') return 'inProof';
  if (stateCode === 'delivered') return 'handedOver';
  if (stateCode === 'disputed') return 'challenged';
  throw new Error('unknown job state ' + stateCode);
}
"""})

# hxpb2-p4 (positive, Map in the service into a const object of renamed members).
hxpb2('hxpb2-p4',
      """/** Where a job stands. */
const JobStage = { Open: 'open', Taken: 'taken', Typing: 'typing', Proofing: 'proofing', Sent: 'sent', Contested: 'contested' } as const;
type JobStage = (typeof JobStage)[keyof typeof JobStage];

const STAGE_OF_STATE = new Map<string, JobStage>([
  ['posted', JobStage.Open], ['claimed', JobStage.Taken], ['drafting', JobStage.Typing],
  ['proofreading', JobStage.Proofing], ['delivered', JobStage.Sent], ['disputed', JobStage.Contested],
]);

const SHOWN: Record<JobStage, string> = {
  open: 'FINDING_TRANSLATOR', taken: 'IN_TRANSLATION', typing: 'IN_TRANSLATION', proofing: 'BEING_CHECKED', sent: 'READY_TO_DOWNLOAD', contested: 'ON_HOLD',
};
""",
      """    const stage = STAGE_OF_STATE.get((await this.lookup.snapshot(order.jobId)).stateCode);
    return { orderNo, stage: stage === undefined ? 'ON_HOLD' : SHOWN[stage] };
""",
      """    const stage = order.jobId === undefined ? undefined : STAGE_OF_STATE.get((await this.lookup.snapshot(order.jobId)).stateCode);
    if (stage !== JobStage.Sent) throw new BureauError('The translation is not finished yet.');
""")

# hxpb2-p5 (positive, conditional chain in a private helper into a renamed union).
hxpb2('hxpb2-p5',
      """/** Where a job is, in the portal's words. */
type WorkState = 'waiting' | 'assigned' | 'translating' | 'reviewing' | 'finished' | 'contested';

const workStateOf = (code: string): WorkState =>
  code === 'posted' ? 'waiting'
    : code === 'claimed' ? 'assigned'
    : code === 'drafting' ? 'translating'
    : code === 'proofreading' ? 'reviewing'
    : code === 'delivered' ? 'finished'
    : 'contested';

const SHOWN: Record<WorkState, string> = {
  waiting: 'FINDING_TRANSLATOR', assigned: 'IN_TRANSLATION', translating: 'IN_TRANSLATION', reviewing: 'BEING_CHECKED', finished: 'READY_TO_DOWNLOAD', contested: 'ON_HOLD',
};
""",
      """    const ws = workStateOf((await this.lookup.snapshot(order.jobId)).stateCode);
    return { orderNo, stage: SHOWN[ws] };
""",
      """    const ws = order.jobId === undefined ? null : workStateOf((await this.lookup.snapshot(order.jobId)).stateCode);
    if (ws !== 'finished') throw new BureauError('The translation is not finished yet.');
""")

# hxpb2-q1 (negative, coarser): a core table into the bureau's five-step progress (the clean set).
hxpb2('hxpb2-q1',
      """import type { JobProgress } from '../../../domain/model/JobProgress';

const PROGRESS_OF_STATE: Readonly<Record<string, JobProgress | undefined>> = {
  posted: 'unassigned', claimed: 'translating', drafting: 'translating', proofreading: 'checking', delivered: 'done', disputed: 'onHold',
};

/** What the client portal shows for each step of a translation. */
const SHOWN: Record<JobProgress, string> = {
  unassigned: 'FINDING_TRANSLATOR', translating: 'IN_TRANSLATION', checking: 'BEING_CHECKED', done: 'READY_TO_DOWNLOAD', onHold: 'ON_HOLD',
};
""",
      """    const progress = PROGRESS_OF_STATE[(await this.lookup.snapshot(order.jobId)).stateCode] ?? 'onHold';
    return { orderNo, stage: SHOWN[progress] };
""",
      """    const progress = order.jobId === undefined ? undefined : PROGRESS_OF_STATE[(await this.lookup.snapshot(order.jobId)).stateCode];
    if (progress !== 'done') throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/JobProgress.ts': "/** How far a translation has got, as the client portal tells the client. */\n"
       "export type JobProgress = 'unassigned' | 'translating' | 'checking' | 'done' | 'onHold';\n"})

# hxpb2-q2 (negative, coarser): an if chain in a domain function into five portal steps (claimed and drafting are one).
hxpb2('hxpb2-q2',
      "import { portalStepOf } from '../../../domain/model/PortalStep';\n",
      """    const step = portalStepOf((await this.lookup.snapshot(order.jobId)).stateCode);
    if (step === 'unclaimed') return { orderNo, stage: 'FINDING_TRANSLATOR' };
    if (step === 'inWork') return { orderNo, stage: 'IN_TRANSLATION' };
    if (step === 'inReview') return { orderNo, stage: 'BEING_CHECKED' };
    if (step === 'complete') return { orderNo, stage: 'READY_TO_DOWNLOAD' };
    return { orderNo, stage: 'ON_HOLD' };
""",
      """    const step = order.jobId === undefined ? null : portalStepOf((await this.lookup.snapshot(order.jobId)).stateCode);
    if (step !== 'complete') throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/PortalStep.ts': """/** The steps of an order the client portal tells apart. */
export type PortalStep = 'unclaimed' | 'inWork' | 'inReview' | 'complete' | 'paused';

/** The portal step for the state text a job snapshot carries. */
export function portalStepOf(stateCode: string): PortalStep {
  if (stateCode === 'posted') return 'unclaimed';
  if (stateCode === 'claimed' || stateCode === 'drafting') return 'inWork';
  if (stateCode === 'proofreading') return 'inReview';
  if (stateCode === 'delivered') return 'complete';
  return 'paused';
}
"""})

# hxpb2-q3 (negative, twin): a one-for-one renamed enum filled by a core table, and ARCHITECTURE.md names every member
# as a bureau stage with its own rule.
hxpb2('hxpb2-q3',
      """import { BUREAU_STAGE_OF, BureauStage } from '../../../domain/model/BureauStage';

const SHOWN: Record<BureauStage, string> = {
  [BureauStage.Offered]: 'FINDING_TRANSLATOR',
  [BureauStage.Assigned]: 'IN_TRANSLATION',
  [BureauStage.Drafting]: 'IN_TRANSLATION',
  [BureauStage.Proofing]: 'BEING_CHECKED',
  [BureauStage.Delivered]: 'READY_TO_DOWNLOAD',
  [BureauStage.Queried]: 'ON_HOLD',
};
""",
      """    const stage = BUREAU_STAGE_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    return { orderNo, stage: stage === undefined ? 'ON_HOLD' : SHOWN[stage] };
""",
      """    const stage = order.jobId === undefined ? undefined : BUREAU_STAGE_OF[(await this.lookup.snapshot(order.jobId)).stateCode];
    if (stage !== BureauStage.Delivered) throw new BureauError('The translation is not finished yet.');
""",
      {'src/domain/model/BureauStage.ts': """/** The stages of the bureau's order book (ARCHITECTURE.md, bureau glossary). */
export enum BureauStage {
  Offered = 'offered',
  Assigned = 'assigned',
  Drafting = 'drafting',
  Proofing = 'proofing',
  Delivered = 'delivered',
  Queried = 'queried',
}

/** The stage for the state text a job snapshot carries. */
export const BUREAU_STAGE_OF: Readonly<Record<string, BureauStage | undefined>> = {
  posted: BureauStage.Offered,
  claimed: BureauStage.Assigned,
  drafting: BureauStage.Drafting,
  proofreading: BureauStage.Proofing,
  delivered: BureauStage.Delivered,
  disputed: BureauStage.Queried,
};
"""},
      """
## Bureau glossary: order stages

The bureau's order book distinguishes six stages of an order, and each one carries a bureau rule.

- **offered**: the job is on the marketplace and no translator has it yet; the client may still change the brief.
- **assigned**: a translator has taken the job; the brief is frozen and the bureau sends the glossary pack.
- **drafting**: the translator is writing; the client may ask a question once through the bureau.
- **proofing**: a second linguist checks the text; the project manager signs it off.
- **delivered**: the file is with the bureau; the invoice goes out the same day.
- **queried**: the client or the translator has raised a dispute; the project manager calls both within a day.
""")

# hxpb2-q4 (negative, twin): the cast of the shortcut, but the bureau's own text names the six states as its stages.
hxpb2('hxpb2-q4',
      """/** The bureau's order stages (ARCHITECTURE.md, bureau glossary). */
type OrderStage = 'posted' | 'claimed' | 'drafting' | 'proofreading' | 'delivered' | 'disputed';

const SHOWN: Record<OrderStage, string> = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'BEING_CHECKED',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
};
""",
      P2_PROGRESS.replace('as MarketState', 'as OrderStage'),
      P2_INVOICE,
      None,
      """
## Bureau glossary: order stages

The bureau runs its order book on six stages, the words its project managers use, and each carries a rule.

- **posted**: the job is out to translators; the client may still change the brief.
- **claimed**: a translator has taken the job; the brief is frozen and the bureau sends the glossary pack.
- **drafting**: the translator is writing; the client may ask a question once through the bureau.
- **proofreading**: a second linguist checks the text; the project manager signs it off.
- **delivered**: the file is with the bureau; the invoice goes out the same day.
- **disputed**: the client or the translator has raised a dispute; the project manager calls both within a day.
""")
print('built')
