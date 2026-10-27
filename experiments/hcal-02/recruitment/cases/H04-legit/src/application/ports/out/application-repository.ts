import { ApplicationStatus, CandidateApplication } from "../../../domain/candidate-application";

export type PageToken = string;
export interface SqlLikeFilter {
  readonly status: ApplicationStatus;
  readonly after?: PageToken;
}

export interface ApplicationRepository {
  save(application: CandidateApplication): Promise<void>;
  findById(id: string): Promise<CandidateApplication | null>;
  listByStatus(filter: SqlLikeFilter, limit: number): Promise<ReadonlyArray<CandidateApplication>>;
  findByOpeningAndEmail(openingId: string, email: string): Promise<CandidateApplication | null>;
}
