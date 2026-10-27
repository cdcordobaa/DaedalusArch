import { LockerError } from '../../../domain/LockerError';
import type { MemoryLockers } from '../../out/memory/MemoryLockers';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/(\d+)\/fault$/;

/** Messages from the MQTT bridge: topic lockbank/<building>/bay/<n>/fault, payload {"fault": ...}. */
export class LockBankMqtt {
  constructor(private readonly lockerStore: MemoryLockers) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = TOPIC.exec(topic);
      let fault = '';
      try {
        fault = String((JSON.parse(payload) as { fault?: unknown }).fault ?? '');
      } catch {
        fault = '';
      }
      if (m === null || !['jammed', 'left-open', 'cleared'].includes(fault)) throw new LockerError('not a LockBank fault message');
      const locker = this.lockerStore.inBuilding(m[1]!).find((l) => l.bay === Number(m[2]));
      if (locker === undefined) throw new LockerError(`no locker at bay ${m[2]!} of ${m[1]!}`);
      if (fault === 'cleared') locker.returnToService();
      else locker.takeOutOfService();
      this.lockerStore.save(locker);
      return { locker: locker.id, inService: locker.inService };
    });
  }
}
