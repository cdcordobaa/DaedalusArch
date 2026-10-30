import { CallOut } from './call-out';

export const CALL_OUT_EXPORT_COLUMNS = ['call_out_ref', 'district', 'lock_type', 'urgency', 'status'] as const;

export function exportRow(callOut: CallOut): Record<(typeof CALL_OUT_EXPORT_COLUMNS)[number], string> {
  return {
    call_out_ref: callOut.id,
    district: callOut.district,
    lock_type: callOut.lockType,
    urgency: callOut.urgency,
    status: callOut.currentStatus,
  };
}
