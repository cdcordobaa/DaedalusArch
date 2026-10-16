/**
 * Cheap semantic proxies (pass 0.5): shared types.
 *
 * Every proxy is deterministic code analysis over the in-memory APG and the ts-morph project (no LLM, no Neo4j). It
 * emits facts — extra edges between APG nodes, or extra properties of APG nodes — each with its evidence (file, line
 * span) and a score, and a list of flags: the facts that cross the proxy's threshold and name a candidate
 * anti-pattern site for a later LLM pass to verify. Design: `Docs/v1.3/cheap-semantics-design.md`.
 */
import type { LayerKind } from '../../shared/types/enums.js';

/** The ten proxies, in the order of the design note. */
export const PROXY_IDS = [
  'clones',
  'shared-literals',
  'name-behaviour',
  'cohesion',
  'logic-density',
  'repo-bypass',
  'framework-in-core',
  'vocabulary',
  'communities',
  'doc-text',
] as const;
export type Batch1ProxyId = (typeof PROXY_IDS)[number];

/**
 * Batch 2 (`Docs/v1.3/cheap-semantics-design.md`, "Batch 2"): six per-project proxies run by `enrichCheap`. Agent
 * provenance (`provenance.ts`) is a multi-snapshot analysis with its own entry point (`analyseProvenance`); its facts
 * carry the proxy id `agent-provenance`.
 */
export const BATCH2_PROXY_IDS = [
  'error-flow',
  'reachability',
  'sdk-spread',
  'test-topology',
  'config-surface',
  'co-change',
] as const;
export type Batch2ProxyId = (typeof BATCH2_PROXY_IDS)[number];

/** Every proxy `enrichCheap` can run. */
export const CONTEXT_PROXY_IDS: readonly ContextProxyId[] = Object.freeze([...PROXY_IDS, ...BATCH2_PROXY_IDS]);
export type ContextProxyId = Batch1ProxyId | Batch2ProxyId;
export type ProxyId = ContextProxyId | 'agent-provenance';

/** Edge types the proxies add. They are not APG edge types and are never written to the frozen schema. */
export type CheapEdgeType =
  | 'SAME_LOGIC_AS'
  | 'SHARES_LITERAL'
  | 'THROWS'
  | 'CATCHES'
  | 'REACHES'
  | 'TESTS'
  | 'READS_ENV'
  | 'CO_CHANGES_WITH'
  | 'CREATED_AT_STEP'
  | 'MODIFIED_AT_STEP'
  | 'REIMPLEMENTS';

/**
 * A node the proxies add that has no APG node: an error type declared in a package, an entry point, an environment
 * key, a test file (test files are excluded from extraction) or a loop step. Ids are namespaced (`error:`, `entry:`,
 * `env:`, `test:`, `step:`) so they never collide with the 16-hex APG ids.
 */
