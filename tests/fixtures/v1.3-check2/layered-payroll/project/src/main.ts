import { PayrollAuditService } from './business/services/PayrollAuditService';
import { PayrollService } from './business/services/PayrollService';
import { EmployeeRepository } from './persistence/EmployeeRepository';
import { PrismaService } from './persistence/PrismaService';
import { TimesheetRepository } from './persistence/TimesheetRepository';
import { PayrollController } from './presentation/handlers/PayrollController';
import { payrollRouter } from './presentation/handlers/http';

const prisma = new PrismaService();
const payroll = new PayrollService(new EmployeeRepository(prisma), new TimesheetRepository(prisma));
export const router = payrollRouter(new PayrollController(payroll, new PayrollAuditService(prisma)));
