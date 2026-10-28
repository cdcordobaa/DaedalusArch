/** What campaigns need to know about the people who pledge. */
export interface BackerLookup {
  isRegistered(backerId: string): boolean;
  /** The backer's standing as their profile shows it; undefined when there is no such backer. */
  standingOf(backerId: string): string | undefined;
}
