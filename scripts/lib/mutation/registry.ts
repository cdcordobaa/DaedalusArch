/**
 * Operator registry and catalogue version (FR-v1.2E-24 amendment; BR-U5a-38, 39; Q11).
 *
 * - `catalogueVersionOf(bytes)` = sha256 hex of the catalogue file bytes (BR-U5a-38); every manifest header and
 *   row carries it.
 * - `OperatorRegistry` is built in code: `register` adds one operator (duplicate id refused), `freeze` closes it,
 *   and `register` after `freeze` fails with `CAT_FROZEN` (BR-U5a-39). The registered-catalogue module
 *   (`operators/index.ts`, Step 31) freezes at module load. `list()` is ordered by id (code-unit order).
 */
import { createHash } from 'node:crypto';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { MutationOperator } from './types.js';

/** sha256 hex of the catalogue bytes (a string is hashed as UTF-8). */
export function catalogueVersionOf(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export class OperatorRegistry {
  readonly catalogueVersion: string;
  private readonly operators = new Map<string, MutationOperator>();
  private frozen = false;

  constructor(catalogueVersion: string) {
    if (!/^[0-9a-f]{64}$/.test(catalogueVersion)) {
      throw new RangeError(`catalogueVersion must be a sha256 hex string, got ${JSON.stringify(catalogueVersion)}`);
    }
    this.catalogueVersion = catalogueVersion;
  }

  register(op: MutationOperator): DomainResult<void> {
    if (this.frozen) {
      return DomainResult.fail([{ code: 'CAT_FROZEN', message: `registry is frozen; cannot register ${op.id}` }]);
    }
    if (op.id.length === 0 || op.id.includes('|')) {
      return DomainResult.fail([{ code: 'CAT_INVALID_ID', message: `operator id must be non-empty and contain no '|': ${JSON.stringify(op.id)}` }]);
    }
    if (this.operators.has(op.id)) {
      return DomainResult.fail([{ code: 'CAT_DUPLICATE_ID', message: `operator ${op.id} is already registered` }]);
    }
    this.operators.set(op.id, op);
    return DomainResult.ok(undefined);
  }

  get(id: string): MutationOperator | undefined {
    return this.operators.get(id);
  }

  /** Every registered operator, ordered by id. */
  list(): readonly MutationOperator[] {
    return [...this.operators.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  freeze(): void {
    this.frozen = true;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }
}
