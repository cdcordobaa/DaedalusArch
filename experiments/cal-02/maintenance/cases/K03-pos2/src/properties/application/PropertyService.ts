import { EventBus } from '../../shared-kernel/DomainEvent';
import { TransactionManager } from '../../shared-kernel/TransactionManager';
import { WorkOrderCompletedEvent } from '../../workorders/contracts/WorkOrderContracts';
import { PropertySummary } from '../contracts/PropertyContracts';
import { Property } from '../domain/property/Property';
import { PropertyRepository } from '../domain/property/PropertyRepository';

export class PropertyService {
  constructor(
    private readonly repo: PropertyRepository,
    private readonly bus: EventBus,
    private readonly tx: TransactionManager,
  ) {}

  registerProperty(id: string, name: string): void {
    this.tx.run(() => {
      this.repo.save(Property.register(id, name));
    });
  }

  addUnit(propertyId: string, unitId: string, label: string): void {
    this.tx.run(() => {
      const property = this.load(propertyId);
      property.addUnit(unitId, label);
      this.repo.save(property);
    });
  }

  removeUnit(propertyId: string, unitId: string): void {
    this.tx.run(() => {
      const property = this.load(propertyId);
      property.removeUnit(unitId);
      this.repo.save(property);
    });
  }

  deactivate(propertyId: string): void {
    this.tx.run(() => {
      const property = this.load(propertyId);
      property.deactivate();
      this.repo.save(property);
      this.bus.publish(property.pullEvents());
    });
  }

  recordMaintenanceVisit(propertyId: string): void {
    this.tx.run(() => {
      const property = this.load(propertyId);
      property.recordMaintenanceVisit();
      this.repo.save(property);
    });
  }

  onWorkOrderCompleted(event: WorkOrderCompletedEvent): void {
    this.recordMaintenanceVisit(event.propertyId);
  }

  summary(propertyId: string): PropertySummary {
    const property = this.load(propertyId);
    return {
      id: property.id,
      name: property.displayName(),
      active: property.isActive(),
      unitCount: property.unitCount(),
    };
  }

  private load(propertyId: string): Property {
    const property = this.repo.findById(propertyId);
    if (!property) throw new Error('property not found');
    return property;
  }

  transferUnit(fromId: string, toId: string, unitId: string): void {
    this.tx.run(() => {
      const from = this.load(fromId);
      const to = this.load(toId);
      const unit = from.removeUnit(unitId);
      to.addUnit(unit.id, unit.label);
      this.repo.save(from);
      this.repo.save(to);
    });
  }
}
