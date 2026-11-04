import { EventBus } from '../../shared-kernel/EventBus';
import { newId } from '../../shared-kernel/ids';
import { HaulDto } from '../contracts/HaulDto';
import { HaulRecorded } from '../contracts/events';
import { Haul } from '../domain/haul/Haul';
import { HaulRepository } from '../domain/haul/HaulRepository';
import { TruckRepository } from '../domain/truck/TruckRepository';
import { ScalePort } from './ports/ScalePort';

const toDto = (h: Haul): HaulDto => ({ id: h.id, truckId: h.truckId, orderId: h.orderId, ticketNo: h.ticketNo, tonnes: h.tonnes, shiftDate: h.shiftDate });

export type HaulResult = { ok: true; haul: HaulDto } | { ok: false; reason: string };

export class HaulService {
  constructor(
    private readonly trucks: TruckRepository,
    private readonly hauls: HaulRepository,
    private readonly scale: ScalePort,
    private readonly bus: EventBus,
  ) {}

  async recordHaul(truckId: string, orderId: string, shiftDate: string): Promise<HaulResult> {
    const truck = await this.trucks.findById(truckId);
    if (truck === null) throw new Error(`truck ${truckId} not found`);
    const reading = await this.scale.weigh(truck.plate);
    const haulsThisShift = await this.hauls.findByTruckAndShift(truckId, shiftDate);
    const wouldHaul = haulsThisShift.reduce((sum, h) => sum + h.tonnes, 0) + reading.netTonnes;
    if (wouldHaul > truck.shiftAllowanceTonnes) return { ok: false, reason: `truck ${truck.id} is at its shift allowance` };
    const haul = Haul.record(newId('HL'), truck.id, orderId, reading.ticketNo, reading.netTonnes, shiftDate);
    await this.hauls.save(haul);
    const event: HaulRecorded = { type: 'haulage.HaulRecorded', occurredAt: new Date().toISOString(), haulId: haul.id, orderId, tonnes: haul.tonnes };
    await this.bus.publish(event);
    return { ok: true, haul: toDto(haul) };
  }
}
