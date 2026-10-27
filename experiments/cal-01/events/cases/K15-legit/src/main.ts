import { InMemoryVenueRepository, VenueService } from "./venues";
import { InMemoryShowRepository, InMemoryTicketRepository, ShowReportService, TicketingService } from "./ticketing";
import { InMemoryPaymentRepository, PaymentService } from "./payments";

export function createApp() {
  const venues = new VenueService(new InMemoryVenueRepository());
  const shows = new InMemoryShowRepository();
  const tickets = new InMemoryTicketRepository();
  const ticketing = new TicketingService(shows, tickets);
  const payments = new PaymentService(new InMemoryPaymentRepository());
  const reports = new ShowReportService(shows);
  return { venues, ticketing, payments, reports };
}
