import type { CommandBus, ShipOrder } from '../application/ports/CommandBus';

export class InMemoryCommandBus implements CommandBus {
  readonly sent: ShipOrder[] = [];

  async send(command: ShipOrder): Promise<void> {
    this.sent.push(command);
  }
}
