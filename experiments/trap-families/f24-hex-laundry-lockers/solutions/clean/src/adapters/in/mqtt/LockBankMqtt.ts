import type { LatchCondition, LockerFaults } from '../../../application/ports/in/LockerFaults';
import { LockerError } from '../../../domain/LockerError';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;
const CONDITION: Record<string, LatchCondition> = { jammed: 'faulty', 'left-open': 'faulty', cleared: 'sound' };

/** Messages from the MQTT bridge: topic lockbank/<building>/bay/<n>/fault, payload {"fault": ...}. */
export class LockBankMqtt {
  constructor(private readonly faults: LockerFaults) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = TOPIC.exec(topic);
      const condition = m === null ? undefined : CONDITION[faultOf(payload)];
      if (m === null || condition === undefined) throw new LockerError('not a LockBank fault message');
      return this.faults.report(m[1]!, Number(m[2]), condition);
    });
  }
}

function faultOf(payload: string): string {
  try {
    const v = JSON.parse(payload) as unknown;
    return typeof v === 'object' && v !== null && typeof (v as { fault?: unknown }).fault === 'string' ? (v as { fault: string }).fault : '';
  } catch {
    return '';
  }
}
