/**
 * DETECT-01 (exploratory): the role of a file, read from its path. The instrument takes layers from a spec; the
 * prototypes take them from the folder conventions of the pilot seeds (hexagonal and DDD) and of the Layered
 * template, so one evaluator covers fixtures, pilot step trees and a Layered snapshot without a spec per tree.
 */
export type Role =
  | 'domain'
  | 'application'
  | 'port-in'
  | 'port-out'
  | 'contract'
  | 'adapter'
  | 'shared-kernel'
  | 'config'
  | 'other';

export type Style = 'hexddd' | 'layered';

/** `path` is POSIX and relative to the tree root (`src/...`). */
export function roleOf(path: string, style: Style): Role {
  const p = `/${path}`;
  if (style === 'layered') {
    // Layered template (presentation → business → persistence, plus models): no port, contract or domain split.
    if (/\/(models?|entities|domain)\//.test(p)) return 'domain';
    if (/\/(presentation|controllers?|routes?|api)\//.test(p)) return 'adapter';
    if (/\/(persistence|data|repositories|dal)\//.test(p)) return 'adapter';
    if (/\/(business|services?|logic)\//.test(p)) return 'application';
    return 'other';
  }
  if (/\/shared-kernel\//.test(p)) return 'shared-kernel';
  if (/\/contracts\//.test(p)) return 'contract';
  if (/^\/src\/[^/]+\/index\.ts$/.test(p) && !/^\/src\/(domain|application|adapters|config|types)\//.test(p)) return 'contract';
  if (/\/application\/ports\/in\//.test(p)) return 'port-in';
  if (/\/application\/ports\//.test(p)) return 'port-out';
  if (/\/application\//.test(p)) return 'application';
  if (/\/domain\//.test(p)) return 'domain';
  if (/\/(adapters|infrastructure|api|acl)\//.test(p)) return 'adapter';
  if (/\/config\//.test(p) || /^\/src\/main\.ts$/.test(p)) return 'config';
  return 'other';
}

/** Roles that hold the domain model (aggregates, entities, value objects, domain ports). */
export const DOMAIN_ROLES: ReadonlySet<Role> = new Set(['domain', 'shared-kernel']);
