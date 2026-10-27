/** What other parts of the system may know about a car park. */
export interface CarParkView {
  readonly id: string;
  readonly name: string;
  readonly bays: number;
  readonly baysFree: number;
  readonly closed: boolean;
}
