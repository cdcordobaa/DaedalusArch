/**
 * Deterministic fix hints (v1.3, Docs/v1.3/fix-hints.md). A hint is computed from a blocking finding, the spec's layer
 * model and, when one is at hand, the extracted graph. No LLM is involved, and no rule text or Cypher template is read
 * or changed: the hint restates what the finding already says and adds where the code should live and the smallest
 * structural change that removes the violating edge.
 */

/** Rule families; one template each (`templates.ts`). */
export type FixHintFamily =
  | 'dependency-direction'
  | 'layer-skip'
  | 'cycle'
  | 'forbidden-package'
  | 'held-infrastructure'
  | 'missing-port'
  | 'context-membership'
  | 'context-boundary'
  | 'aggregate-boundary'
  | 'aggregate-repository'
  | 'value-object-mutability';

/** The minimal structural change a hint proposes. */
export type FixAction =
  | 'use-existing-port'
  | 'introduce-port'
  | 'move-file'
  | 'move-declaration'
  | 'lift-to-caller'
  | 'route-through'
  | 'break-cycle'
  | 'replace-with-own-type'
  | 'extract-adapter'
  | 'implement-port'
  | 'reference-root'
  | 'use-public-api'
  | 'remove-repository'
  | 'make-immutable';

/**
 * One step of the graph edit a hint stands for, over project-relative paths. The edit is what an agent would change in
 * the code, stated on the graph; `scripts/v1.3/fix-hints-eval.ts` applies it to the ingested graph and re-runs the rule.
 * `to` of an import is a file path, or a package name when `package` is set.
 */
export type GraphEditOp =
  | { readonly op: 'remove-import'; readonly from: string; readonly to: string; readonly package?: true }
  | {
      readonly op: 'add-import';
      readonly from: string;
      readonly to: string;
      readonly package?: true;
      readonly typeOnly?: true;
      /** RE_EXPORTS instead of IMPORTS (a barrel publishing the file). */
      readonly reExport?: true;
      /** The resolved edge an import through a barrel also yields (ADR-V13-01); the literal view drops it. */
      readonly viaReExport?: true;
      /** The literal edge to a barrel that exists only because of the re-export (ADR-V13-01); the resolved view drops it. */
      readonly reExportHop?: true;
    }
  | {
      readonly op: 'add-file';
      readonly path: string;
      readonly layer: string | null;
      readonly declares?: { readonly kind: 'Interface' | 'Class'; readonly name: string };
    }
  | { readonly op: 'move-file'; readonly from: string; readonly to: string; readonly layer: string | null }
  | { readonly op: 'remove-file'; readonly path: string }
  | {
      readonly op: 'add-implements';
      readonly classFile: string;
      readonly className: string;
      readonly interfaceFile: string;
      readonly interfaceName: string;
    }
  | {
      /** The class's CONSTRUCTOR_INJECTS / FLOWS_TO edges to `fromFile` are re-pointed at the interface. */
      readonly op: 'redirect-holding';
      readonly classFile: string;
      readonly className: string;
      readonly fromFile: string;
      readonly interfaceFile: string;
      readonly interfaceName: string;
    }
  | { readonly op: 'make-immutable'; readonly classFile: string; readonly className: string };

export interface FixHint {
  readonly ruleId: string;
  /** Template name of the rule (dependency-direction, core-isolation, ...). */
  readonly ruleName: string;
  readonly family: FixHintFamily;
  /** What is wrong, in one plain sentence. */
  readonly problem: string;
  readonly breaks: {
    /** The dependency or fact that breaks the rule, e.g. `src/a.ts (domain) -> src/b.ts (infrastructure)`. */
    readonly dependency: string;
    /** The allowed-dependency rule it breaks, read from the spec's layer model. */
    readonly rule: string;
  };
  /** Where the code should live instead: a layer of the spec and a folder that the layer's globs cover. */
  readonly target: {
    readonly layer: string | null;
    readonly folder: string | null;
    /** The concrete file the fix creates, moves to or depends on, when there is one. */
    readonly path?: string;
  };
  readonly fix: { readonly action: FixAction; readonly text: string };
  readonly edit: readonly GraphEditOp[];
  /** `graph+spec` when graph facts (declarations, importers, IMPLEMENTS) chose the fix; `spec` otherwise. */
  readonly basis: 'graph+spec' | 'spec';
}

/** The finding a hint is built for (the fields every report violation and MCP finding can supply). */
export interface HintFinding {
  readonly ruleId: string;
  /** Project-relative file of the finding (for a cycle, the comma-joined cycle the report carries). */
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly isTypeOnly?: boolean;
  /** Imported names of the edge, when known (MCP scan, graph). */
  readonly importedNames?: readonly string[];
}

/** A report's hint entry: the hint plus the id of the violation it is for. */
export interface ReportFixHint extends FixHint {
  readonly violationId: string;
  readonly filePath: string;
  readonly targetPath?: string;
}
