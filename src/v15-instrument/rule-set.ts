/**
 * v1.5 instrument, the ONE rule list (2026-10-29, instrument `INSTRUMENT_ID`). Which rule ids a style's session is
 * scored on, and therefore which rule ids the delivery hub delivers on both channels, come from here and nowhere else:
 * - the catalog rows and the rule ids that detect each row (`DDD_ROW_RULES`, `HEX_ROW_RULES`; moved here unchanged
 *   from `experiments/cal-01/score.ts`, which re-exports them, so the admission scorers keep reading the same map);
 * - the admitted rows (CAL-03 for DDD; HCAL-03 and HCAL-04 for Hexagonal) and the row overrides (moved here
 *   unchanged from `experiments/v15-study/score-study.ts`, which re-exports them).
 *
 * The scorer counts the admitted rows' rules in D and reports the other rows' rules as exploratory; the hub delivers
 * the union (`scoredRules`), split into the v1.5 Cypher rules (`R-*`, run by `runTree` from `rules/*.cypher`, the
 * only rule definition) and the frozen v1.4 file rules (`FF-*`, the frozen `check_diff`, blocking tier). A rule added
 * to a row here is scored and delivered with no hub edit; `tests/unit/v15-instrument/delivery-rule-set.test.ts`
 * fails when the two channels and the scorer disagree.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rulesDir } from './graph.js';

/** The instrument version the scorer and the hub record (bumped 2026-10-29: hub delivers every scored rule; R-AXA v2; then v1.5.2: R-MIRROR2 added to H11, exploratory, so the hub delivers it too). */
export const INSTRUMENT_ID = 'v1.5.2-r-mirror2';

export type Style = 'ddd' | 'hexagonal';

/** DDD catalog row → the rule ids that detect it (v1.5 Cypher ids, or a frozen rule id; a trailing `*` is a prefix). */
export const DDD_ROW_RULES: Readonly<Record<string, readonly string[]>> = {
  K01: ['FF-DS02'], K02: ['FF-DT04', 'FF-S01', 'FF-S03', 'R-H5', 'R-PURE'], K03: ['R-D4'], K04: ['R-D4', 'R-D4R'], K05: ['R-XCTX', 'R-D4'], K06: ['R-D4', 'R-XCTX'],
  K07: ['R-RTX'], K08: ['R-D5'], K09: ['R-D5'], K10: ['R-D5S', 'R-D5'], K11: ['R-LOCK'], K12: ['R-D3'], K13: ['R-H5'],
  K14: ['R-D9'], K15: ['R-INJ'], K16: ['R-REF'],
};
/** Hexagonal rows (HCAL), mapped by construct from the spec's fitness functions before scoring (2026-10-27; CN-04 2026-10-28: H06 R-ADAPTER-RULE in place of R-D5, R-D3; H11 R-MIRROR; H11 v2 2026-10-29: R-MIRROR2 added, exploratory, not admitted). */
export const HEX_ROW_RULES: Readonly<Record<string, readonly string[]>> = {
  H01: ['FF-S01', 'FF-S04', 'FF-P01'], H02: ['FF-S01', 'FF-S03', 'FF-P02', 'R-INJ'], H03: ['FF-S01', 'FF-S03', 'FF-P03', 'R-AXA'],
  H04: ['R-H5'], H05: ['R-INJ', 'FF-P02'], H06: ['R-ADAPTER-RULE'], H07: ['FF-P01', 'FF-S01', 'R-TRANSPORT'],
  H08: ['R-LOCATOR'], H09: ['R-COREIO'], H10: ['R-ENTITY-OUT'], H11: ['R-MIRROR', 'R-MIRROR2'],
};

