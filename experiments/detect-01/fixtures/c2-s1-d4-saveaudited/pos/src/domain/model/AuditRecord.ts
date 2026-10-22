/** Entity: one audit record, with its own identity, readable on its own through the audit log. */
export class AuditEntry {
  constructor(readonly id: string, readonly bookingId: string, readonly action: string, readonly by: string, readonly at: Date) {}
}
