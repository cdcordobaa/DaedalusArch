import { DomainEvent } from '../../shared-kernel/DomainEvent';

export interface PropertySummary {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly unitCount: number;
}

export interface UnitSnapshot {
  readonly id: string;
  readonly label: string;
}

export interface PropertyDeactivatedEvent extends DomainEvent {
  readonly name: 'PropertyDeactivated';
  readonly propertyId: string;
}

export interface PropertyDetail {
  readonly id: string;
  readonly units: readonly UnitSnapshot[];
}
