import type { ReportLatchFaults } from '../../../application/ports/in/ManageBuildings';
import { LockerError } from '../../../domain/LockerError';
import { reply, type Reply } from '../http/reply';

const TOPIC = /^lockbank\/([^/]+)\/bay\/([1-9][0-9]*)\/fault$/;
const NOT_FAULT = 'not a LockBank fault message';

/** Receives the latch faults the LockBank hubs publish over MQTT. */
export class LockbankMqtt {
  constructor(private readonly faults: ReportLatchFaults) {}

  receive(topic: string, payload: string): Reply {
    return reply(() => {
      const m = TOPIC.exec(topic);
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
      return this.faults.setBayService(m[1], Number(m[2]), fault === 'cleared');
    });
  }
}
