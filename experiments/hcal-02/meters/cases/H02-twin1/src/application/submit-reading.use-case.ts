import { InvalidReadingError, MeterNotFoundError } from "../domain/errors";
import { Kwh } from "../domain/kwh";
import type { Meter } from "../domain/meter";
import { Reading } from "../domain/reading";
import type { SubmitReadingCommand, SubmitReadingPort } from "./ports/in/submit-reading.port";
import type { GridOperatorPort } from "./ports/out/grid-operator.port";
import type { MeterRepositoryPort } from "./ports/out/meter-repository.port";

export class SubmitReadingUseCase implements SubmitReadingPort {
  constructor(
    private readonly meters: MeterRepositoryPort,
    private readonly grid: GridOperatorPort,
  ) {}

  async execute(command: SubmitReadingCommand): Promise<void> {
    const meter = await this.loadMeter(command.meterId);
    const takenAt = new Date(command.takenAt);
    if (Number.isNaN(takenAt.getTime())) {
      throw new InvalidReadingError("takenAt is not a valid date");
    }
    const reference = await this.grid.fetchReference(command.meterId);
    const kwh = Kwh.of(command.kwh);
    meter.record(new Reading(meter.id, kwh, takenAt), reference);
    await this.meters.save(meter);
  }

  private async loadMeter(id: string): Promise<Meter> {
    const meter = await this.meters.find(id);
    if (!meter) {
      throw new MeterNotFoundError(id);
    }
    return meter;
  }
}
