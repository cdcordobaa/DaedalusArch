import { ScreenApplication, ScreeningResult } from "./ports/in/screen-application";
import { ApplicationRepository } from "./ports/out/application-repository";
import { OpeningRepository } from "./ports/out/opening-repository";
import { BackgroundCheckGateway } from "./ports/out/background-check-gateway";
import { ScoringService } from "../domain/scoring-service";
import { NotFoundError } from "../domain/errors";

export class ScreenApplicationUseCase implements ScreenApplication {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly openings: OpeningRepository,
    private readonly background: BackgroundCheckGateway,
    private readonly scoring: ScoringService,
  ) {}

  async execute(applicationId: string): Promise<ScreeningResult> {
    const app = await this.applications.findById(applicationId);
    if (!app) {
      throw new NotFoundError("Application", applicationId);
    }
    const opening = await this.openings.findById(app.openingId);
    if (!opening) {
      throw new NotFoundError("Opening", app.openingId);
    }
    const clear = await this.background.isClear(app.candidateName, app.email.value);
    if (!clear) {
      app.reject();
      await this.applications.save(app);
      return { score: 0, passed: false };
    }
    const score = this.scoring.score(app, opening);
    app.recordScore(score);
    await this.applications.save(app);
    return { score, passed: this.scoring.passes(score) };
  }
}
