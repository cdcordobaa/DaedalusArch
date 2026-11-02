import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import type { ManagerRoutes } from '../http/ManagerRoutes';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Latch faults published by the LockBank hubs, handed over by the MQTT bridge. */
export class LockbankMqtt {
  constructor(
    private readonly managers: ManagerRoutes,
    private readonly lockerStore: MemoryLockers,
  ) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = typeof topic === 'string' ? TOPIC.exec(topic) : null;
      const fault = parseFault(payload);
      if (m === null || fault === null) throw new LockerError(NOT_FAULT);
      const buildingId = m[1] as string;
      const bay = Number(m[2]);
      const locker = this.lockerStore.inBuilding(buildingId).find((l) => l.bay === bay);
      if (locker === undefined) throw new LockerError(`no locker at bay ${String(bay)} of ${buildingId}`);
      const r = fault === 'cleared' ? this.managers.backInService(locker.id) : this.managers.outOfService(locker.id);
      return r.body;
    });
  }
}

function parseFault(payload: string): string | null {
  if (typeof payload !== 'string') return null;
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
