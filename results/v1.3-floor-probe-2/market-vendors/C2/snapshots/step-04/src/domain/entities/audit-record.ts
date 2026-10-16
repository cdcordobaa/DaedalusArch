export type Audited = 'booking' | 'fee' | 'commission' | 'card-sale' | 'settlement';

export class AuditRecord {
  constructor(
    public readonly id: string,
    public readonly what: Audited,
    public readonly refId: string,
    public readonly marketDayId: string | null,
    public readonly by: string,
    public readonly at: string,
    public readonly before: unknown,
    public readonly after: unknown,
  ) {}
}
