import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives latch fault messages from the LockBank hubs via the MQTT bridge. */
export class LockBankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      const fault = parseFault(payload);
      if (match === null || fault === null) throw new LockerError(NOT_FAULT);
      const buildingId = match[1];
      const bay = Number(match[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${bay} of ${buildingId}`);
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }
}

function parseFault(payload: string): 'jammed' | 'left-open' | 'cleared' | null {
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const fault = (data as { fault?: unknown }).fault;
  return fault === 'jammed' || fault === 'left-open' || fault === 'cleared' ? fault : null;
}
