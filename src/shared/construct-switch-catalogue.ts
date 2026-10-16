/**
 * v1.3 construct decisions (`Docs/v1.3/construct-decisions.md`, 25 questions): what each option does and what it needs
 * from the author. The data behind the switch file (`construct-switches.ts`), the answer script
 * (`scripts/v1.3/apply-construct-answers.ts`) and the switch implementation (`src/construct-switches/`).
 *
 * Option A is always the status quo (the after-member-facts tool). An option is `no-code` when it is the status quo,
 * a confirmation or documentation only; `code` when the switch changes the compiled rules, the rows, a tier or a
 * preset. No option edits the sealed tier table (`Docs/v1.3/rule-tiers.md`): a tier change is a switch-controlled
 * override that names the ADR the author must write and sign (`adr.kind === 'tier'`).
 */

export const CONSTRUCT_QUESTION_IDS = [
  'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13',
  'Q14', 'Q15', 'Q16', 'Q17', 'Q18', 'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24', 'Q25',
] as const;
export type ConstructQuestionId = (typeof CONSTRUCT_QUESTION_IDS)[number];

export const CONSTRUCT_OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type ConstructOption = (typeof CONSTRUCT_OPTION_LETTERS)[number];

export type ConstructOptionKind = 'no-code' | 'code';

/** Where an option acts. `scoring`: the reference scorer only (the pipeline already reports it, or it is a report). */
export type ConstructMechanism = 'compile' | 'rows' | 'tier' | 'preset' | 'scoring';

/**
 * What the author must write before the answer is sealed.
 * - `tier`: a tier change of a sealed row (or a new tier row); needs a construct reason (`rule-tiers.md`, first paragraph).
 * - `applicability`: a rule is made (not) applicable to a style, as ADR-V13-02 does.
 * - `rule`: a rule's definition (its unit, scope or reach) changes; recorded in ADR-V13-03 "construct decisions".
 * - `preset`: a preset addition; needs one development-set run before the hold-out and no second tuning loop.
 * - `policy`: a reporting policy (the N/A half of Q8 and Q14), recorded in ADR-V13-03.
 * - `note`: a caveat or a note to state in ADR-V13-03; nothing to sign beyond it.
 */
export interface ConstructAdr {
  readonly kind: 'tier' | 'applicability' | 'rule' | 'preset' | 'policy' | 'note';
  readonly text: string;
}

export interface ConstructOptionSpec {
  readonly kind: ConstructOptionKind;
  readonly summary: string;
  readonly mechanisms: readonly ConstructMechanism[];
  readonly adr?: readonly ConstructAdr[];
}

export interface ConstructQuestionSpec {
  readonly id: ConstructQuestionId;
  readonly title: string;
  readonly styles: readonly string[];
  readonly options: Readonly<Partial<Record<ConstructOption, ConstructOptionSpec>>>;
  /** Owed whichever option is chosen. */
  readonly actionItem?: string;
}

const A = (summary: string, adr?: readonly ConstructAdr[]): ConstructOptionSpec =>
  ({ kind: 'no-code', summary, mechanisms: [], ...(adr !== undefined ? { adr } : {}) });
const code = (summary: string, mechanisms: readonly ConstructMechanism[], adr?: readonly ConstructAdr[]): ConstructOptionSpec =>
  ({ kind: 'code', summary, mechanisms, ...(adr !== undefined ? { adr } : {}) });
const noCode = (summary: string, adr?: readonly ConstructAdr[]): ConstructOptionSpec =>
  ({ kind: 'no-code', summary, mechanisms: [], ...(adr !== undefined ? { adr } : {}) });

const tierAdr = (text: string): ConstructAdr => ({ kind: 'tier', text });
const ruleAdr = (text: string): ConstructAdr => ({ kind: 'rule', text });
const applicabilityAdr = (text: string): ConstructAdr => ({ kind: 'applicability', text });
const presetAdr = (text: string): ConstructAdr => ({ kind: 'preset', text });

