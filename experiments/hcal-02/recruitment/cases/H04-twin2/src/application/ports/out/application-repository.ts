import { CandidateApplication } from "../../../domain/candidate-application";

export interface ApplicationRepository {
  save(application: CandidateApplication): Promise<void>;
  findById(id: string): Promise<CandidateApplication | null>;
  countByOpening(openingId: string): Promise<number>;
  findByOpeningAndEmail(openingId: string, email: string): Promise<CandidateApplication | null>;
}
