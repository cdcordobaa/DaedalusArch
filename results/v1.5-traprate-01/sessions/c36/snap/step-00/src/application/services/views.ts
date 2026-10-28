import type { Drop } from '../../domain/Drop';
import type { DropView } from '../ports/in/AcceptDrops';

export const viewOf = (d: Drop): DropView => ({
  id: d.id,
  building: d.buildingId,
  locker: d.lockerId,
  apartment: d.apartment,
  status: d.status,
  droppedAt: d.droppedAt,
  closedAt: d.closedAt,
});
