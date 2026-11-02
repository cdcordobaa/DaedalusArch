import type { ManageBuildings } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';

export interface MqttReply {
  readonly status: number;
  readonly body: unknown;
}

function reply(run: () => unknown): MqttReply {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;

/** Receives the latch faults the LockBank hubs publish, handed over by the MQTT bridge. */
export class LockBankMqtt {
  constructor(private readonly admin: ManageBuildings) {}

  receive(topic: string, payload: string): MqttReply {
    return reply(() => {
      const match = TOPIC.exec(topic);
      const fault = parseFault(payload);
      if (match === null || fault === null) throw new LockerError('not a LockBank fault message');
      return this.admin.setLatchFault(match[1], Number(match[2]), fault !== 'cleared');
    });
  }
}

function parseFault(payload: string): string | null {
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
