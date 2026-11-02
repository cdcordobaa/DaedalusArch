import type { MaintainLockers } from '../../../application/ports/in/MaintainLockers';
import { LockerError } from '../../../domain/LockerError';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

/** Receives latch faults published by the LockBank hubs. */
export class LockBankMqttRoutes {
  constructor(private readonly maintenance: MaintainLockers) {}

  receive(topic: string, payload: string): MqttReply {
    try {
      return { status: 200, body: this.apply(topic, payload) };
    } catch (e) {
      if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
      throw e;
    }
  }

  private apply(topic: string, payload: string): { locker: string; inService: boolean } {
    const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
    if (match === null) throw new LockerError(NOT_FAULT);
    let fault: unknown;
    try {
      const parsed: unknown = JSON.parse(payload);
      fault = typeof parsed === 'object' && parsed !== null ? (parsed as { fault?: unknown }).fault : undefined;
    } catch {
      throw new LockerError(NOT_FAULT);
    }
    if (fault !== 'jammed' && fault !== 'left-open' && fault !== 'cleared') throw new LockerError(NOT_FAULT);
    return this.maintenance.setServiceAtBay(match[1], Number(match[2]), fault === 'cleared');
  }
}