export interface CheapVirtualNode {
  readonly id: string;
  readonly kind: 'ErrorType' | 'EntryPoint' | 'EnvKey' | 'TestFile' | 'Step';
  readonly name: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

/** A source location: project-relative POSIX path and a 1-based inclusive line span. */
export interface Evidence {
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
}

/** An edge between two APG nodes (Method, Function, Class or File ids). */
export interface CheapEdge {
  readonly type: CheapEdgeType;
  readonly proxy: ProxyId;
  readonly sourceId: string;
  readonly targetId: string;
  readonly score: number;
  readonly evidence: readonly Evidence[];
  readonly properties: Readonly<Record<string, unknown>>;
}

/** A property written on one APG node (`key` is prefixed `cheap.` by the caller that persists it). */
export interface CheapNodeFact {
  readonly proxy: ProxyId;
  readonly nodeId: string;
  readonly key: string;
  readonly value: unknown;
  readonly evidence?: Evidence;
}

/**
 * A fact past its proxy's threshold: a candidate site. `className` and `methodName` name the code unit when the flag
 * is about one (a component-level flag has neither).
 */
export interface CheapFlag {
  readonly proxy: ProxyId;
  readonly kind: string;
  readonly score: number;
  readonly evidence: Evidence;
  readonly className?: string;
  readonly methodName?: string;
  readonly message: string;
  /** For two-ended flags (clones, shared literals): the other end. */
  readonly related?: Evidence & { readonly className?: string; readonly methodName?: string };
}

export interface CheapProxyOutput {
  readonly edges: CheapEdge[];
  readonly nodeFacts: CheapNodeFact[];
  readonly flags: CheapFlag[];
  /** Proxy-level summary numbers (counts, ARI, per-role aggregates). */
  readonly summary: Record<string, unknown>;
  /** Batch 2: nodes without an APG node that the edges point at. */
  readonly virtualNodes?: CheapVirtualNode[];
}

export interface CheapEnrichment {
  readonly edges: readonly CheapEdge[];
  readonly nodeFacts: readonly CheapNodeFact[];
  readonly flags: readonly CheapFlag[];
  readonly virtualNodes: readonly CheapVirtualNode[];
  readonly summaries: Readonly<Partial<Record<ProxyId, Record<string, unknown>>>>;
  /** Wall-clock milliseconds per proxy (context build under `context`). */
  readonly timingsMs: Readonly<Record<string, number>>;
}

/** Tunable thresholds. Every default is documented in the design note; none was tuned on the planted seeds. */
export interface CheapOptions {
  /** Minimum normalised token count of a fragment clone unit (a top-level guard or block statement). */
  readonly cloneMinTokens: number;
  /** Minimum normalised token count of a whole-body clone unit (CCFinder's default minimum, Kamiya et al. 2002). */
  readonly cloneMinBodyTokens: number;
  /**
   * Guard-normalised clone units (`guards.ts`): short `if (…) throw …` guards keyed on condition, error type and message
   * template, trivial parameter null checks excluded. Off reproduces the proxy before the v1.3 cheap-fix change.
   */
  readonly cloneGuardUnits: boolean;
  /** Flag same-component clone pairs as `same-component-<type>` (advisory kind). Off: only cross-component pairs flag. */
  readonly cloneSameComponentFlags: boolean;
  /** Token-shingle Jaccard at or above which two units are near-clones. */
  readonly nearCloneThreshold: number;
  /** Shingle width in tokens. */
  readonly shingleSize: number;
  /** Minimum string-literal length for SHARES_LITERAL. */
  readonly literalMinLength: number;
  /** Per-method logic density at or above which a controller or adapter method is flagged. */
  readonly densityThreshold: number;
  /** LCOM4 at or above which a class is flagged as non-cohesive. */
  readonly lcom4Threshold: number;
  /** Responsibility breadth at or above which a class is flagged. */
  readonly breadthThreshold: number;
  /** Number of TF-IDF concept tags kept per component. */
  readonly vocabularyTopK: number;
  /** Share of a component's tagged identifier mass owned by one other component at or above which it is flagged. */
  readonly vocabularyLeakThreshold: number;
  /** Louvain resolution parameter. */
  readonly louvainResolution: number;
  /**
   * Communities: also link files by the literal view's RE_EXPORTS edges (barrel to re-exported file), so a file reached
   * only through a barrel is joined to its importers (R14, post-merge review 2026-10-16). Opt-in: off reproduces the
   * committed outputs; absent from the defaults so the options object is unchanged.
   */
  readonly communityReExports?: boolean;
  /** Batch 2, config surface: an env key read in MORE than this many components is flagged. */
  readonly envSharedComponents: number;
  /** Batch 2, co-change: minimum number of commits a file pair changed together in (support). */
  readonly coChangeMinSupport: number;
  /** Batch 2, co-change: minimum max(confidence(a→b), confidence(b→a)) of a pair to count as coupled. */
  readonly coChangeMinConfidence: number;
  /** Batch 2, co-change: commits touching more files than this are ignored (Zimmermann et al. 2005 drop such transactions). */
  readonly coChangeMaxFilesPerCommit: number;
  /**
   * Batch 2, co-change: which history to read. `own` = a `.git` at the project root only; `enclosing` = the repository
   * that contains the project root, restricted to the project directory (the reference fixtures live inside this repo).
   */
  readonly coChangeHistory: 'own' | 'enclosing';
  /** Proxies to run (default: the ten batch-1 proxies; batch 2 is selected explicitly, `BATCH2_PROXY_IDS`). */
  readonly proxies: readonly ContextProxyId[];
}

export const DEFAULT_CHEAP_OPTIONS: Readonly<CheapOptions> = Object.freeze({
  cloneMinTokens: 12,
  cloneMinBodyTokens: 30,
  cloneGuardUnits: true,
  cloneSameComponentFlags: true,
  nearCloneThreshold: 0.8,
  shingleSize: 3,
  literalMinLength: 4,
  densityThreshold: 3,
  lcom4Threshold: 3,
  breadthThreshold: 4,
  vocabularyTopK: 10,
  vocabularyLeakThreshold: 0.5,
  louvainResolution: 1,
  envSharedComponents: 2,
  coChangeMinSupport: 3,
  coChangeMinConfidence: 0.5,
  coChangeMaxFilesPerCommit: 30,
  coChangeHistory: 'own',
  proxies: PROXY_IDS,
});

/** Per-file facts the proxies share. */
export interface FileInfo {
  readonly file: string;
  readonly fileNodeId: string | undefined;
  readonly layer: string | null;
  readonly layerKind: LayerKind | null;
  readonly component: string;
}
