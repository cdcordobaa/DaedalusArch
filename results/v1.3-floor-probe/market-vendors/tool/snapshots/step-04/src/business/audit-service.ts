import { randomUUID } from 'node:crypto';
import { AuditEntry, AuditedEntity } from './models';
import { auditRepository } from '../persistence/repositories';

export const auditService = {
  record(
    actor: string,
    entity: AuditedEntity,
    entityId: string,
    scope: { marketDayId?: string; vendorId?: string },
    before: unknown,
    after: unknown,
  ): void {
    auditRepository.append({
      id: randomUUID(),
      entity,
      entityId,
      ...scope,
      actor,
      at: new Date().toISOString(),
      before: before ?? null,
      after: after ?? null,
    });
  },

  forMarketDay(marketDayId: string): AuditEntry[] {
    return auditRepository.forMarketDay(marketDayId);
  },
};
