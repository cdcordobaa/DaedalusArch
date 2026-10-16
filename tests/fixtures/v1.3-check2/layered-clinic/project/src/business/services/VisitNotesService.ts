import { PrismaService } from '../../persistence/PrismaService';

export interface VisitNote {
  author: string;
  text: string;
  writtenAt: Date;
}

export class VisitNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async write(appointmentId: string, author: string, text: string): Promise<VisitNote> {
    const row = await this.prisma.visitNote.create({
      data: { id: `${appointmentId}:${Date.now()}`, appointmentId, author, text: text.trim(), writtenAt: new Date() },
    });
    return { author: row.author, text: row.text, writtenAt: row.writtenAt };
  }

  async notesFor(appointmentId: string): Promise<VisitNote[]> {
    const rows = await this.prisma.visitNote.findMany({ where: { appointmentId } });
    return rows.sort((a, b) => a.writtenAt.getTime() - b.writtenAt.getTime()).map((r) => ({ author: r.author, text: r.text, writtenAt: r.writtenAt }));
  }
}
