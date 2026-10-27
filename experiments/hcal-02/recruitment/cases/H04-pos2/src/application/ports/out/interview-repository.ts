import { Interview } from "../../../domain/interview";
import { DbTransaction } from "../../../adapters/out/persistence/db-handle";

export interface InterviewRepository {
  save(interview: Interview): Promise<void>;
  saveWithin(interview: Interview, tx: DbTransaction): Promise<void>;
}
