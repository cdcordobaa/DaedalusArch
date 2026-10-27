import { Interview } from "../../../domain/interview";

export interface InterviewRepository {
  save(interview: Interview): Promise<void>;
}
