import { LockerError } from '../../../domain/LockerError';
import type { Lockers } from '../../../application/ports/out/Lockers';

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

/** 200 with the result, or 400 { error } for a refused message. */
function reply(run: () => unknown): Reply {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const REFUSED = 'not a LockBank fault message';

/** Latch faults published by the LockBank hubs, handed over by the MQTT bridge. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: Lockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const match = TOPIC.exec(topic);
      if (match === null) throw new LockerError(REFUSED);
      const fault = this.faultOf(payload);
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

  private faultOf(payload: string): 'jammed' | 'left-open' | 'cleared' {
    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      throw new LockerError(REFUSED);
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new LockerError(REFUSED);
    const fault = (data as Record<string, unknown>).fault;
    if (fault === 'jammed' || fault === 'left-open' || fault === 'cleared') return fault;
    throw new LockerError(REFUSED);
  }
}
