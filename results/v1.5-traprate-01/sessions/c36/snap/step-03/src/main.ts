import { ManagerRoutes } from './adapters/in/http/ManagerRoutes';
import { ResidentRoutes } from './adapters/in/http/ResidentRoutes';
import { LaundryRoutes } from './adapters/in/http/LaundryRoutes';
import { LockbankMqttRoutes } from './adapters/in/http/LockbankMqttRoutes';
import { BuildingClock } from './adapters/out/clock/BuildingClock';
import { SeededCodes } from './adapters/out/codes/SeededCodes';
import { LockBankDriver } from './adapters/out/lockbank/LockBankDriver';
import { LockBankDoorLatch } from './adapters/out/lockbank/LockBankDoorLatch';
import { LockBankHub } from './adapters/out/lockbank/LockBankHub';
import { MemoryBuildings } from './adapters/out/memory/MemoryBuildings';
import { MemoryDrops } from './adapters/out/memory/MemoryDrops';
import { MemoryLockers } from './adapters/out/memory/MemoryLockers';
import { BuildingService } from './application/services/BuildingService';
import { DropOffService } from './application/services/DropOffService';
import { TakeBackService } from './application/services/TakeBackService';
import { PickupService } from './application/services/PickupService';

export interface AppOptions {
  /** Now, as YYYY-MM-DDTHH:MM; defaults to the system clock (UTC). */
  readonly now?: () => string;
  /** Seed for the pickup codes. */
  readonly codeSeed?: number;
  /** The LockBank site key. */
  readonly lockbankKey?: string;
}

/** Composition root. `hardware` is the stand-in LockBank hub, for tests and demos. */
export function createApp(options: AppOptions = {}) {
  const now = options.now ?? (() => new Date().toISOString().slice(0, 16));
  const hub = new LockBankHub();
  const lockbank = new LockBankDriver(hub, options.lockbankKey ?? 'lb-site-key-dev');
  const buildings = new MemoryBuildings();
  const lockers = new MemoryLockers();
  const drops = new MemoryDrops();
  const clock = new BuildingClock(now);
  const admin = new BuildingService(buildings, lockers);
  const intake = new DropOffService(buildings, lockers, drops, new SeededCodes(options.codeSeed ?? 271828), clock);
  const pickups = new PickupService(drops, lockers, clock, new LockBankDoorLatch(lockbank));
  const takeBacks = new TakeBackService(drops, lockers, clock, new LockBankDoorLatch(lockbank));
  return {
    managers: new ManagerRoutes(admin, lockers, lockbank),
    laundry: new LaundryRoutes(intake, takeBacks),
    residents: new ResidentRoutes(pickups),
    lockbankMqtt: new LockbankMqttRoutes(lockers),
    hardware: {
      jam: (hubId: string, bay: number) => hub.jam(hubId, bay),
      unjam: (hubId: string, bay: number) => hub.unjam(hubId, bay),
      opened: () => hub.opened(),
    },
  };
}
