/**
 * Rule mining (v1.3, exploratory): the implicit dependency rules of a codebase that has no spec, mined
 * deterministically from its APG (no LLM). Every rule is a PROPOSAL: it carries its evidence counts, a confidence and
 * the instances that break it (its exceptions, the candidate violations). A rule names the existing template it
 * compiles to, or `null` when no existing template expresses it under the inferred style.
 */

/** The kinds of mined rule. */
export type MinedRuleKind =
  /** "A must not depend on B": B -> A exists (direction evidence) and almost no file of A imports B. */
  | 'layer-direction'
  /** "A must not depend on B" without direction evidence: one file of A imports B, nothing goes back. */
  | 'layer-rare-edge'
  /** "A must not depend on B": no import either way (closed world; absence of evidence only). */
  | 'layer-unobserved'
  /** "No file lies on an import cycle". */
  | 'acyclic-files'
  /** "Component C must not depend on D" (APG v2 module / folder components; direction evidence as for layers). */
  | 'component-direction'
  /** "Consumers of component C import it through its entry files" (APG v2 public API surface). */
  | 'public-api'
  /** "Every <Suffix> class in layer L implements an interface declared in another layer" (port / adapter). */
  | 'port-implementation'
  /** "Classes of layer L inject interfaces, not concrete classes, across layers" (dependency inversion). */
  | 'inject-abstractions'
  /** "The core layer imports none of the packages the other layers import" (framework-free core). */
  | 'core-package-free';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** One instance that breaks a mined rule: a candidate violation. */
export interface RuleException {
  readonly file: string;
  /** The imported file, package, injected class or the class itself, by rule kind. */
  readonly target?: string;
  readonly detail?: string;
}

/** The existing template a rule compiles to (never new Cypher). */
export interface CompileTarget {
  /** `frozen` = CYPHER_TEMPLATES (v1.2E catalogue); the others are the v1.3 extension catalogues. */
  readonly catalogue: 'frozen' | 'hexagonal' | 'ddd' | 'apg2';
  readonly template: string;
  /** The spec construct that carries the rule (layer order, allowed_dependencies, forbidden_imports, ...). */
  readonly via: string;
}

export interface MinedRule {
  /** Stable within one mining run (`MR-<kind>-<n>`). */
  readonly id: string;
  readonly kind: MinedRuleKind;
  readonly statement: string;
  /** The constrained element (layer, component, layer/suffix) and, for pair rules, the forbidden target. */
  readonly subject: string;
  readonly object?: string;
  /** In [0, 1]; smoothed so that small evidence cannot reach 1. */
  readonly confidence: number;
  readonly level: ConfidenceLevel;
  /** Raw counts the confidence is computed from (names differ by kind; see the miner of each kind). */
  readonly evidence: Readonly<Record<string, number>>;
  readonly exceptions: readonly RuleException[];
  /** Values the emitted spec carries for the rule (core-package-free: `forbidden_imports`). */
  readonly params?: Readonly<Record<string, readonly string[]>>;
  /** `null`: no existing template expresses the rule under the inferred style (reported, not emitted). */
  readonly compilesTo: CompileTarget | null;
  /** Why `compilesTo` is null, when it is. */
  readonly notRepresentable?: string;
}

/** Edge statistics of one ordered layer pair. */
export interface LayerPairStat {
  readonly from: string;
  readonly to: string;
  /** Files of `from`. */
  readonly fromFiles: number;
  /** File-to-file import edges from -> to, and to -> from. */
  readonly edges: number;
  readonly reverseEdges: number;
  /** Distinct files of `from` that import `to`. */
  readonly importingFiles: number;
  /** importingFiles / fromFiles (support of "from may depend on to"). */
  readonly support: number;
  /** 1 - support: the share of `from` files that do not import `to`. */
  readonly absence: number;
  /** reverseEdges / (edges + reverseEdges); null when neither direction has an edge. */
  readonly direction: number | null;
}

/** The input of the miner: a project seen through its graph and an inferred layer map. */
export interface MiningInput {
  /** Project-relative paths. */
  readonly files: readonly string[];
  /** Layer of each file (`null`: no layer). */
  readonly layerOf: ReadonlyMap<string, string | null>;
  /** Layer names in the inferred spec's order (innermost first for the linear styles). */
  readonly layers: readonly string[];
  /** Layer kinds resolved by the spec parser (`domain`, `application`, `infrastructure`, `presentation`). */
  readonly layerKinds: ReadonlyMap<string, string | undefined>;
  readonly fileEdges: readonly { readonly from: string; readonly to: string }[];
  readonly packageImports: readonly { readonly file: string; readonly pkg: string }[];
  readonly declarations: readonly { readonly name: string; readonly kind: 'class' | 'interface'; readonly file: string }[];
  readonly typeEdges: readonly {
    readonly kind: 'implements' | 'extends' | 'injects';
    readonly from: { readonly name: string; readonly kind: 'class' | 'interface'; readonly file: string };
    readonly to: { readonly name: string; readonly kind: 'class' | 'interface'; readonly file: string };
  }[];
  /** APG v2 components (module and folder kinds; layer components duplicate the layer rules and are left out). */
  readonly components?: readonly MiningComponent[];
  /** APG v2 literal-view import edges between files (no `viaReExport`), for components and the public API. */
  readonly literalEdges?: readonly { readonly from: string; readonly to: string }[];
}

export interface MiningComponent {
  readonly name: string;
  readonly kind: 'module' | 'folder';
  readonly files: readonly string[];
  readonly entries: readonly string[];
  /** The spec declares the public API (a DDD context's `publicApi`), rather than index / barrel inference. */
  readonly publicApiDeclared: boolean;
}

/** The style the rules are emitted under (ISE's classification). */
export type MiningStyle = 'clean-architecture' | 'layered' | 'nestjs' | 'hexagonal' | 'ddd';

export interface MiningResult {
  readonly style: MiningStyle;
  readonly layers: readonly string[];
  readonly layerFiles: Readonly<Record<string, number>>;
  readonly pairs: readonly LayerPairStat[];
  readonly rules: readonly MinedRule[];
  /** "from>to" for every layer pair the mined rules allow (observed and not forbidden by a selected rule). */
  readonly allowed: readonly string[];
}
