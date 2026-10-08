/**
 * IMPORTS / RE_EXPORTS edge merger (FR-v1.2E-10, FR-v1.2E-34).
 *
 * Collects one occurrence per (statement, target) and emits one edge per
 * `(edgeType, sourceId, targetId)` (BR-U2-17) with the FR-10 merge rules
 * (BR-U2-18..21, BR-U2-23): `domain-entities.md` §2.4, §2.7, §3.1, §3.2 and
 * `business-logic-model.md` §4.
 */
import type { APGEdge, ImportEdgeProperties, ReExportEdgeProperties } from '../shared/types/apg.js';
import { generateEdgeId } from './id-generator.js';
import type { PackageRoot } from './package-node-factory.js';

export type ImportEdgeType = 'IMPORTS' | 'RE_EXPORTS';

/** One statement's contribution to one target (`domain-entities.md` §2.4). */
export interface ImportOccurrence {
  readonly edgeType: ImportEdgeType;
  readonly sourceFileNodeId: string;
  readonly target: { readonly kind: 'file'; readonly fileNodeId: string }
                 | { readonly kind: 'package'; readonly root: PackageRoot };
  /** Specifier as written in the statement. */
  readonly specifier: string;
  /** `getStartLineNumber()` of the statement (BR-U2-16), 1-based. */
  readonly line: number;
  /** Exported-name forms routed to this target (Q8 A); `[]` for a side-effect import. */
  readonly names: readonly string[];
  /** Decided per target from the specifiers routed to it (Q7 A). */
  readonly isTypeOnly: boolean;
}

interface SlotOccurrence {
  readonly specifier: string;
  readonly line: number;
  readonly seq: number;
  readonly names: readonly string[];
  readonly isTypeOnly: boolean;
}

interface MergeSlot {
  readonly edgeType: ImportEdgeType;
  readonly sourceId: string;
  readonly targetId: string;
  readonly firstSeen: number;
  readonly occurrences: SlotOccurrence[];
}

/** Code-unit order comparison (not locale-aware). */
function codeUnitCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function sortedNames(values: readonly string[]): string[] {
  return unique(values).sort(codeUnitCompare);
}

function sortedLines(values: readonly number[]): number[] {
  return unique(values).sort((a, b) => a - b);
}

interface CommonProperties {
  readonly specifier: string;
  readonly specifiers: readonly string[];
  readonly line: number;
  readonly lines: readonly number[];
  readonly isTypeOnly: boolean;
  readonly names: readonly string[];
}

function fromOccurrences(occurrences: readonly SlotOccurrence[]): CommonProperties {
  const occ = [...occurrences].sort((a, b) => a.line - b.line || a.seq - b.seq);
  const first = occ[0];
  if (first === undefined) throw new Error('ImportEdgeMerger: slot without occurrences');
  const lines = sortedLines(occ.map(o => o.line));
  return {
    specifier: first.specifier,
    specifiers: unique(occ.map(o => o.specifier)),
    line: lines[0] ?? first.line,
    lines,
    isTypeOnly: occ.every(o => o.isTypeOnly),
    names: sortedNames(occ.flatMap(o => [...o.names])),
  };
}

function mergeCommon(
  a: Omit<CommonProperties, 'names'>,
  b: Omit<CommonProperties, 'names'>,
): Omit<CommonProperties, 'names'> {
  const aFirst = a.line <= b.line;
  const lines = sortedLines([...a.lines, ...b.lines]);
  return {
    specifier: aFirst ? a.specifier : b.specifier,
    specifiers: unique(aFirst ? [...a.specifiers, ...b.specifiers] : [...b.specifiers, ...a.specifiers]),
    line: lines[0] ?? Math.min(a.line, b.line),
    lines,
    isTypeOnly: a.isTypeOnly && b.isTypeOnly,
  };
}

/**
 * Merges two IMPORTS property sets with the FR-10 rules. `specifier` comes from
 * the set with the lower `line` (ties: `a`). `specifiers` lists the lower-line
 * set's values first; this equals the first-line order when sets are folded in
 * line order. Property sets do not carry each specifier's line, so for operands
 * whose specifier lists interleave by line the `specifiers` order (not its
 * content) depends on grouping. `ImportEdgeMerger.edges()` computes the emitted
 * properties from the occurrences and is exact.
 */
export function mergeImportProperties(a: ImportEdgeProperties, b: ImportEdgeProperties): ImportEdgeProperties {
  return {
    ...mergeCommon(a, b),
    importedNames: sortedNames([...a.importedNames, ...b.importedNames]),
  };
}

/** Same rules as {@link mergeImportProperties}, with `exportedNames` (BR-U2-22, 23). */
export function mergeReExportProperties(a: ReExportEdgeProperties, b: ReExportEdgeProperties): ReExportEdgeProperties {
  return {
    ...mergeCommon(a, b),
    exportedNames: sortedNames([...a.exportedNames, ...b.exportedNames]),
  };
}

/**
 * Accumulates occurrences and emits merged edges in first-seen slot order.
 * The slot key holds the edge type, so IMPORTS and RE_EXPORTS of one pair never
 * merge (BR-U2-17).
 */
export class ImportEdgeMerger {
  private readonly slots = new Map<string, MergeSlot>();
  private seq = 0;

  add(occ: ImportOccurrence, targetNodeId: string): void {
    const key = `${occ.edgeType}:${occ.sourceFileNodeId}:${targetNodeId}`;
    let slot = this.slots.get(key);
    if (slot === undefined) {
      slot = {
        edgeType: occ.edgeType,
        sourceId: occ.sourceFileNodeId,
        targetId: targetNodeId,
        firstSeen: this.slots.size,
        occurrences: [],
      };
      this.slots.set(key, slot);
    }
    slot.occurrences.push({
      specifier: occ.specifier,
      line: occ.line,
      seq: this.seq++,
      names: occ.names,
      isTypeOnly: occ.isTypeOnly,
    });
  }

  edges(): APGEdge[] {
    return [...this.slots.values()]
      .sort((a, b) => a.firstSeen - b.firstSeen)
      .map(slot => {
        const { names, ...common } = fromOccurrences(slot.occurrences);
        const properties: ImportEdgeProperties | ReExportEdgeProperties = slot.edgeType === 'IMPORTS'
          ? { ...common, importedNames: names }
          : { ...common, exportedNames: names };
        return {
          id: generateEdgeId(slot.edgeType, slot.sourceId, slot.targetId),
          type: slot.edgeType,
          sourceId: slot.sourceId,
          targetId: slot.targetId,
          properties: { ...properties },
        };
      });
  }
}
