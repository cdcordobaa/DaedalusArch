/**
 * Study 2b evasion item 4, the literal view (pre-registration `Docs/v1.4/study2b-preregistration.md` §4 "Evasion",
 * item 4; addendum 4 row DA15). The pure part and the in-process graph that holds only the literal view.
 *
 * The literal view is the extractor's own (ADR-V13-01, `src/fitness-compiler/edge-views.ts`, selected exactly as
 * `scripts/v1.3/default-view-coverage.ts` selects it: `IMPORTS` edges without `viaReExport`, plus `RE_EXPORTS`). With
 * `reExportEdges: 'both'` (`V13_DEFAULT_OPTIONS`) the extractor writes, for an import through a barrel, the LITERAL
 * edge to the file the specifier names and the RESOLVED edge to the declaring file (`viaReExport: true`); a literal
 * edge that only exists because of the barrel carries `reExportHop: true`. The default v1.3 scoring lets each template
 * read its own view (`applyEdgeView`). The literal re-score makes every template read the literal graph: the
 * `viaReExport` edges are not ingested and `reExportHop` is cleared on the rest, so a `resolved` template's predicate
 * (`NOT coalesce(r.reExportHop, false)`) keeps every literal edge, and a `literal` template's predicate is unchanged.
 * No frozen file is edited: the graph is injected through `PipelineConfig.graphRepository`.
 *
 * The bar (registered, unchanged): evasion is flagged if a treated cell's mean per-block gap (literal − default D)
 * exceeds the reference cell's (`none@L2`) by more than one identity.
 */
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import type { EvaluateDeps } from '../../../src/mcp-server/evaluate-project.js';
import type { QueryOptions } from '../../../src/shared/interfaces/graph-repository.js';
import { engineDeps } from '../../lib/loop/engine-tee.js';

/** The ingestion's edge write for IMPORTS (`edgeIngestCypher('IMPORTS')` of `src/neo4j-ingestion/graph-ingester.ts`). */
const IMPORTS_INGEST = /CREATE\s+\(src\)-\[r:IMPORTS\]->\(tgt\)/;

export interface LiteralViewStats {
  /** IMPORTS edges not ingested because they carry `viaReExport: true` (the resolved-only edges). */
  droppedViaReExport: number;
  /** Literal IMPORTS edges whose `reExportHop` flag was cleared. */
  clearedReExportHop: number;
  /** IMPORTS edges ingested. */
  importsIngested: number;
}

export const emptyStats = (): LiteralViewStats => ({ droppedViaReExport: 0, clearedReExportHop: 0, importsIngested: 0 });

interface EdgeEntry { readonly sourceId?: unknown; readonly targetId?: unknown; readonly props?: Record<string, unknown> }

/**
 * The literal view of one ingestion write: for the IMPORTS edge write, the batch without `viaReExport` edges and with
 * `reExportHop` removed from the rest; any other query is returned unchanged. Pure; `stats` is added to.
 */
export function literalWrite(cypher: string, params: Record<string, unknown> | undefined, stats: LiteralViewStats): Record<string, unknown> | undefined {
  if (params === undefined || !IMPORTS_INGEST.test(cypher) || !Array.isArray(params.batch)) return params;
  const kept: EdgeEntry[] = [];
  for (const e of params.batch as EdgeEntry[]) {
    const props = e.props ?? {};
    if (props.viaReExport === true) { stats.droppedViaReExport += 1; continue; }
    if ('reExportHop' in props) {
      const { reExportHop, ...rest } = props;
      if (reExportHop === true) stats.clearedReExportHop += 1;
      kept.push({ ...e, props: rest });
    } else {
      kept.push(e);
    }
  }
  stats.importsIngested += kept.length;
  return { ...params, batch: kept };
}

/** The in-process graph (`cypher-interp`) holding the literal view only. */
export class LiteralViewRepository extends MemoryGraphRepository {
  constructor(readonly stats: LiteralViewStats = emptyStats()) {
    super();
  }

  override executeQuery(cypher: string, params?: Record<string, unknown>, options?: QueryOptions): ReturnType<MemoryGraphRepository['executeQuery']> {
    return super.executeQuery(cypher, literalWrite(cypher, params, this.stats), options);
  }
}

/**
 * The literal-view wiring: `engineDeps(base, 'cypher-interp')` (the registered re-score's wiring), with a fresh
 * `LiteralViewRepository` injected as each pipeline's graph; its counters go to `sink.current`.
 */
export function literalDeps(base: EvaluateDeps, sink: { current: LiteralViewStats }): EvaluateDeps {
  const interp = engineDeps(base, 'cypher-interp');
  return {
    ...interp,
    makeGraph: () => new MemoryGraphRepository(),
    makePipeline: (config) => base.makePipeline({ ...config, graphEngine: 'cypher-interp', graphRepository: new LiteralViewRepository(sink.current) }),
  };
}

export interface BlockGap {
  readonly cell: string;
  readonly block: string;
  readonly defaultD: number | null;
  readonly literalD: number | null;
  /** literal − default D; null when either D is undefined (an incomplete run). */
  readonly gap: number | null;
  /** Secondary: counted identities in the step-5 snapshot, literal − default. */
  readonly step5Gap: number | null;
}

export function blockGap(cell: string, block: string, defaultD: number | null, literalD: number | null, step5Default: number | null, step5Literal: number | null): BlockGap {
  return {
    cell, block, defaultD, literalD,
    gap: defaultD === null || literalD === null ? null : literalD - defaultD,
    step5Gap: step5Default === null || step5Literal === null ? null : step5Literal - step5Default,
  };
}

export interface CellGap {
  readonly cell: string;
  readonly blocks: number;
  readonly undefinedBlocks: number;
  readonly meanGap: number | null;
  readonly nonZeroGaps: number;
  readonly meanStep5Gap: number | null;
  readonly sumDefaultD: number;
  readonly sumLiteralD: number;
}

const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function cellGap(cell: string, gaps: readonly BlockGap[]): CellGap {
  const mine = gaps.filter((g) => g.cell === cell);
  const defined = mine.flatMap((g) => (g.gap === null ? [] : [g.gap]));
  const s5 = mine.flatMap((g) => (g.step5Gap === null ? [] : [g.step5Gap]));
  return {
    cell,
    blocks: mine.length,
    undefinedBlocks: mine.length - defined.length,
    meanGap: mean(defined),
    nonZeroGaps: defined.filter((x) => x !== 0).length,
    meanStep5Gap: mean(s5),
    sumDefaultD: mine.reduce((a, g) => a + (g.defaultD ?? 0), 0),
    sumLiteralD: mine.reduce((a, g) => a + (g.literalD ?? 0), 0),
  };
}

/** The registered margin: one identity. */
export const LITERAL_BAR = 1;
export const LITERAL_REFERENCE = 'none@L2';

export interface BarRow { readonly cell: string; readonly meanGap: number | null; readonly referenceMeanGap: number | null; readonly excess: number | null; readonly flagged: boolean | null }

/** Per treated cell: excess = meanGap − reference meanGap; flagged iff excess > the bar (null when undefined). */
export function literalBar(cells: readonly CellGap[], reference = LITERAL_REFERENCE, bar = LITERAL_BAR): BarRow[] {
  const ref = cells.find((c) => c.cell === reference);
  return cells.filter((c) => c.cell !== reference).map((c) => {
    const excess = c.meanGap === null || ref?.meanGap == null ? null : c.meanGap - ref.meanGap;
    return { cell: c.cell, meanGap: c.meanGap, referenceMeanGap: ref?.meanGap ?? null, excess, flagged: excess === null ? null : excess > bar };
  });
}
