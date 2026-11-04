/** A damp-room shelf where work in progress dries slowly; one member at a time. */
export interface WetShelf {
  readonly shelf: number;
  readonly memberId: string | null;
}
