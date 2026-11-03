"""SEM-GATE-3: builds the fresh form-C trees (zero model calls).

Each tree starts as a copy of a task reference tree (hxpb1 / hxpb2: `solutions/trap`; hxa2: `solutions/clean`) and this
script rewrites the files named below. Form C: the vendor's value reaches the core as text (the port field the task
already has) and the core consults an untyped lookup keyed by the vendor's own values (a `Record`, an `as const`
object, a `Map`, a switch or an equality chain); no core value set receives what the lookup returns. Run from the
repository root:

    python3 -I experiments/sem-gate-3/build-cases.py
"""
import os
import shutil

ROOT = os.path.join('experiments', 'sem-gate-3', 'cases')
HXPB1 = os.path.join('experiments', 'hx-study-set', 'part-b', 'hxpb1-pottery-kiln')
HXPB2 = os.path.join('experiments', 'hx-study-set', 'part-b', 'hxpb2-translation-portal')
HXA2 = os.path.join('experiments', 'hx-study-set', 'part-a', 'hxa2-canal-boats')


def base(case, src):
    t = os.path.join(ROOT, case, 'tree')
    if os.path.exists(t):
        shutil.rmtree(t)
    shutil.copytree(src, t)


def write(case, rel, text):
    p = os.path.join(ROOT, case, 'tree', rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(text)


def remove(case, rel):
    os.remove(os.path.join(ROOT, case, 'tree', rel))


def edit(case, rel, pairs):
    p = os.path.join(ROOT, case, 'tree', rel)
    s = open(p).read()
    for old, new in pairs:
        if old not in s:
            raise SystemExit(f'{case} {rel}: missing {old[:60]!r}')
        s = s.replace(old, new, 1)
    with open(p, 'w') as f:
        f.write(s)


def arch(case, text):
    with open(os.path.join(ROOT, case, 'tree', 'ARCHITECTURE.md'), 'a') as f:
        f.write(text)


# ── hxpb1-pottery-kiln: vendor KilnwisePhase SCHEDULED CANDLING RAMPING HOLDING COOLING COMPLETE FAULTED ──
# (the adapter copies the phase into KilnReading.phaseCode, lower-cased; the shortcut casts it to KilnPhase)
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
P1_WITHDRAW_TEXT = """      const phase = (await this.readings.newest(p.firingId)).phaseCode;
      if (phase !== 'scheduled' && phase !== 'candling') throw new StudioError('The piece is already in the kiln.');
"""


def hxpb1(case, decl, status, files=None, glossary=None):
    base(case, os.path.join(HXPB1, 'solutions', 'trap'))
    edit(case, P1_SVC, [(P1_DECL, decl), (P1_STATUS, status), (P1_WITHDRAW, P1_WITHDRAW_TEXT)])
    for rel, text in (files or {}).items():
        write(case, rel, text)
    if glossary is not None:
        arch(case, glossary)


# hxpb1-c1 (positive): an untyped Record in a domain file keyed by the vendor's upper-case phases; the service upper-cases
# the port text and indexes it.
hxpb1('hxpb1-c1',
      "import { PICKUP_WORD } from '../../../domain/model/pickupWords';\n",
      """    const word = PICKUP_WORD[(await this.readings.newest(p.firingId)).phaseCode.toUpperCase()];
    if (word === undefined) throw new StudioError('unknown kiln phase for ' + p.firingId);
    return { pieceId, status: word };
""",
      {'src/domain/model/pickupWords.ts': """/** The pickup page's word for each kiln phase. */
export const PICKUP_WORD: Readonly<Record<string, string | undefined>> = {
  SCHEDULED: 'WAITING',
  CANDLING: 'WAITING',
  RAMPING: 'IN_THE_KILN',
  HOLDING: 'IN_THE_KILN',
  COOLING: 'COOLING_DOWN',
  COMPLETE: 'READY_FOR_PICKUP',
  FAULTED: 'FIRING_FAILED',
};
"""})

# hxpb1-c2 (positive): the shortcut's switch with no type: the service switches on the port text itself.
hxpb1('hxpb1-c2',
      '',
      P1_STATUS.replace('.phaseCode as KilnPhase;', '.phaseCode;') + "    throw new StudioError('unknown kiln phase ' + phase);\n")

# hxpb1-c3 (positive): a module-level Map in the service, keyed by the lower-case phases, read with get.
hxpb1('hxpb1-c3',
      """const PICKUP = new Map<string, string>([
  ['scheduled', 'WAITING'], ['candling', 'WAITING'], ['ramping', 'IN_THE_KILN'], ['holding', 'IN_THE_KILN'],
  ['cooling', 'COOLING_DOWN'], ['complete', 'READY_FOR_PICKUP'], ['faulted', 'FIRING_FAILED'],
]);
""",
      """    const reading = await this.readings.newest(p.firingId);
    const status = PICKUP.get(reading.phaseCode);
    if (status === undefined) throw new StudioError('unknown kiln phase ' + reading.phaseCode);
    return { pieceId, status };
""")

# hxpb1-d1 (negative, twin of c1): the same table in the service, and the studio's own text names the seven phases as
# its stages, each with a rule (the SEM-GATE-2 q4 glossary).
P1_GLOSSARY = """
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
hxpb1('hxpb1-d1',
      """/** The pickup page's word for each of the studio's firing phases (ARCHITECTURE.md, studio glossary). */
const PICKUP_WORD: Readonly<Record<string, string | undefined>> = {
  scheduled: 'WAITING', candling: 'WAITING', ramping: 'IN_THE_KILN', holding: 'IN_THE_KILN',
  cooling: 'COOLING_DOWN', complete: 'READY_FOR_PICKUP', faulted: 'FIRING_FAILED',
};
""",
      """    const word = PICKUP_WORD[(await this.readings.newest(p.firingId)).phaseCode];
    if (word === undefined) throw new StudioError('unknown kiln phase for ' + p.firingId);
    return { pieceId, status: word };
""",
      None, P1_GLOSSARY)

# ── hxpb2-translation-portal: vendor JobState posted claimed drafting proofreading delivered disputed ──
# (the adapter copies the state into JobSnapshot.stateCode; the shortcut casts it to MarketState)
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


def hxpb2(case, decl, progress, files=None, glossary=None):
    base(case, os.path.join(HXPB2, 'solutions', 'trap'))
    edit(case, P2_SVC, [(P2_DECL, decl), (P2_PROGRESS, progress)])
    for rel, text in (files or {}).items():
        write(case, rel, text)
    if glossary is not None:
        arch(case, glossary)


# hxpb2-c1 (positive): an equality chain in a domain function on the state text (disputed falls to the last return).
hxpb2('hxpb2-c1',
      "import { portalWordOf } from '../../../domain/model/portalWords';\n",
      """    return { orderNo, stage: portalWordOf((await this.lookup.snapshot(order.jobId)).stateCode) };
""",
      {'src/domain/model/portalWords.ts': """/** The portal's word for where a marketplace job is. */
export function portalWordOf(stateCode: string): string {
  if (stateCode === 'posted') return 'FINDING_TRANSLATOR';
  if (stateCode === 'claimed' || stateCode === 'drafting') return 'IN_TRANSLATION';
  if (stateCode === 'proofreading') return 'BEING_CHECKED';
  if (stateCode === 'delivered') return 'READY_TO_DOWNLOAD';
  return 'ON_HOLD';
}
"""})

# hxpb2-c2 (positive): an `as const` object in the service, read through a Record view with the port text.
hxpb2('hxpb2-c2',
      """const SHOWN_FOR = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'BEING_CHECKED',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
} as const;
""",
      """    const snap = await this.lookup.snapshot(order.jobId);
    const stage = (SHOWN_FOR as Readonly<Record<string, string | undefined>>)[snap.stateCode];
    if (stage === undefined) throw new BureauError('unknown marketplace state ' + snap.stateCode);
    return { orderNo, stage };