/** DDD rows admitted by CAL-03. */
export const ADMITTED_DDD_ROWS: readonly string[] = ['K01', 'K02', 'K03', 'K05', 'K10', 'K13', 'K14', 'K15', 'K16'];
/** Hexagonal rows admitted by HCAL-03 (8 of 10) and HCAL-04 (H08); H06 and H11 not admitted (HCAL-04, HCAL-05). */
export const ADMITTED_HEX_ROWS: readonly string[] = ['H01', 'H02', 'H03', 'H04', 'H05', 'H07', 'H08', 'H09', 'H10'];
/** Row-map exceptions: K10 is scored by R-D5S only (R-D5 stays exploratory). */
export const ROW_OVERRIDES: Readonly<Record<string, readonly string[]>> = { K10: ['R-D5S'] };

export const rowMap = (style: Style): Readonly<Record<string, readonly string[]>> => (style === 'ddd' ? DDD_ROW_RULES : HEX_ROW_RULES);
const rowsAdmitted = (style: Style): readonly string[] => (style === 'ddd' ? ADMITTED_DDD_ROWS : ADMITTED_HEX_ROWS);
const rulesOfRow = (style: Style, row: string): readonly string[] => ROW_OVERRIDES[row] ?? rowMap(style)[row] ?? [];

/** The rule ids that count in D_v15 for a style. */
export function admittedRules(style: Style): string[] {
  return [...new Set(rowsAdmitted(style).flatMap((r) => rulesOfRow(style, r)))].sort();
}
/** The rule ids of the style's other rows that are not admitted (reported separately, never in Y). */
export function exploratoryRules(style: Style): string[] {
  const adm = new Set(admittedRules(style));
  const all = Object.keys(rowMap(style)).flatMap((r) => rowMap(style)[r] ?? []);
  return [...new Set(all.filter((r) => !adm.has(r)))].sort();
}
/** Every rule id the scorer runs and reports for a style (admitted + exploratory): what the hub delivers. */
export function scoredRules(style: Style): string[] {
  return [...new Set([...admittedRules(style), ...exploratoryRules(style)])].sort();
}
export const isFrozenRule = (id: string): boolean => id.startsWith('FF-');
/** The v1.5 Cypher rule ids of a style's scored set (run by `runTree`). */
export const cypherRules = (style: Style): string[] => scoredRules(style).filter((r) => !isFrozenRule(r));
/** The frozen v1.4 file-rule ids of a style's scored set (the frozen `check_diff`, blocking tier). */
export const frozenRules = (style: Style): string[] => scoredRules(style).filter(isFrozenRule);

/** A rule id matches a list entry exactly, or by prefix when the entry ends in `*`. */
export const ruleMatches = (rule: string, ids: readonly string[]): boolean => ids.some((i) => (i.endsWith('*') ? rule.startsWith(i.slice(0, -1)) : rule === i));

/** The scored style of a spec style string (`architecture.style`), or null for a style no study scores. */
export function scoredStyle(specStyle: string | undefined): Style | null {
  return specStyle === 'ddd' ? 'ddd' : specStyle === 'hexagonal' ? 'hexagonal' : null;
}

/**
 * The rule hash of this instrument: sha256 over a manifest of every file under `src/v15-instrument` (`.ts`, `.cjs`,
 * `.cypher`), one `<sha256>  <path>` line per file in path order, the format of the sealed `RULES-FROZEN.sha256`
 * manifests (which also list `experiments/cal-01/score.ts`; this one covers the instrument only).
 */
export function instrumentRuleHash(dir: string = path.dirname(rulesDir())): { hash: string; files: number } {
  const out: string[] = [];
  const walk = (d: string, rel: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = rel === '' ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else if (/\.(ts|js|cjs|cypher)$/.test(e.name) && !e.name.endsWith('.d.ts') && !e.name.endsWith('.map')) out.push(`${createHash('sha256').update(fs.readFileSync(path.join(d, e.name))).digest('hex')}  ${r}`);
    }
  };
  walk(dir, '');
  out.sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1));
  return { hash: createHash('sha256').update(`${out.join('\n')}\n`).digest('hex'), files: out.length };
}
