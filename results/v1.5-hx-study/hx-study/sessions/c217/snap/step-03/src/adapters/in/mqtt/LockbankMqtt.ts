import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const NOT_FAULT = 'not a LockBank fault message';
const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;

/** Receives the latch faults the LockBank hubs publish over MQTT. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const fault = parseFault(payload);
      const m = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      if (m === null || fault === null) throw new LockerError(NOT_FAULT);
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

function parseFault(payload: string): 'jammed' | 'left-open' | 'cleared' | null {
  if (typeof payload !== 'string') return null;
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const fault = (data as Record<string, unknown>)['fault'];
  return fault === 'jammed' || fault === 'left-open' || fault === 'cleared' ? fault : null;
}
