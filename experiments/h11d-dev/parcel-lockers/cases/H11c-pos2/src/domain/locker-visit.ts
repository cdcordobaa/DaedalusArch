// A domain visit record with its own names, and one field renamed to the lockbox report's opened_at.
export interface LockerVisit {
  readonly parcelId: string;
  readonly lockerId: string;
  readonly opened_at: string;
}
