export interface VisitView {
  readonly visit: string;
  readonly lounge: string;
  readonly guests: number;
  readonly enteredAt: string;
}

export interface OccupancyView {
  readonly lounge: string;
  readonly people: number;
  readonly capacity: number;
}

export interface Admissions {
  enter(passId: string, loungeId: string, guests: number): VisitView;
  leave(visitId: string): { readonly visit: string; readonly leftAt: string };
  occupancy(loungeId: string): OccupancyView;
}
