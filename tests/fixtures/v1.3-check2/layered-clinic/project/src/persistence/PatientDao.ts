import { PrismaService } from './PrismaService';
import { PatientRecord } from './rows/PatientRow';

export class PatientDao {
  constructor(private readonly prisma: PrismaService) {}

  get(id: string): Promise<PatientRecord | null> {
    return this.prisma.patient.findUnique({ where: { id } });
  }
}