export const CONSTRUCT_QUESTIONS: readonly ConstructQuestionSpec[] = [
  { id: 'Q1', title: 'FF-P06 not applicable to layered (ADR-V13-02)?', styles: ['layered'], options: {
    A: A('confirm: FF-P06 is not applicable to layered (ADR-V13-02 draft, already implemented)', [{ kind: 'applicability', text: 'sign ADR-V13-02 as drafted' }]),
    B: code('FF-P06 applies to layered again, as an advisory rule there', ['compile', 'tier'], [
      applicabilityAdr('withdraw ADR-V13-02: FF-P06 applies to layered'),
      tierAdr('FF-P06 advisory in layered (style-dependent tier, like FF-S03)'),
    ]),
    C: code('revert to v1.2E: FF-P06 applies to layered, blocking', ['compile'], [applicabilityAdr('withdraw ADR-V13-02: FF-P06 applies to layered, blocking')]),
  } },
  { id: 'Q2', title: 'Does a type-only import count as a dependency?', styles: ['clean-architecture', 'layered', 'nestjs', 'ddd'], options: {
    A: A('yes, type-only imports count'),
    B: code('no: a row that rests only on type-only import edges is dropped (edge rules and cycles)', ['rows'], [ruleAdr('every import-edge rule ignores edges whose every import is `import type`')]),
  } },
  { id: 'Q3', title: 'Is a file cycle inside one layer an FF-S02 violation?', styles: ['clean-architecture', 'layered', 'hexagonal'], options: {
    A: A('yes, every file cycle is blocking'),
    B: code('no: only cycles that cross a layer or a module (nestjs feature folder, ddd context) count', ['rows'], [ruleAdr('FF-S02 unit is the component (layer or module): in-component cycles are outside the rule')]),
    C: code('both count; a cycle inside one layer and module is advisory, a crossing cycle blocking', ['tier'], [tierAdr('FF-S02 split: in-component file cycles advisory (proxy for ADP), crossing cycles blocking (Martin 2017, ch. 13-14)')]),
  } },
  { id: 'Q4', title: 'Is a layer-level cycle with no file cycle FF-S02?', styles: ['clean-architecture', 'layered'], options: {
    A: A('no'),
    B: code('yes: an edge against the allowed direction between two layers that already depend on each other is an FF-S02 row', ['rows'], [ruleAdr('FF-S02 is also computed on the layer graph')]),
  } },
  { id: 'Q5', title: 'Adapter -> adapter: tier and rule id', styles: ['hexagonal', 'ddd'], options: {
    A: A('FF-S03 layer-skip-graph, advisory (as sealed)'),
    B: code('FF-S03 made blocking in hexagonal and ddd', ['tier'], [tierAdr('FF-S03 blocking in hexagonal and ddd (Cockburn 2005: adapters talk only through ports)')]),
    C: code('the adapter -> adapter rows are reported under FF-S01 (blocking); FF-S03 no longer reports them', ['rows'], [ruleAdr('adapter -> adapter edges are FF-S01 findings in hexagonal and ddd (P2: FF-S03 drops them)')]),
    D: code('new rule FF-S05 adapter-isolation (blocking in hexagonal and ddd) owns the adapter -> adapter rows; FF-S03 no longer reports them', ['compile', 'rows', 'tier'], [
      ruleAdr('new rule FF-S05 adapter-isolation in the hexagonal library (and the ddd composed layering)'),
      tierAdr('new tier row: FF-S05 adapter-isolation blocking in hexagonal and ddd'),
    ]),
  } },
  { id: 'Q6', title: 'Does hexagonal core-isolation (FF-S04) cover the application layer?', styles: ['hexagonal'], options: {
    A: A('no: the core is the domain only'),
    B: code('yes: core = domain + application; application -> adapter rows added, domain -> application rows dropped', ['rows'], [ruleAdr('hexagonal FF-S04 binds the application core (domain + application layers)')]),
  } },
  { id: 'Q7', title: 'Does FF-P03 cover a consumer of a concrete adapter?', styles: ['nestjs', 'hexagonal'], options: {
    A: A('no'),
    B: code('yes: a file outside the adapter layer and the composition roots that imports or injects a concrete adapter is an FF-P03 row', ['rows'], [ruleAdr('FF-P03 also reports consumers of concrete adapters')]),
  } },
  { id: 'Q8', title: 'Do field initialisers count for FF-P06?', styles: ['clean-architecture', 'nestjs', 'hexagonal'], options: {
    A: A('yes: the FLOWS_TO rows are scored as blocking by the reference scorer (the pipeline verdict already sets them N/A)', [{ kind: 'tier', text: 'amend the sealed FF-P06 "partial" note: the FLOWS_TO half is blocking' }]),
    B: code('sealed text: the FLOWS_TO half is reported N/A with its denominator and "recall unestimated", not scored', ['scoring'], [{ kind: 'policy', text: 'N/A-half policy (with Q14): sealed tier kept, FLOWS_TO half N/A, recall unestimated' }]),
  } },
  { id: 'Q9', title: 'Missing implements under structural typing: FF-P03? FF-P02?', styles: ['clean-architecture', 'nestjs', 'hexagonal'], options: {
    A: A('FF-P03 yes, FF-P02 no'),
    B: code('FF-P03 and FF-P02: every FF-P03 row also gets an FF-P02 row on the implementer', ['rows'], [ruleAdr('a missing implements clause is also an FF-P02 finding')]),
    C: code('neither: an FF-P03 row is dropped when the class conforms to a port by its methods and is wired', ['rows'], [ruleAdr('FF-P03 accepts structural conformance plus wiring')]),
  } },
  { id: 'Q10', title: 'Does FF-P01 apply to the layered business layer?', styles: ['layered'], options: {
    A: A('yes, every declared framework'),
    B: code('only web/UI framework packages (CONSTRUCT_WEB_UI_PACKAGES)', ['rows'], [ruleAdr('FF-P01 in layered forbids web/UI framework packages only')]),
    C: code('FF-P01 not applicable to layered; a declared package-to-layer mapping (construct overlay) makes FF-S01 rows', ['compile', 'rows'], [
      applicabilityAdr('FF-P01 not applicable to layered (P1)'),
      ruleAdr('FF-S01 reads a declared package-to-layer mapping'),
    ]),
    D: code('FF-P01 not applicable to layered, no replacement', ['compile'], [applicabilityAdr('FF-P01 not applicable to layered (P1)')]),
  } },
  { id: 'Q11', title: 'Is domain -> application inside the core forbidden (hexagonal, ddd)?', styles: ['hexagonal', 'ddd'], options: {
    A: A('yes, by FF-S01 wherever the declaration splits domain from application'),
    B: code('no: FF-S01 and FF-S04 rows from a domain file to an application file are dropped', ['rows'], [ruleAdr('the hexagonal core is one unit: domain -> application is allowed')]),
  } },
  { id: 'Q12', title: 'In layered, is an upward adjacent import also FF-S03?', styles: ['layered'], options: {
    A: A('yes, both rules'),
    B: code('no: FF-S03 drops rows whose reverse transition is allowed', ['rows'], [ruleAdr('FF-S03 reports only downward edges that pass over a layer')]),
  } },
  { id: 'Q13', title: 'NestJS: may services import repositories (RDQ-2)?', styles: ['nestjs'],
    actionItem: 'fix the contradiction: ADR-V13-02 calls the NestJS preset "a Clean Architecture layering" (correct it under A or B; correct the preset comment under C) and re-check its FF-P06 conclusion',
    options: {
      A: A('the preset order; FF-P04 as it is'),
      B: code('the preset order; FF-P04 drops a row whose violating dependencies all lie below the use case in the declared order', ['rows'], [ruleAdr('FF-P04 follows the declared layer order')]),
      C: code('Clean order (domain, application, presentation, infrastructure) for nestjs', ['preset'], [presetAdr('nestjs preset layer order changed to the Clean order (infrastructure outermost)')]),
    } },
  { id: 'Q14', title: 'FF-DT03 tier', styles: ['ddd'], options: {
    A: A('blocking as sealed (with the member facts of #90 the accessor half is covered)', [{ kind: 'policy', text: 'N/A-half policy (with Q8)' }]),
    B: code('advisory until the extractor records member modifiers', ['tier'], [tierAdr('FF-DT03 advisory')]),
    C: noCode('blocking with member facts: already merged (#90, V13_COMPILE_OPTIONS.memberFacts); identical to A today', [{ kind: 'note', text: 'note in ADR-V13-03 that the N/A half is covered by the member facts' }]),
  } },
  { id: 'Q15', title: 'FF-DS01 tier', styles: ['ddd'], options: {
    A: A('keep blocking, defer the decision to hold-out evidence', [{ kind: 'note', text: 'state the invariant caveat: a rule with no sealed row can fail a verdict' }]),
    B: code('advisory, with its own row in the tier table by ADR', ['tier'], [tierAdr('FF-DS01 bounded-context-modules advisory (own row)')]),
  } },
  { id: 'Q16', title: 'Add FF-S02 to the DDD preset?', styles: ['ddd'], options: {
    A: A('no'),
    B: code('yes: FF-S02 no-cyclic-deps (blocking) is added to the ddd preset', ['preset'], [presetAdr('FF-S02 in the ddd preset; one development-set run before the hold-out, no second tuning loop')]),
  } },
  { id: 'Q17', title: 'DDD public API: literal specifier or resolved target?', styles: ['ddd'], options: {
    A: A('literal (fix 6)'),
    B: code('resolved: an import through a public barrel to an internal file is an FF-DS02 row', ['rows'], [ruleAdr('FF-DS02 reads the resolved target of a barrel import')]),
    C: code('literal, plus new advisory rule FF-DS03: a public-API barrel that re-exports an application-layer file', ['compile', 'rows'], [
      ruleAdr('new advisory rule FF-DS03 barrel-publishes-application'),
      tierAdr('new tier row: FF-DS03 advisory'),
    ]),
  } },
  { id: 'Q18', title: 'May a DDD anti-corruption layer import upstream internals?', styles: ['ddd'], options: {
    A: A('yes, as sealed'),
    B: code('no: an ACL file that imports another context outside its public API is an FF-DS02 row', ['rows'], [ruleAdr('FF-DS02 without the ACL exemption (changes the wording of the sealed bounded-context row)')]),
  } },
  { id: 'Q19', title: 'Aggregate boundary: does any import of an inner entity count?', styles: ['ddd'], options: {
    A: A('yes (stricter than Evans; say so in the thesis)'),
    B: code('no: an FF-DT01 row is kept only when a class of the importing file holds the inner entity (FLOWS_TO or CONSTRUCTOR_INJECTS)', ['rows'], [ruleAdr('FF-DT01 reports kept references only')]),
  } },
  { id: 'Q20', title: 'Does domain purity count transitive framework dependencies?', styles: ['nestjs'], options: {
    A: A('no, direct imports only'),
    B: code('yes: a domain file that reaches a forbidden package through project files is a domain-purity row', ['rows'], [ruleAdr('domain purity counts transitive package dependencies')]),
  } },
  { id: 'Q21', title: 'FF-DT05 tier', styles: ['ddd'], options: {
    A: A('advisory, as sealed'),
    B: code('blocking', ['tier'], [tierAdr('FF-DT05 domain-event-placement blocking (Vernon ch. 8)')]),
  } },
  { id: 'Q22', title: 'Does FF-P02 count sibling-service injection (RDQ-3)?', styles: ['nestjs'], options: {
    A: A('yes, every constructor dependency'),
    B: code('no: the ratio counts only dependencies in another layer (a narrowing of Martin\'s DIP)', ['rows'], [ruleAdr('FF-P02 measures DIP across layers only')]),
  } },
  { id: 'Q23', title: 'FF-P05: entity by layer or by name suffix?', styles: ['clean-architecture', 'nestjs'], options: {
    A: A('by name suffix'),
    B: code('by the declared domain layer: every domain-layer class is an entity for FF-P05 (reach unchanged)', ['rows'], [ruleAdr('FF-P05 selects entities by the declared domain layer')]),
  } },
  { id: 'Q24', title: 'Is an inward bypass of the use-case layer a finding?', styles: ['clean-architecture', 'nestjs', 'hexagonal', 'layered'], options: {
    A: A('no'),
    B: code('yes: a controller or inbound-adapter file that imports a domain file directly is an advisory FF-S03 row', ['compile', 'rows'], [ruleAdr('FF-S03 also reports inward bypasses of the use-case layer (advisory)')]),
  } },
  { id: 'Q25', title: 'Files outside the layer model: declare their roles in the presets?', styles: ['nestjs', 'clean-architecture', 'hexagonal', 'ddd'], options: {
    A: A('leave as is'),
    B: code('declare a composition-root role (main, test containers, *.module.ts) exempt from the layer rules', ['preset'], [presetAdr('composition-root role in the presets; one development-set run before the hold-out, no second tuning loop')]),
  } },
];

