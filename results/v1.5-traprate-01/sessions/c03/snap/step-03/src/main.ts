import { OfficeRoutes } from './adapters/in/http/OfficeRoutes';
import { OrderRoutes } from './adapters/in/http/OrderRoutes';
import { KitchenRoutes } from './adapters/in/http/KitchenRoutes';
import { NightlyRun } from './adapters/in/scheduler/NightlyRun';
import { SystemToday } from './adapters/out/clock/SystemToday';
import { LetterTray } from './adapters/out/letters/LetterTray';
import { CanteenDatabase } from './adapters/out/memory/CanteenDatabase';
import { MemoryDishStore } from './adapters/out/memory/MemoryDishStore';
import { MemoryFinanceFolder } from './adapters/out/memory/MemoryFinanceFolder';
import { MemoryOrderStore } from './adapters/out/memory/MemoryOrderStore';
import { MemoryPupilStore } from './adapters/out/memory/MemoryPupilStore';
import { EnrolmentService } from './application/usecases/EnrolmentService';
import { FinanceExportService } from './application/usecases/FinanceExportService';
import { LowBalanceLettersService } from './application/usecases/LowBalanceLettersService';
import { MenuService } from './application/usecases/MenuService';
import { OrderingService } from './application/usecases/OrderingService';
import { TallyService } from './application/usecases/TallyService';

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
  const financeFolder = new MemoryFinanceFolder();

  return {
    office: new OfficeRoutes(new EnrolmentService(pupils), new MenuService(dishes)),
    orders: new OrderRoutes(new OrderingService(orders, pupils, dishes, today)),
    kitchen: new KitchenRoutes(new TallyService(orders, pupils, dishes)),
    nightly: new NightlyRun(new LowBalanceLettersService(pupils, letterTray), new FinanceExportService(orders, pupils, financeFolder)),
    /** The files written for the finance office. */
    financeFolder: {
      read: (name: string): string | null => financeFolder.read(name),
      names: (): string[] => financeFolder.names(),
    },
    /** The letters written so far, for whoever prints them. */
    letters: { all: (): string[] => letterTray.all() },
  };
}
