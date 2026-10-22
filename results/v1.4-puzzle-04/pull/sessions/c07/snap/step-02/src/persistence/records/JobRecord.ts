export interface JobRecord {
  id: string;
  /** Number plate of the car. */
  plate: string;
  mechanicId: string;
  /** YYYY-MM-DD */
  openedOn: string;
  closedOn: string | null;
  labourMinutes: number;
  partsCents: number;
}
