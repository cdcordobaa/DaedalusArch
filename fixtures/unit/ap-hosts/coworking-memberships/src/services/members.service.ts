import { PrismaService } from '../prisma/prisma';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { MemberView, toMemberView } from './dto/member.dto';

export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  async register(fullName: string, email: string, company: string | null): Promise<MemberView> {
    if (fullName.trim().length < 2) {
      throw new ValidationError('Please give the member\'s full name');
    }
    if (email.indexOf('@') < 1) {
      throw new ValidationError(`Invalid email address ${email}`);
    }
    const normalized = email.trim().toLowerCase();
    if ((await this.prisma.member.count({ where: { email: normalized } })) > 0) {
      throw new ConflictError(`${normalized} is already a member`);
    }
    const member = await this.prisma.member.create({ data: { fullName: fullName.trim(), email: normalized, company } });
    return toMemberView(member);
  }

  async findOne(id: string): Promise<MemberView> {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (member === null) {
      throw new NotFoundError(`Member ${id} not found`);
    }
    return toMemberView(member);
  }

  async byCompany(company: string): Promise<MemberView[]> {
    const members = await this.prisma.member.findMany({ where: { company }, orderBy: { fullName: 'asc' } });
    return members.map(toMemberView);
  }
}
