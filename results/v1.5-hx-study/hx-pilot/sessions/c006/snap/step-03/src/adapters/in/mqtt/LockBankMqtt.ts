import { LockerError } from '../../../domain/LockerError';
import type { Lockers } from '../../../application/ports/out/Lockers';

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
const FAULTS = ['jammed', 'left-open', 'cleared'];

/** Consumes the latch faults the LockBank hubs publish over MQTT. */
export class LockBankMqtt {
  constructor(private readonly lockerStore: Lockers) {}

  /** A fault takes the locker out of service, as the manager's switch does; `cleared` puts it back. */
  receive(topic: string, payload: string): MqttReply {
    return reply(() => {
      const match = TOPIC.exec(topic);
      const fault = faultOf(payload);
      if (match === null || fault === undefined) throw new LockerError('not a LockBank fault message');
      const buildingId = match[1];
      const bay = Number(match[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }
}

function faultOf(payload: string): string | undefined {
  try {
    const data: unknown = JSON.parse(payload);
    if (typeof data !== 'object' || data === null) return undefined;
    const fault = (data as { fault?: unknown }).fault;
    return typeof fault === 'string' && FAULTS.includes(fault) ? fault : undefined;
  } catch {
    return undefined;
  }
}
