/** Value object: one line of a booking's audit trail; it belongs to the booking and has no identity of its own. */
export class AuditEntry {
  constructor(readonly action: string, readonly by: string, readonly at: Date) {}
}
