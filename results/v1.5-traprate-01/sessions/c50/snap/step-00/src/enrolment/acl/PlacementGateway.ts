import type { PlacementDesk } from '../../placement/published/PlacementDesk';
import type { StudentRegistry } from '../application/ports/StudentRegistry';

/** Asks the placement office, through its published desk, what the course desk needs to know. */
export class PlacementGateway implements StudentRegistry {
  constructor(private readonly desk: PlacementDesk) {}

  isRegistered(studentId: string): boolean {
    return this.desk.sheet(studentId) !== undefined;
  }
}
