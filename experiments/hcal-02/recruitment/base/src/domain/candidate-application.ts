import { Email } from "./email";
import { InvalidTransitionError } from "./errors";

export type ApplicationStatus = "submitted" | "screened" | "rejected" | "interviewing";

export class CandidateApplication {
  private _status: ApplicationStatus = "submitted";
  private _score: number | null = null;

  constructor(
    readonly id: string,
    readonly openingId: string,
    readonly candidateName: string,
    readonly email: Email,
    readonly yearsExperience: number,
  ) {}

  get status(): ApplicationStatus { return this._status; }
  get score(): number | null { return this._score; }

  recordScore(score: number): void {
    if (this._status !== "submitted") {
      throw new InvalidTransitionError(this._status, "screened");
    }
    this._score = score;
    this._status = "screened";
  }

  reject(): void { this._status = "rejected"; }

  startInterviewing(): void {
    if (this._status !== "screened") {
      throw new InvalidTransitionError(this._status, "interviewing");
    }
    this._status = "interviewing";
  }
}
