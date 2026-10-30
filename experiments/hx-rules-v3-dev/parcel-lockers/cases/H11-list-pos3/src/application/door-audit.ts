export const DOOR_AUDIT_FIELDS: readonly string[] = ['locker_id', 'door_state', 'opened_at'];

export function auditHeader(): string {
  return DOOR_AUDIT_FIELDS.join(',');
}
