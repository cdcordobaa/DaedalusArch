import { JobOpening } from "../../../domain/job-opening";

export interface OpeningRepository {
  findById(id: string): Promise<JobOpening | null>;
}
