/**
 * The shape of each fix-hint template, in words (what `explain_violation` shows with hints on, and the table of
 * Docs/v1.3/fix-hints.md §2). The concrete hint of a finding is built by `templates.ts`; this text only names the
 * choices it makes, in order.
 */
import type { FixHintFamily } from './types.js';

export const FIX_HINT_TEMPLATES: Readonly<Record<FixHintFamily, string>> = Object.freeze({
  'dependency-direction':
    'Core source (domain/application, not layered): (a) depend on a port the target already implements, in a layer the source may import; (b) the target declares only types: move it to the innermost layer the source and all its importers may import; (c) introduce a port interface in the source layer that the target implements. Otherwise (layered, outer or lower layer reaching up, presentation target): lift the code that needs the target into a layer that may import both ends.',
  'layer-skip':
    'Closed layering, an inward import that skips a layer: route through the layer in between: the same-named type there (data shapes), else a file there that already imports the target, else a new <Stem>Service there. An upward or sideways step follows the dependency-direction template.',
  cycle:
    'Cut one edge of the cycle (an edge that breaks the layering first, then a type-only edge, then the edge that closes the cycle): declare what the importer uses as an interface <Name>Contract in a layer both ends may import; the importer depends on it and the imported file implements it.',
  'forbidden-package':
    'Type-only import: declare an own type in the same layer and convert the framework type in the adapter. Runtime import: move the framework-dependent code to an adapter in the infrastructure (web packages: presentation; DI packages: composition root) layer that the domain file may use or that may use it.',
  'held-infrastructure':
    'Hold the port instead of the infrastructure class: the port it already implements in the domain layer, else a new port interface in the domain layer that it implements; inject it from the composition root.',
  'missing-port':
    'Move a local interface the adapter implements into a port layer; else implement the existing core interface with the port name (InMemoryLoanRepository -> LoanRepository); else introduce that port interface in the port layer that holds the other ports.',
  'context-membership':
    'Move the file into the bounded context that uses it (the innermost layer its importers may import), or into the shared kernel when several contexts or none use it.',
  'context-boundary':
    'Import through the target context\'s public API file (re-export the name there if it is missing), or translate in the source context\'s anti-corruption layer.',
  'aggregate-boundary': 'Reference the aggregate root instead of the inner entity and reach the entity through the root.',
  'aggregate-repository': 'Remove the inner entity\'s repository; persist the entity through the aggregate root\'s repository and point callers there.',
  'value-object-mutability': 'Keep the value object in place and make it immutable: readonly fields, no setters, mutators return a new instance.',
});
