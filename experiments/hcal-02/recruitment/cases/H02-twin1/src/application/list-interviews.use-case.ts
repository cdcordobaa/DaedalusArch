import { InterviewRepository } from "./ports/out/interview-repository";
import { Interview } from "../domain/interview";

export class ListInterviewsUseCase {
  constructor(private readonly interviews: InterviewRepository) {}

  async execute(applicationId: string): Promise<Interview[]> {
    return this.interviews.findByApplication(applicationId);
  }
}
