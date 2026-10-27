import { OpeningRepository } from "../../../application/ports/out/opening-repository";
import { ApplicationRepository } from "../../../application/ports/out/application-repository";
import { InterviewRepository } from "../../../application/ports/out/interview-repository";
import { JobOpening } from "../../../domain/job-opening";
import { CandidateApplication } from "../../../domain/candidate-application";
import { Interview } from "../../../domain/interview";

export class InMemoryOpeningRepository implements OpeningRepository {
  private readonly items = new Map<string, JobOpening>();

  add(opening: JobOpening): void {
    this.items.set(opening.id, opening);
  }

  async findById(id: string): Promise<JobOpening | null> {
    return this.items.get(id) ?? null;
  }
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly items = new Map<string, CandidateApplication>();

  async save(application: CandidateApplication): Promise<void> {
    this.items.set(application.id, application);
  }

  async findById(id: string): Promise<CandidateApplication | null> {
    return this.items.get(id) ?? null;
  }

  async findByOpeningAndEmail(openingId: string, email: string): Promise<CandidateApplication | null> {
    return [...this.items.values()].find((a) => a.openingId === openingId && a.email.value === email) ?? null;
  }
}

export class InMemoryInterviewRepository implements InterviewRepository {
  private readonly items = new Map<string, Interview>();

  async save(interview: Interview): Promise<void> {
    this.items.set(interview.id, interview);
  }

  async findByApplication(applicationId: string): Promise<Interview[]> {
    return [...this.items.values()].filter((i) => i.applicationId === applicationId);
  }
}