""")

# hxpb2-d1 (negative, twin of the SEM-2 pilot table): an untyped Record keyed by the six states, and the bureau's own
# text names the six states as its stages, each with a rule (the SEM-GATE-2 q4 glossary).
P2_GLOSSARY = """
## Bureau glossary: order stages

The bureau runs its order book on six stages, the words its project managers use, and each carries a rule.

- **posted**: the job is out to translators; the client may still change the brief.
- **claimed**: a translator has taken the job; the brief is frozen and the bureau sends the glossary pack.
- **drafting**: the translator is writing; the client may ask a question once through the bureau.
- **proofreading**: a second linguist checks the text; the project manager signs it off.
- **delivered**: the file is with the bureau; the invoice goes out the same day.
- **disputed**: the client or the translator has raised a dispute; the project manager calls both within a day.
"""
hxpb2('hxpb2-d1',
      """/** The portal's word for each of the bureau's order stages (ARCHITECTURE.md, bureau glossary). */
const STAGES: Readonly<Record<string, string | undefined>> = {
  posted: 'FINDING_TRANSLATOR',
  claimed: 'IN_TRANSLATION',
  drafting: 'IN_TRANSLATION',
  proofreading: 'BEING_CHECKED',
  delivered: 'READY_TO_DOWNLOAD',
  disputed: 'ON_HOLD',
};
""",
      """    const s = await this.lookup.snapshot(order.jobId);
    const stage = STAGES[s.stateCode];
    if (stage === undefined) throw new BureauError('unknown marketplace state ' + s.stateCode);
    return { orderNo, stage };
