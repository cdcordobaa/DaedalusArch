import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from './reply';

const NOT_FAULT = 'not a LockBank fault message';

/** Receives the latch faults the LockBank hubs publish over MQTT. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = /^lockbank\/([^/]+)\/bay\/(0|[1-9][0-9]*)\/fault$/.exec(String(topic));
      if (m === null) throw new LockerError(NOT_FAULT);
      const fault = faultOf(payload);
      const buildingId = m[1] as string;
      const bay = Number(m[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }
}

function faultOf(payload: string): string {
  let data: unknown;
  try {
    data = JSON.parse(String(payload));
  } catch {
    throw new LockerError(NOT_FAULT);
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new LockerError(NOT_FAULT);
  const fault = (data as Record<string, unknown>)['fault'];
  if (fault !== 'jammed' && fault !== 'left-open' && fault !== 'cleared') throw new LockerError(NOT_FAULT);
  return fault;
}
