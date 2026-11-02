import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const NOT_FAULT = 'not a LockBank fault message';
const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;

/** Receives latch faults published by the LockBank hubs. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (match === null) throw new LockerError(NOT_FAULT);
      const fault = this.parseFault(payload);
      const buildingId = match[1] as string;
      const bay = Number(match[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }

  private parseFault(payload: string): string {
    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      throw new LockerError(NOT_FAULT);
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new LockerError(NOT_FAULT);
    const fault = (data as Record<string, unknown>)['fault'];
    if (fault !== 'jammed' && fault !== 'left-open' && fault !== 'cleared') throw new LockerError(NOT_FAULT);
    return fault;
  }
}
