/** How long a drive through some stops takes, and whether it needs a ferry. */
export interface TripTime {
  readonly seconds: number;
  readonly byFerry: boolean;
}
