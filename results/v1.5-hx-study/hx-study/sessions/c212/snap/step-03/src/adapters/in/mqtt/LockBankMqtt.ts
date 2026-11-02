import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives the latch faults the LockBank hubs publish over MQTT. */
export class LockBankMqtt {
  constructor(private readonly admin: ManageBuildings) {}

  receive(topic: string, payload: string): MqttReply {
    try {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (match === null) throw new LockerError(NOT_FAULT);
      const inService = this.parse(payload);
      return { status: 200, body: this.admin.setServiceAtBay(match[1], Number(match[2]), inService) };
    } catch (e) {
      if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
      throw e;
    }
  }

  /** True when the fault is cleared; false for jammed or left-open. */
  private parse(payload: string): boolean {
    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      throw new LockerError(NOT_FAULT);
    }
    const fault = typeof data === 'object' && data !== null ? (data as { fault?: unknown }).fault : undefined;
    if (fault === 'cleared') return true;
    if (fault === 'jammed' || fault === 'left-open') return false;
    throw new LockerError(NOT_FAULT);
  }
}
