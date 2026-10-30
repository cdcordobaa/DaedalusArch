import { SendToPrintPort } from '../../../application/ports/in/send-to-print.port';

export class ResendCommand {
  constructor(private readonly sendToPrint: SendToPrintPort) {}

  async run(argv: readonly string[]): Promise<string> {
    const orderId = argv[0];
    if (orderId === undefined || orderId === '') return 'usage: resend <order-id>';
    const result = await this.sendToPrint.send({ orderId });
    return `${result.orderId}: ${result.status}`;
  }
}
