import { MaintenanceService } from './business/services/MaintenanceService';
import { MileageService } from './business/services/MileageService';
import { MileageTable } from './persistence/MileageTable';
import { PrismaService } from './persistence/PrismaService';
import { VehicleTable } from './persistence/VehicleTable';
import { WorkOrderTable } from './persistence/WorkOrderTable';
import { WorkshopController } from './presentation/api/WorkshopController';
import { routes } from './presentation/api/routes';

const prisma = new PrismaService();
export const app = routes(new WorkshopController(new MaintenanceService(new VehicleTable(prisma), new WorkOrderTable(prisma)), new MileageService(new MileageTable(prisma))));
