import type { LatchFault, ReportLatchFaults } from '../../../application/ports/in/ReportLatchFaults';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

const NOT_FAULT = 'not a LockBank fault message';
const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;

function parseFault(payload: string): LatchFault {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new LockerError(NOT_FAULT);
  }
  const fault = typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as { fault?: unknown }).fault : undefined;
  if (fault === 'jammed' || fault === 'left-open' || fault === 'cleared') return fault;
  throw new LockerError(NOT_FAULT);
}

/** Receives the messages the MQTT bridge hands over. */
export class LockBankMqtt {
  constructor(private readonly faults: ReportLatchFaults) {}

  receive(topic: string, payload: string): MqttReply {
    try {
      const m = TOPIC.exec(topic);
      if (m === null || typeof payload !== 'string') throw new LockerError(NOT_FAULT);
      const fault = parseFault(payload);
      return { status: 200, body: this.faults.report(m[1], Number(m[2]), fault) };
    } catch (e) {
      if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
      throw e;
    }
  }
}
