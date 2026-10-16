import { PrismaService } from './PrismaService';

export interface EmployeeRecord {
  id: string;
  name: string;
  hourlyRateCents: number;
  contract: string;
  active: boolean;
}

export class EmployeeRepository {
  constructor(private readonly prisma: PrismaService) {}

  byId(id: string): Promise<EmployeeRecord | null> {
    return this.prisma.employee.findUnique({ where: { id } });
  }

  active(): Promise<EmployeeRecord[]> {
    return this.prisma.employee.findMany({ where: { active: true } });
  }
}