""",
      None, P2_GLOSSARY)

# ── hxa2-canal-boats: vendor CovernestQuoteState QUOTED REFERRED BOUND DECLINED LAPSED ──
# hxa2-c1 (positive): from the clean tree, the quotes adapter no longer maps the quote state; the hire service looks the
# insurer's own word (`CoverQuote.insurerState`, already on the port) up in an untyped table of the five states.
base('hxa2-c1', os.path.join(HXA2, 'solutions', 'clean'))
remove('hxa2-c1', 'src/domain/model/CoverStanding.ts')
edit('hxa2-c1', 'src/domain/model/CoverQuote.ts', [
    ("import type { CoverStanding } from './CoverStanding';\n\n", ''),
    ('  readonly standing: CoverStanding;\n', '')])
edit('hxa2-c1', 'src/adapters/outbound/covernest/CovernestQuotesAdapter.ts', [
    ("import type { CovernestClient, CovernestQuoteState } from 'covernest-sdk';", "import type { CovernestClient } from 'covernest-sdk';"),
    ("import type { CoverStanding } from '../../../domain/model/CoverStanding';\n", ''),
    (', insurerState: q.state, standing: standingOf(q.state) };', ', insurerState: q.state };'),
    ("""
function standingOf(state: CovernestQuoteState): CoverStanding {
  switch (state) {
    case 'BOUND': return 'covered';
    case 'REFERRED': return 'in_review';
    default: return 'uncovered';
  }
}
""", '')])
edit('hxa2-c1', 'src/application/services/HireService.ts', [
    ("""export class HireService implements HireBoats {""", """/** Whether the hire is covered, for each insurer quote state. */
const STANDING_OF_QUOTE: Readonly<Record<string, string | undefined>> = {
  QUOTED: 'uncovered', REFERRED: 'in_review', BOUND: 'covered', DECLINED: 'uncovered', LAPSED: 'uncovered',
};

export class HireService implements HireBoats {"""),
    ("""    if (quote.standing === 'in_review') return { hireId: r.hireId, status: 'cover_in_review' };
    if (quote.standing !== 'covered') return""", """    const standing = STANDING_OF_QUOTE[quote.insurerState] ?? 'uncovered';
    if (standing === 'in_review') return { hireId: r.hireId, status: 'cover_in_review' };
    if (standing !== 'covered') return""")])

print('built')
