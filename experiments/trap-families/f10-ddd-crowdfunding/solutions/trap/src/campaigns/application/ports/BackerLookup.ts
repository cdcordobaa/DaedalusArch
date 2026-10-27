/** What campaigns need to know about the people who pledge. */
export interface BackerLookup {
  isRegistered(backerId: string): boolean;
}
