import type { LatchFault, ReportLatchFaults } from '../../../application/ports/in/ReportLatchFaults';
import { LockerError } from '../../../domain/LockerError';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const FAULTS: readonly string[] = ['jammed', 'left-open', 'cleared'];

/** Handles the fault messages the MQTT bridge hands over. */
export class LockbankMqtt {
  constructor(private readonly faults: ReportLatchFaults) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = TOPIC.exec(topic);
      const fault = parseFault(payload);
      if (m === null || fault === undefined) throw new LockerError('not a LockBank fault message');
      return this.faults.report(m[1], Number(m[2]), fault);
    });
  }
}

function parseFault(payload: string): LatchFault | undefined {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null) return undefined;
  const fault = (data as { fault?: unknown }).fault;
  return typeof fault === 'string' && FAULTS.includes(fault) ? (fault as LatchFault) : undefined;
}
