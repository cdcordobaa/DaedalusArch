import { EventBus } from "../../shared-kernel/DomainEvent";
import { Money } from "../../shared-kernel/Money";
import { RentalCancelled, RentalOpened, RentalReturned } from "../../rentals/contracts/RentalEvents";
import { EquipmentSummary } from "../contracts/EquipmentSummary";
import { Equipment } from "../domain/equipment/Equipment";
import { EquipmentRepository } from "./EquipmentRepository";

export interface RegisterEquipment {
  readonly id: string;
  readonly serial: string;
  readonly name: string;
  readonly dailyRateCents: number;
  readonly currency: string;
}

export class CatalogService {
  constructor(
    private readonly repo: EquipmentRepository,
    private readonly bus: EventBus,
  ) {}

  async register(cmd: RegisterEquipment): Promise<void> {
    const equipment = Equipment.register(cmd.id, cmd.serial, cmd.name, Money.of(cmd.dailyRateCents, cmd.currency));
    await this.repo.save(equipment);
    await this.bus.publish(equipment.pullEvents());
  }

  async retire(id: string): Promise<void> {
    const equipment = await this.requireEquipment(id);
    equipment.retire();
    await this.repo.save(equipment);
    await this.bus.publish(equipment.pullEvents());
  }

  async getSummary(id: string): Promise<EquipmentSummary | undefined> {
    const equipment = await this.repo.findById(id);
    if (!equipment) return undefined;
    return {
      id: equipment.id,
      name: equipment.name,
      available: equipment.status === "available",
      dailyRateCents: equipment.dailyRate.cents,
      currency: equipment.dailyRate.currency,
    };
  }

  async onRentalOpened(event: RentalOpened): Promise<void> {
    const equipment = await this.requireEquipment(event.equipmentId);
    equipment.markRented();
    await this.repo.save(equipment);
  }

  async onRentalReturned(event: RentalReturned): Promise<void> {
    const equipment = await this.requireEquipment(event.equipmentId);
    equipment.markReturned();
    await this.repo.save(equipment);
  }

  private async requireEquipment(id: string): Promise<Equipment> {
    const equipment = await this.repo.findById(id);
    if (!equipment) throw new Error(`equipment ${id} not found`);
    return equipment;
  }

  async onRentalCancelled(event: RentalCancelled): Promise<void> {
    const equipment = await this.requireEquipment(event.equipmentId);
    equipment.markReturned();
    await this.repo.save(equipment);
  }
}
