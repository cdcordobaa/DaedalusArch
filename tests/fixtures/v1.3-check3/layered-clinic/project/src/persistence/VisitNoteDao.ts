import { PrismaService } from './PrismaService';
import { VisitNoteRecord } from './rows/VisitNoteRow';

export class VisitNoteDao {
  constructor(private readonly prisma: PrismaService) {}

  add(record: VisitNoteRecord): Promise<VisitNoteRecord> {
    return this.prisma.visitNote.create({ data: record });
  }

  forAppointment(appointmentId: string): Promise<VisitNoteRecord[]> {
    return this.prisma.visitNote.findMany({ where: { appointmentId } });
  }
}
