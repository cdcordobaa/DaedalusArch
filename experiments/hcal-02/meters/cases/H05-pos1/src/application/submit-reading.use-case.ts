import { GridOperatorClient } from "../adapters/out/gridoperator/grid-operator.client";
import { InvalidReadingError, MeterNotFoundError } from "../domain/errors";
import { Kwh } from "../domain/kwh";
import { Reading } from "../domain/reading";
import type { SubmitReadingCommand, SubmitReadingPort } from "./ports/in/submit-reading.port";
import type { GridOperatorPort } from "./ports/out/grid-operator.port";
import type { MeterRepositoryPort } from "./ports/out/meter-repository.port";

export class SubmitReadingUseCase implements SubmitReadingPort {
  private readonly grid: GridOperatorPort;

  constructor(
    private readonly meters: MeterRepositoryPort,
    grid?: GridOperatorPort,
  ) {
    this.grid = grid ?? new GridOperatorClient();
  }

  async execute(command: SubmitReadingCommand): Promise<void> {
    const meter = await this.meters.find(command.meterId);
    if (!meter) {
      throw new MeterNotFoundError(command.meterId);
    }
    const takenAt = new Date(command.takenAt);
    if (Number.isNaN(takenAt.getTime())) {
      throw new InvalidReadingError("takenAt is not a valid date");
    }
    const reference = await this.grid.fetchReference(command.meterId);
    const kwh = Kwh.of(command.kwh);
    meter.record(new Reading(meter.id, kwh, takenAt), reference);
    await this.meters.save(meter);
  }
}
