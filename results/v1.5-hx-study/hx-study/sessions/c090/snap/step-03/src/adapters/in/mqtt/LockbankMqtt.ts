import { LockerError } from '../../../domain/LockerError';
import type { Lockers } from '../../../application/ports/out/Lockers';

export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

function reply(run: () => unknown): Reply {
  try {
    return { status: 200, body: run() };
  } catch (e) {
    if (e instanceof LockerError) return { status: 400, body: { error: e.message } };
    throw e;
  }
}

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives latch-fault messages from the MQTT bridge. */
export class LockbankMqtt {
  constructor(private readonly lockerStore: Lockers) {}

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
  const fault = (data as { fault?: unknown }).fault;
  return fault === 'jammed' || fault === 'left-open' || fault === 'cleared' ? fault : undefined;
}
