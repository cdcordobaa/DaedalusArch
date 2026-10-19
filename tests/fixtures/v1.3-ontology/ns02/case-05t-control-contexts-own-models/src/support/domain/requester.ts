/** Support's model of whoever opened a ticket. */
export class Requester {
  constructor(
    readonly requesterId: string,
    readonly contactEmail: string,
    readonly preferredLanguage: string,
    readonly openTickets: number,
  ) {}

  mayOpenTicket(): boolean {
    return this.openTickets < 5;
  }
}
