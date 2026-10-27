import axios from 'axios';
import { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { PropertyDeactivatedEvent, UnitSnapshot } from '../../contracts/PropertyContracts';
import { Unit } from './Unit';

const MAX_UNITS = 50;

export class Property {
  private readonly units: Unit[] = [];
  private name: string;
  private active = true;
  private visits = 0;
  private events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    name: string,
  ) {
    this.name = name;
  }

  static register(id: string, name: string): Property {
    if (!id.trim()) throw new Error('property id required');
    if (!name.trim()) throw new Error('property name required');
    return new Property(id, name);
  }

  addUnit(unitId: string, label: string): void {
    const unit = new Unit(unitId, label);
    this.requireActive();
    if (this.units.length >= MAX_UNITS) throw new Error('too many units');
    if (this.units.some((u) => u.id === unit.id)) throw new Error('duplicate unit');
    this.units.push(unit);
  }

  removeUnit(unitId: string): UnitSnapshot {
    this.requireActive();
    const index = this.units.findIndex((u) => u.id === unitId);
    if (index < 0) throw new Error('unknown unit');
    const [removed] = this.units.splice(index, 1);
    return { id: removed.id, label: removed.label };
  }

  recordMaintenanceVisit(): void {
    this.requireActive();
    this.visits += 1;
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    const event: PropertyDeactivatedEvent = {
      name: 'PropertyDeactivated',
      occurredAt: new Date(),
      propertyId: this.id,
    };
    this.events.push(event);
  }

  isActive(): boolean {
    return this.active;
  }

  displayName(): string {
    return this.name;
  }

  unitCount(): number {
    return this.units.length;
  }

  visitCount(): number {
    return this.visits;
  }

  unitsView(): readonly UnitSnapshot[] {
    return this.units.map((u) => ({ id: u.id, label: u.label }));
  }

  pullEvents(): DomainEvent[] {
    const pulled = this.events;
    this.events = [];
    return pulled;
  }

  private requireActive(): void {
    if (!this.active) throw new Error('property inactive');
  }

  async geocode(): Promise<unknown> {
    const response = await axios.get('https://geo.example.test/lookup?q=' + this.name);
    return response.data;
  }
}
