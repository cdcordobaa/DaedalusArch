import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

/** 200 with the result, or 400 { error } for a refused message. */
function reply(run: () => unknown): MqttReply {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives the latch faults the LockBank hubs publish, as handed over by the MQTT bridge. */
export class LockbankMqtt {
  constructor(private readonly admin: ManageBuildings) {}

  receive(topic: string, payload: string): MqttReply {
    return reply(() => {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (match === null) throw new LockerError(NOT_FAULT);
      const fault = faultOf(payload);
      return this.admin.setServiceAtBay(match[1] as string, Number(match[2]), fault === 'cleared');
    });
  }
}

function faultOf(payload: string): 'jammed' | 'left-open' | 'cleared' {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    throw new LockerError(NOT_FAULT);
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new LockerError(NOT_FAULT);
  const fault = (data as Record<string, unknown>).fault;
  if (fault === 'jammed' || fault === 'left-open' || fault === 'cleared') return fault;
  throw new LockerError(NOT_FAULT);
}
