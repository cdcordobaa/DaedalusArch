import { PrismaService } from './PrismaService';
import { AppointmentRecord, PractitionerRecord } from './rows/AppointmentRow';

export class AppointmentDao {
  constructor(private readonly prisma: PrismaService) {}

  get(id: string): Promise<AppointmentRecord | null> {
    return this.prisma.appointment.findUnique({ where: { id } });
  }

  forPractitioner(practitionerId: string): Promise<AppointmentRecord[]> {
    return this.prisma.appointment.findMany({ where: { practitionerId, status: 'booked' } });
  }

  practitioner(id: string): Promise<PractitionerRecord | null> {
    return this.prisma.practitioner.findUnique({ where: { id } });
  }

  async add(record: AppointmentRecord): Promise<void> {
    await this.prisma.appointment.create({ data: record });
  }

  async setStatus(id: string, status: string): Promise<void> {
    await this.prisma.appointment.update({ where: { id }, data: { status } });
  }
}
