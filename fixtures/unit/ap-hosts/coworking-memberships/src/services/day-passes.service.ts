import { DayPassOrder } from '../domain/day-pass';
import { isIsoDate } from '../domain/desk-day';
import { PrismaService } from '../prisma/prisma';
import { ValidationError } from './errors';
import { DayPassView } from './dto/billing.dto';

/** Drop-in passes for visitors without a membership. */
export class DayPassesService {
  constructor(private readonly prisma: PrismaService) {}

  async sell(email: string, date: string, quantity: number): Promise<DayPassView> {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new ValidationError('Between 1 and 20 passes per order; larger groups book an event space');
    }
    if (!isIsoDate(date)) {
      throw new ValidationError(`date must look like 2024-06-03; got ${date}`);
    }
    const order = new DayPassOrder(quantity);
    const pass = await this.prisma.dayPass.create({ data: { email, date, quantity, priceCents: order.total().cents } });
    return { id: pass.id, date: pass.date, quantity: pass.quantity, totalCents: pass.priceCents };
  }

  async soldFor(date: string): Promise<number> {
    const passes = await this.prisma.dayPass.findMany({ where: { date } });
    return passes.reduce((n, p) => n + p.quantity, 0);
  }
}
