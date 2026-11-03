import { LotNotFoundError, PressingUnavailableError } from '../domain/errors';
import {
  GrowerNotifierPort,
  LotRepositoryPort,
  PressingError,
  PressingServicePort,
  SendToPressCommand,
  SendToPressPort,
  SendToPressResult,
} from './ports';

export class SendToPressUseCase implements SendToPressPort {
  constructor(
    private readonly lots: LotRepositoryPort,
    private readonly pressing: PressingServicePort,
    private readonly notifier: GrowerNotifierPort,
  ) {}

  async send(command: SendToPressCommand): Promise<SendToPressResult> {
    const lot = await this.lots.findById(command.lotId);
    if (lot === null) throw new LotNotFoundError(command.lotId);
    try {
      const ticket = await this.pressing.book({ variety: lot.variety, crates: lot.crates, deliveredOn: lot.deliveredOn });
      lot.sendToPress(ticket);
    } catch (e) {
      if (e instanceof PressingError) throw new PressingUnavailableError(e.message);
      throw e;
    }
    await this.lots.save(lot);
    await this.notifier.notify(lot.growerId, lot.id, lot.currentStatus);
    return { lotId: lot.id, status: lot.currentStatus };
  }
}
