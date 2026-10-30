import { PostbirdClient } from 'postbird-sdk';
import { GardenController } from '../adapters/inbound/http/GardenController';
import { InMemoryApplicants } from '../adapters/outbound/memory/InMemoryApplicants';
import { InMemoryOffers } from '../adapters/outbound/memory/InMemoryOffers';
import { InMemoryNoticeboard } from '../adapters/outbound/memory/InMemoryNoticeboard';
import { PostbirdNewsletterAdapter } from '../adapters/outbound/postbird/PostbirdNewsletterAdapter';
import { PostbirdOfferNotifier } from '../adapters/outbound/postbird/PostbirdOfferNotifier';
import { JoinWaitingListService } from '../application/services/plots/JoinWaitingListService';
import { OfferPlotService } from '../application/services/plots/OfferPlotService';
import { NewsletterService } from '../application/services/plots/NewsletterService';
import { StaffNoteService } from '../application/services/admin/StaffNoteService';
import { InMemoryStaffNoteStore } from '../adapters/outbound/memory/admin/InMemoryStaffNoteStore';
import { ToolLoanService } from '../application/services/admin/ToolLoanService';
import { InMemoryToolLoanStore } from '../adapters/outbound/memory/admin/InMemoryToolLoanStore';
import { WaterReadingService } from '../application/services/admin/WaterReadingService';
import { InMemoryWaterReadingStore } from '../adapters/outbound/memory/admin/InMemoryWaterReadingStore';
import { WorkDayService } from '../application/services/admin/WorkDayService';
import { InMemoryWorkDayStore } from '../adapters/outbound/memory/admin/InMemoryWorkDayStore';

/** Composition root. The Postbird key comes from POSTBIRD_API_KEY. */
export function createApp() {
  const postbird = new PostbirdClient({ apiKey: process.env.POSTBIRD_API_KEY ?? '' });
  const applicants = new InMemoryApplicants();
  const board = new InMemoryNoticeboard();
  const list = new JoinWaitingListService(applicants);
  const offers = new OfferPlotService(applicants, new InMemoryOffers(), board, new PostbirdOfferNotifier(postbird));
  const http = new GardenController(list, offers, new NewsletterService(new PostbirdNewsletterAdapter(postbird)));
  const staffNote = new StaffNoteService(new InMemoryStaffNoteStore());
  const toolLoan = new ToolLoanService(new InMemoryToolLoanStore());
  const waterReading = new WaterReadingService(new InMemoryWaterReadingStore());
  const workDay = new WorkDayService(new InMemoryWorkDayStore());
  return {
    join: async (name: string, email: string, member = false) => (await http.postJoin({ name, email, member })).body,
    waitingList: async () => (await http.getList()).body,
    offerPlot: async (plotId: string) => (await http.postOffer(plotId)).body,
    remindPlot: async (plotId: string) => (await http.postRemind(plotId)).body,
    publishNewsletter: async (subject: string, text: string) => (await http.postNewsletter(subject, text)).body,
    noticeboard: () => board.lines(),
    admin: { staffNote, toolLoan, waterReading, workDay },
    http,
  };
}
