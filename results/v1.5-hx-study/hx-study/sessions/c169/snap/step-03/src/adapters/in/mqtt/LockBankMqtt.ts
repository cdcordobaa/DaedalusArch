import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives latch-fault messages from the MQTT bridge. */
export class LockBankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (m === null) throw new LockerError(NOT_FAULT);
      let fault: unknown;
      try {
        const body: unknown = JSON.parse(payload);
        if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new LockerError(NOT_FAULT);
        fault = (body as Record<string, unknown>).fault;
      } catch (e) {
        if (e instanceof LockerError) throw e;
        throw new LockerError(NOT_FAULT);
      }
      if (fault !== 'jammed' && fault !== 'left-open' && fault !== 'cleared') throw new LockerError(NOT_FAULT);
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
