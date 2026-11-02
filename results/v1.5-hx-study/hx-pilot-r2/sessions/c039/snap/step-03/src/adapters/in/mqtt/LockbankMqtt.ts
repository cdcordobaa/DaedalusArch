import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const FAULTS = ['jammed', 'left-open', 'cleared'];

const NOT_FAULT = 'not a LockBank fault message';

/** Latch faults published by the LockBank hubs. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (m === null) throw new LockerError(NOT_FAULT);
      let data: unknown;
      try {
        data = JSON.parse(String(payload));
      } catch {
        throw new LockerError(NOT_FAULT);
      }
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new LockerError(NOT_FAULT);
      const fault = (data as { fault?: unknown }).fault;
      if (typeof fault !== 'string' || !FAULTS.includes(fault)) throw new LockerError(NOT_FAULT);

      const buildingId = m[1] as string;
      const bay = Number(m[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
      // Same effect on the locker as the managers' out-of-service switch.
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }
}
