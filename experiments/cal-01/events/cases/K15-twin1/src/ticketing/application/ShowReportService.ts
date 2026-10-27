import { ShowRepository } from "./ports";

export class ShowReportService {
  constructor(private readonly shows: ShowRepository) {}

  summary(showId: string): string {
    const show = this.shows.findById(showId);
    if (show === undefined) return "unknown show";
    return `${show.getTitle()}: ${show.soldCount()}/${show.getCapacity()} sold`;
  }
}
