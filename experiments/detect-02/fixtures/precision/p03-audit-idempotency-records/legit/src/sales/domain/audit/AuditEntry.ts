/** One line of the audit trail: who did what to which subject, and when. Never changed after it is written. */
export class AuditEntry {
  constructor(readonly id: string, readonly actor: string, readonly action: string, readonly subjectId: string, readonly at: Date) {}
}
