export class WorkOrderClosed extends Error {}

export class WorkOrder {
  id: string;
  plate: string;
  description: string;
  estimatedHours: number;
  loggedHours: number;
  state: 'open' | 'done';

  constructor(id: string, plate: string, description: string, estimatedHours: number, loggedHours = 0, state: 'open' | 'done' = 'open') {
    this.id = id;
    this.plate = plate;
    this.description = description;
    this.estimatedHours = estimatedHours;
    this.loggedHours = loggedHours;
    this.state = state;
  }

  log(hours: number): void {
    if (this.state === 'done') throw new WorkOrderClosed(`Work order ${this.id} is closed`);
    this.loggedHours += hours;
  }

  finish(): void {
    if (this.state === 'done') throw new WorkOrderClosed(`Work order ${this.id} is closed`);
    this.state = 'done';
  }

  overrun(): number {
    return Math.max(0, this.loggedHours - this.estimatedHours);
  }
}
