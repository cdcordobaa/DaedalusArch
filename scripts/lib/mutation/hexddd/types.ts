/**
 * Site kinds and precondition reasons of the v1.3 DRAFT hexagonal/DDD operators (`Docs/v1.3/operator-catalogue-hexddd.md`).
 *
 * They are kept here, not in `scripts/lib/mutation/types.ts` or `catalogue-parser.ts`: those files are hash-frozen for
 * the judge catch test (`Docs/v1.3/judge-catch-frozen.md`), and widening their unions would change the frozen bytes.
 * The pipeline treats a site's `kind` and a rejection's `reason` as opaque strings (`sites.ts` sorts by `kind` and
 * counts rejections by `reason`), so these values cross into its types through `siteKind` and `reject` below, the only
 * casts in the hexddd code.
 */
import type { PreconditionReason, PreconditionResult, SiteKind } from '../types.js';
import { SITE_KINDS } from '../types.js';
import { PRECONDITION_REASONS } from '../catalogue-parser.js';

export const HEXDDD_SITE_KINDS = ['constructor-injection', 'implements-clause', 'value-object-member', 'cross-context-import'] as const;
export type HexDddSiteKind = (typeof HEXDDD_SITE_KINDS)[number];

export const HEXDDD_REASONS = ['layer-pair', 'no-port', 'ddd-boundary'] as const;
export type HexDddReason = (typeof HEXDDD_REASONS)[number];

/** Every site kind a hexddd catalogue row may name: the frozen ones and the hexddd ones. */
export const ALL_SITE_KINDS: readonly string[] = [...SITE_KINDS, ...HEXDDD_SITE_KINDS];
/** Every precondition reason a hexddd catalogue row may name. */
export const ALL_REASONS: readonly string[] = [...PRECONDITION_REASONS, ...HEXDDD_REASONS];

export function siteKind(kind: SiteKind | HexDddSiteKind): SiteKind {
  return kind as SiteKind;
}

export function reject(reason: PreconditionReason | HexDddReason): PreconditionResult {
  return { ok: false, reason: reason as PreconditionReason };
}
