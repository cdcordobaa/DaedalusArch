import { CrowdgateClient } from 'crowdgate-sdk';
import { TicketController } from '../adapters/inbound/http/TicketController';
import { CrowdgateEntriesAdapter } from '../adapters/outbound/crowdgate/CrowdgateEntriesAdapter';
import { BuyTicketsService } from '../application/services/visits/BuyTicketsService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { GuidedTourService } from '../application/services/admin/GuidedTourService';
import { InMemoryGuidedTourStore } from '../adapters/outbound/memory/admin/InMemoryGuidedTourStore';
import { LoanRequestService } from '../application/services/admin/LoanRequestService';
import { InMemoryLoanRequestStore } from '../adapters/outbound/memory/admin/InMemoryLoanRequestStore';
import { CloakroomTagService } from '../application/services/admin/CloakroomTagService';
import { InMemoryCloakroomTagStore } from '../adapters/outbound/memory/admin/InMemoryCloakroomTagStore';

/** Composition root. The Crowdgate key comes from CROWDGATE_API_KEY. */
export function createApp() {
  const crowdgate = new CrowdgateClient({ apiKey: process.env.CROWDGATE_API_KEY ?? '' });
  const http = new TicketController(new BuyTicketsService(new CrowdgateEntriesAdapter(crowdgate)));
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const guidedTour = new GuidedTourService(new InMemoryGuidedTourStore());
  const loanRequest = new LoanRequestService(new InMemoryLoanRequestStore());
  const cloakroomTag = new CloakroomTagService(new InMemoryCloakroomTagStore());
  return {
    slots: (day: string) => http.getSlots(day),
    buy: (slot: string, visitors: number) => http.postTicket({ slot, visitors }),
    admin: { staffNote, guidedTour, loanRequest, cloakroomTag },
    http,
  };
}
