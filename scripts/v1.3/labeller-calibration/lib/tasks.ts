/**
 * v1.3 labeller calibration: the task definitions. This is the ONLY content that differs from our own labelling
 * procedure (Docs/v1.3/labeller-calibration-plan.md §4): the judge arm's rule and rubric, and the labeller arm's
 * definition and claim. Each definition paraphrases the dataset's own published definition (cited per task) so the
 * models judge the construct the human raters judged. The text is frozen by `TASKS_SHA256` in the plan; any edit is
 * a dated amendment.
 */
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';

export interface TaskDefinition {
  readonly key: string;
  /** Human-readable name as the dataset uses it. */
  readonly name: string;
  readonly unitKind: 'class' | 'method';
  /** Where the definition comes from (the dataset paper or its annotation guide). */
  readonly source: string;
  /** Judge arm (the frozen v1 template's `## Rule` and `## Rubric`). */
  readonly rule: string;
  readonly pass: string;
  readonly fail: string;
  readonly evidenceRequired: string;
  /** Labeller arm: the definition shown under `## Design rule`. */
  readonly definition: string;
}

export const TASKS: Readonly<Record<string, TaskDefinition>> = Object.freeze({
  blob: {
    key: 'blob', name: 'Blob (God Class)', unitKind: 'class',
    source: 'MLCQ (Madeyski and Lewowski, EASE 2020), after Brown et al. 1998 and Fowler 1999',
    rule: 'A class must not centralise the behaviour of its part of the system: it must not be a large, complex class that takes on many unrelated responsibilities and works mostly on data held by other classes.',
    pass: 'The class has one main responsibility, a size and complexity in proportion to it, and delegates work that belongs elsewhere.',
    fail: 'The class concentrates many unrelated responsibilities or much of the system\'s logic, is large and complex, and controls or uses the data of other classes instead of delegating.',
    evidenceRequired: 'Name the class and cite the methods or fields that show the unrelated responsibilities or the centralised control.',
    definition: '- One class, one responsibility: a class must not centralise behaviour by taking on many unrelated responsibilities, growing large and complex, and working mostly on data held by other classes (Blob, or God Class: Brown et al. 1998; Fowler 1999).',
  },
  'data-class': {
    key: 'data-class', name: 'Data Class', unitKind: 'class',
    source: 'MLCQ (Madeyski and Lewowski, EASE 2020), after Fowler 1999',
    rule: 'A class must carry behaviour for its own data: it must not be a mere holder of fields with accessors whose data is manipulated by other classes.',
    pass: 'The class has meaningful behaviour that operates on its own data, beyond getters, setters and trivial methods.',
    fail: 'The class mainly exposes fields, directly or through getters and setters, and has little or no behaviour of its own, so other classes do the work on its data.',
    evidenceRequired: 'Name the class and cite the fields and accessors, and say which behaviour, if any, it has.',
    definition: '- Behaviour lives with data: a class must not be a mere holder of fields and accessors whose data is manipulated by other classes (Data Class: Fowler 1999).',
  },
  'long-method': {
    key: 'long-method', name: 'Long Method', unitKind: 'method',
    source: 'MLCQ (Madeyski and Lewowski, EASE 2020), after Fowler 1999',
    rule: 'A method must stay short enough to be understood as one step: it must not be a long method that does several things which should be extracted into methods of their own.',
    pass: 'The method does one thing at one level of abstraction, and its length is justified by what it does.',
    fail: 'The method is long and does several distinct things, mixes levels of abstraction, or contains sections that should be extracted into their own methods.',
    evidenceRequired: 'Name the method and cite the sections that are distinct steps or should be extracted.',
    definition: '- Short methods: a method must not grow long and do several things that should be extracted into methods of their own (Long Method: Fowler 1999).',
  },
  'multifaceted-abstraction': {
    key: 'multifaceted-abstraction', name: 'Multifaceted Abstraction', unitKind: 'class',
    source: 'DACOS (Nandani et al., MSR 2023), after Suryanarayana, Samarthyam and Sharma 2014',
    rule: 'An abstraction must have a single, crisp responsibility: a class must not have more than one responsibility assigned to it.',
    pass: 'The class represents one concept and its members serve one responsibility.',
    fail: 'The class has more than one responsibility: groups of its members serve unrelated concerns.',
    evidenceRequired: 'Name the class and cite the groups of members that serve different responsibilities.',
    definition: '- Single responsibility: an abstraction must not have more than one responsibility assigned to it (Multifaceted Abstraction: Suryanarayana et al. 2014).',
  },
  'complex-method': {
    key: 'complex-method', name: 'Complex Method', unitKind: 'method',
    source: 'DACOS (Nandani et al., MSR 2023)',
    rule: 'A method must keep its control flow simple: it must not have high cyclomatic complexity from deeply nested or numerous branches.',
    pass: 'The method\'s branching is shallow and easy to follow.',
    fail: 'The method has many or deeply nested branches and loops that make its control flow hard to follow.',
    evidenceRequired: 'Name the method and cite the nested or numerous branches.',
    definition: '- Simple control flow: a method must not have high cyclomatic complexity from many or deeply nested branches (Complex Method).',
  },
});

/** Hash of every task definition (canonical JSON): recorded in the plan and in every result file. */
export function tasksSha256(): string {
  return createHash('sha256').update(canonicalJSON(TASKS)).digest('hex');
}

export function taskOf(key: string): TaskDefinition {
  const t = TASKS[key];
  if (t === undefined) throw new Error(`unknown calibration task '${key}'`);
  return t;
}
