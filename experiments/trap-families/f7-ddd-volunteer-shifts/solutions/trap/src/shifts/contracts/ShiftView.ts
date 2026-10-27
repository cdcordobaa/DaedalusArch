/** What other parts of the system may know about a shift. */
export interface ShiftView {
  readonly id: string;
  readonly name: string;
  readonly places: number;
  readonly placesFree: number;
  readonly cancelled: boolean;
}
