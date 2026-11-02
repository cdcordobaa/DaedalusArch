import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives latch-fault messages from the MQTT bridge. */
export class LockbankMqtt {
  constructor(private readonly admin: ManageBuildings) {}

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
      const data: unknown = JSON.parse(payload);
      fault = typeof data === 'object' && data !== null ? (data as { fault?: unknown }).fault : undefined;
    } catch {
      throw new LockerError(NOT_FAULT);
    }
    if (fault !== 'jammed' && fault !== 'left-open' && fault !== 'cleared') throw new LockerError(NOT_FAULT);
    return this.admin.setServiceAtBay(match[1], Number(match[2]), fault === 'cleared');
  }
}
