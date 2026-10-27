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
  addGuest(visitId: string): { readonly visit: string; readonly guests: number };
  leave(visitId: string): { readonly visit: string; readonly leftAt: string };
  occupancy(loungeId: string): OccupancyView;
}
