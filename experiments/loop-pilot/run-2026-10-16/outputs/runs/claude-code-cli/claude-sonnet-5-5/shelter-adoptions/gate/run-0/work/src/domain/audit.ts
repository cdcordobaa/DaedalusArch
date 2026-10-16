export type AuditEntityType = "animal" | "application" | "placement" | "notification";

export const SYSTEM_ACTOR = "system";

export interface AuditEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  /** The animal this change belongs to; absent for changes unrelated to an animal (notifications). */
  animalId?: string;
  action: "created" | "updated";
  /** Staff member id, or 'system' for webhooks. */
  actor: string;
  at: string;
  /** Null when the entity was created. */
  before: unknown;
  after: unknown;
}
