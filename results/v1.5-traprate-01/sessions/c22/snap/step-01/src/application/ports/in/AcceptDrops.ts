export interface DropReceipt {
  readonly dropId: string;
  readonly lockerId: string;
  readonly bay: number;
  readonly code: string;
}

export interface DropView {
  readonly id: string;
  readonly building: string;
  readonly locker: string;
  readonly apartment: string;
  readonly status: string;
  readonly droppedAt: string;
  readonly closedAt: string | null;
}

/** What the laundry service does: leave finished laundry for an apartment, and look a drop up. */
export interface AcceptDrops {
  dropOff(buildingId: string, apartment: string, size: string): DropReceipt;
  drop(dropId: string): DropView;
}
