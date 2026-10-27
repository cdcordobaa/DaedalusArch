import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";

export type EquipmentStatus = "available" | "rented" | "retired";

export interface EquipmentRegistered extends DomainEvent {
  readonly type: "EquipmentRegistered";
  readonly equipmentId: string;
}

export interface EquipmentRetired extends DomainEvent {
  readonly type: "EquipmentRetired";
  readonly equipmentId: string;
}

export class Equipment {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly serial: string,
    private _name: string,
    private _dailyRate: Money,
    private _status: EquipmentStatus,
  ) {}

  static register(id: string, serial: string, name: string, dailyRate: Money): Equipment {
    if (id.trim() === "" || serial.trim() === "") throw new Error("equipment needs an id and a serial");
    const equipment = new Equipment(id, serial, name, dailyRate, "available");
    const event: EquipmentRegistered = { type: "EquipmentRegistered", occurredAt: new Date(), equipmentId: id };
    equipment.events.push(event);
    return equipment;
  }

  get name(): string {
    return this._name;
  }

  get dailyRate(): Money {
    return this._dailyRate;
  }

  get status(): EquipmentStatus {
    return this._status;
  }

  rename(name: string): void {
    if (name.trim() === "") throw new Error("name must not be blank");
    this._name = name;
  }

  markRented(): void {
    if (this._status !== "available") throw new Error("equipment is not available");
    this._status = "rented";
  }

  markReturned(): void {
    if (this._status !== "rented") throw new Error("equipment is not rented");
    this._status = "available";
  }

  retire(): void {
    if (this._status === "rented") throw new Error("cannot retire rented equipment");
    if (this._status === "retired") return;
    this._status = "retired";
    const event: EquipmentRetired = { type: "EquipmentRetired", occurredAt: new Date(), equipmentId: this.id };
    this.events.push(event);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
