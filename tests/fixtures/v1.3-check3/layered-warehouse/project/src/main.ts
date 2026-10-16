import { CycleCountService } from './business/services/CycleCountService';
import { ReceivingService } from './business/services/ReceivingService';
import { PrismaService } from './persistence/PrismaService';
import { BinTable } from './persistence/tables/BinTable';
import { ItemTable } from './persistence/tables/ItemTable';
import { StockCountTable } from './persistence/tables/StockCountTable';
import { StockController } from './presentation/controllers/StockController';
import { stockRoutes } from './presentation/controllers/routes';

const prisma = new PrismaService();
export const router = stockRoutes(new StockController(new ReceivingService(new ItemTable(prisma), new BinTable(prisma)), new CycleCountService(new StockCountTable(prisma))));
