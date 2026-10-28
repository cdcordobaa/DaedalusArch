import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from './reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Latch faults published by the LockBank hubs, handed over by the MQTT bridge. */
export class LockbankMqttRoutes {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const match = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      const fault = parseFault(payload);
      if (match === null || fault === undefined) throw new LockerError(NOT_FAULT);
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
}

function parseFault(payload: string): 'jammed' | 'left-open' | 'cleared' | undefined {
  if (typeof payload !== 'string') return undefined;
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return undefined;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return undefined;
  const fault = (data as Record<string, unknown>)['fault'];
  return fault === 'jammed' || fault === 'left-open' || fault === 'cleared' ? fault : undefined;
}
