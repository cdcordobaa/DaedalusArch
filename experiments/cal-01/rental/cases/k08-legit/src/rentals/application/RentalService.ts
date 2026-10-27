import { EventBus } from "../../shared-kernel/DomainEvent";
import { Rental } from "../domain/rental/Rental";
import { EquipmentLookup } from "./EquipmentLookup";
import { RentalRepository } from "./RentalRepository";

export interface OpenRental {
  readonly rentalId: string;
  readonly equipmentId: string;
  readonly customerId: string;
  readonly days: number;
}

export class RentalService {
  constructor(
    private readonly repo: RentalRepository,
    private readonly equipment: EquipmentLookup,
    private readonly bus: EventBus,
  ) {}

  async open(cmd: OpenRental): Promise<void> {
    if ([cmd.rentalId, cmd.equipmentId, cmd.customerId].some((v) => v.trim() === "")) {
      throw new Error("ids are required");
    }
    const info = await this.equipment.find(cmd.equipmentId);
    if (!info || !info.available) throw new Error("equipment is not available");
    const rental = Rental.open(cmd.rentalId, cmd.equipmentId, cmd.customerId, cmd.days, info.dailyRate);
    await this.repo.save(rental);
    await this.bus.publish(rental.pullEvents());
  }

  async extend(rentalId: string, extraDays: number): Promise<void> {
    if (rentalId.trim() === "" || !Number.isInteger(extraDays)) throw new Error("rental id and whole days are required");
    const rental = await this.requireRental(rentalId);
    rental.extend(extraDays);
    await this.repo.save(rental);
    await this.bus.publish(rental.pullEvents());
  }

  async giveBack(rentalId: string): Promise<void> {
    const rental = await this.requireRental(rentalId);
    rental.giveBack();
    await this.repo.save(rental);
    await this.bus.publish(rental.pullEvents());
  }

  private async requireRental(id: string): Promise<Rental> {
    const rental = await this.repo.findById(id);
    if (!rental) throw new Error(`rental ${id} not found`);
    return rental;
  }
}
