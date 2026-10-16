import { PrismaService } from './PrismaService';
import { MemberRecord } from './records/MemberRecord';

export class MemberGateway {
  constructor(private readonly db: PrismaService) {}

  findById(id: string): Promise<MemberRecord | null> {
    return this.db.member.findUnique({ where: { id } });
  }
}
