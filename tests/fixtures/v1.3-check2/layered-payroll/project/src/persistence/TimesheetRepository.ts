import { PrismaService } from './PrismaService';

export interface TimesheetRecord {
  id: string;
  employeeId: string;
  week: string;
  hours: number;
  approved: boolean;
}

export class TimesheetRepository {
  constructor(private readonly prisma: PrismaService) {}

  byId(id: string): Promise<TimesheetRecord | null> {
    return this.prisma.timesheet.findUnique({ where: { id } });
  }

  forWeek(week: string): Promise<TimesheetRecord[]> {
    return this.prisma.timesheet.findMany({ where: { week } });
  }

  async create(record: TimesheetRecord): Promise<void> {
    await this.prisma.timesheet.create({ data: record });
  }

  async approve(id: string): Promise<void> {
    await this.prisma.timesheet.update({ where: { id }, data: { approved: true } });
  }
}
