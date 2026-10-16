import { Membership as MembershipRow } from '@prisma/client';
import { Clock } from '../domain/clock';
import { isIsoDate } from '../domain/desk-day';
import { MAX_PAUSE_WEEKS, Membership } from '../domain/membership';
import { MembershipPlan } from '../domain/membership-plan';
import { toMembership } from '../prisma/membership.mapper';
import { PrismaService } from '../prisma/prisma';
import { NotFoundError, ValidationError } from './errors';
import { MembershipView, toMembershipView } from './dto/membership.dto';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async start(memberId: string, planCode: string, startsOn: string): Promise<MembershipView> {
    if (!isIsoDate(startsOn)) {
      throw new ValidationError(`startsOn must be a date like 2024-06-01; got ${startsOn}`);
    }
    const plan = MembershipPlan.byCode(planCode);
    const open = await this.prisma.membership.count({ where: { memberId, status: 'active' } });
    if (open > 0) {
      throw new ValidationError('The member already has an active membership; change plans instead');
    }
    const row = await this.prisma.membership.create({
      data: { memberId, planCode: plan.code, status: 'active', startsOn: new Date(startsOn), pausedUntil: null, meetingCredits: plan.meetingCreditsPerMonth },
    });
    return toMembershipView(row);
  }

  async pause(id: string, weeks: number, reason: string): Promise<MembershipView> {
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_PAUSE_WEEKS) {
      throw new ValidationError(`A pause lasts 1 to ${String(MAX_PAUSE_WEEKS)} whole weeks`);
    }
    if (reason.trim().length === 0) {
      throw new ValidationError('Tell the community team why the membership is paused');
    }
    const membership = await this.load(id);
    membership.pause(new Date(this.clock.now().getTime() + weeks * WEEK_MS));
    return this.store(membership);
  }

  async resume(id: string): Promise<MembershipView> {
    const membership = await this.load(id);
    membership.resume();
    return this.store(membership);
  }

  async cancel(id: string, effectiveOn: string): Promise<MembershipView> {
    if (!isIsoDate(effectiveOn)) {
      throw new ValidationError(`effectiveOn must be a date like 2024-06-30; got ${effectiveOn}`);
    }
    const membership = await this.load(id);
    membership.cancel();
    return this.store(membership);
  }

  private async load(id: string): Promise<Membership> {
    const row = await this.prisma.membership.findUnique({ where: { id } });
    if (row === null) {
      throw new NotFoundError(`Membership ${id} not found`);
    }
    return toMembership(row);
  }

  private async store(membership: Membership): Promise<MembershipView> {
    const row: MembershipRow = await this.prisma.membership.update({ where: { id: membership.id }, data: { status: membership.status, pausedUntil: membership.pausedUntil } });
    return toMembershipView(row);
  }
}
