import { SchedulingService } from './business/services/SchedulingService';
import { VisitNotesService } from './business/services/VisitNotesService';
import { AppointmentDao } from './persistence/AppointmentDao';
import { PatientDao } from './persistence/PatientDao';
import { PrismaService } from './persistence/PrismaService';
import { AppointmentsController } from './presentation/controllers/AppointmentsController';
import { appointmentRouter } from './presentation/server';

const prisma = new PrismaService();
export const router = appointmentRouter(
  new AppointmentsController(new SchedulingService(new PatientDao(prisma), new AppointmentDao(prisma)), new VisitNotesService(prisma)),
);
