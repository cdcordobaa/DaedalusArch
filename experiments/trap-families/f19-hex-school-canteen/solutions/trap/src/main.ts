import { KitchenRoutes } from './adapters/in/http/KitchenRoutes';
import { OfficeRoutes } from './adapters/in/http/OfficeRoutes';
import { OrderRoutes } from './adapters/in/http/OrderRoutes';
import { NightlyRun } from './adapters/in/scheduler/NightlyRun';
import { SystemToday } from './adapters/out/clock/SystemToday';
import { FinanceFolder } from './adapters/out/finance/FinanceFolder';
import { TakingsCsv } from './adapters/out/finance/TakingsCsv';
import { LetterTray } from './adapters/out/letters/LetterTray';
import { CanteenDatabase } from './adapters/out/memory/CanteenDatabase';
import { MemoryDishStore } from './adapters/out/memory/MemoryDishStore';
import { MemoryOrderStore } from './adapters/out/memory/MemoryOrderStore';
import { MemoryPupilStore } from './adapters/out/memory/MemoryPupilStore';
import { EnrolmentService } from './application/usecases/EnrolmentService';
import { LowBalanceLettersService } from './application/usecases/LowBalanceLettersService';
import { MenuService } from './application/usecases/MenuService';
import { OrderingService } from './application/usecases/OrderingService';

export interface AppOptions {
  /** Today's date as YYYY-MM-DD (the system date when left out). */
  today?: () => string;
}

/** Wires the canteen service. */
export function createApp(options: AppOptions = {}) {
  const db = new CanteenDatabase();
  const pupils = new MemoryPupilStore(db);
  const dishes = new MemoryDishStore(db);
  const orders = new MemoryOrderStore(db);
  const today = new SystemToday(options.today);
  const letterTray = new LetterTray();
  const financeFolder = new FinanceFolder();

  return {
    office: new OfficeRoutes(new EnrolmentService(pupils), new MenuService(dishes)),
    orders: new OrderRoutes(new OrderingService(orders, pupils, dishes, today)),
    kitchen: new KitchenRoutes(db),
    nightly: new NightlyRun(new LowBalanceLettersService(pupils, letterTray), new TakingsCsv(db, financeFolder)),
    /** The letters written so far, for whoever prints them. */
    letters: { all: (): string[] => letterTray.all() },
    financeFolder: { read: (name: string): string | null => financeFolder.read(name), names: (): string[] => financeFolder.names() },
  };
}
