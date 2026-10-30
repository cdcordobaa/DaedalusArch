export const DOOR_AUDIT_FIELDS: readonly string[] = ['locker_id', 'opened_at', 'parcel_ref', 'pickup_code_used'];

export function auditHeader(): string {
  return DOOR_AUDIT_FIELDS.join(',');
}
