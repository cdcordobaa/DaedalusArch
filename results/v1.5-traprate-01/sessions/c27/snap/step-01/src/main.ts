import { DeskRoutes } from './adapters/in/http/DeskRoutes';
import { SystemClock } from './adapters/out/clock/SystemClock';
import { LoungeData } from './adapters/out/memory/LoungeData';
import { MemoryLoungeStore, MemoryPartnerStore, MemoryPassStore, MemoryVisitStore } from './adapters/out/memory/MemoryStores';
import { ZoneCalendar } from './adapters/out/zones/ZoneCalendar';
import { AdmissionService } from './application/usecases/AdmissionService';
import { PassService } from './application/usecases/PassService';
import { SetupService } from './application/usecases/SetupService';

export interface AppOptions {
  /** The current time as an ISO-8601 string; defaults to the system clock. */
  readonly now?: () => string;
}

/** Composition root: wires the stores, the clock and the calendar to the services, and returns the desk routes. */
export function createApp(options: AppOptions = {}) {
  const data = new LoungeData();
  const lounges = new MemoryLoungeStore(data);
  const partners = new MemoryPartnerStore(data);
  const passes = new MemoryPassStore(data);
  const visits = new MemoryVisitStore(data);
  const clock = new SystemClock(options.now);
  return {
    desk: new DeskRoutes(
      new SetupService(lounges, partners),
      new PassService(passes),
      new AdmissionService(lounges, passes, partners, visits, clock, new ZoneCalendar()),
    ),
  };
}
