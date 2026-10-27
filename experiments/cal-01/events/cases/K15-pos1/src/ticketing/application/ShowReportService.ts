import { InMemoryShowRepository } from "../infrastructure/InMemoryShowRepository";

export class ShowReportService {
  private readonly shows = new InMemoryShowRepository();

  summary(showId: string): string {
    const show = this.shows.findById(showId);
    if (show === undefined) return "unknown show";
    return `${show.getTitle()}: ${show.soldCount()}/${show.getCapacity()} sold`;
  }
}