export const CONSTRUCT_QUESTION_BY_ID: ReadonlyMap<ConstructQuestionId, ConstructQuestionSpec> =
  new Map(CONSTRUCT_QUESTIONS.map((q) => [q.id, q]));

/** The option letters a question offers, in order. */
export function optionsOf(q: ConstructQuestionId): readonly ConstructOption[] {
  const spec = CONSTRUCT_QUESTION_BY_ID.get(q);
  return CONSTRUCT_OPTION_LETTERS.filter((o) => spec?.options[o] !== undefined);
}

/** The development-set re-run, after the answers are applied (Neo4j required; never run by a unit test). */
export const CONSTRUCT_RERUN_COMMANDS: readonly string[] = [
  'node --import tsx scripts/v1.3/ue-baseline-live.ts --out results/v1.3-reference/after-construct-answers',
  'node --import tsx scripts/v1.3/ue-graph.ts --out results/v1.3-reference/after-construct-answers',
  'node --import tsx scripts/v1.3/ue-score.ts --base results/v1.3-reference/after-construct-answers --blind <daedalus-sealed/v1.3-blind>',
];

/** The offline preview of the answers, from the after-member-facts rows (no Neo4j). */
export const CONSTRUCT_PREVIEW_COMMAND =
  'node --import tsx scripts/v1.3/construct-rescore.ts --base results/v1.3-reference/after-member-facts --out <dir>';
