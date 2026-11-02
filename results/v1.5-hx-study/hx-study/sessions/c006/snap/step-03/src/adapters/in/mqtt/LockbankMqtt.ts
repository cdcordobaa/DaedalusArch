import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

const NOT_FAULT = 'not a LockBank fault message';
const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;

/** Receives the latch faults the LockBank hubs publish over MQTT. */
export class LockbankMqtt {
  constructor(private readonly admin: ManageBuildings) {}

  receive(topic: string, payload: string): MqttReply {
    try {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      const fault = parseFault(payload);
      if (match === null || fault === null) throw new LockerError(NOT_FAULT);
      return { status: 200, body: this.admin.setBayService(match[1] as string, Number(match[2]), fault === 'cleared') };
    } catch (e) {
      if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
      throw e;
    }
  }
}

function parseFault(payload: string): 'jammed' | 'left-open' | 'cleared' | null {
  if (typeof payload !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const fault = (data as { fault?: unknown }).fault;
  return fault === 'jammed' || fault === 'left-open' || fault === 'cleared' ? fault : null;
}
