import type { LatchFault, ReportLatchFaults } from '../../../application/ports/in/ReportLatchFaults';
import { LockerError } from '../../../domain/LockerError';

export interface MqttAnswer {
  readonly status: number;
  readonly body: unknown;
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const FAULTS: readonly string[] = ['jammed', 'left-open', 'cleared'];
const NOT_FAULT = 'not a LockBank fault message';

/** Consumes the fault messages the MQTT bridge hands over. */
export class LockBankMqtt {
  constructor(private readonly latches: ReportLatchFaults) {}

  receive(topic: string, payload: string): MqttAnswer {
    const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
    const fault = parseFault(payload);
    if (match === null || fault === null) return { status: 400, body: { error: NOT_FAULT } };
    try {
      return { status: 200, body: this.latches.latchFault(match[1] as string, Number(match[2]), fault) };
    } catch (e) {
      if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
      throw e;
    }
  }
}

function parseFault(payload: string): LatchFault | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const fault = (data as Record<string, unknown>)['fault'];
  return typeof fault === 'string' && FAULTS.includes(fault) ? (fault as LatchFault) : null;
}
