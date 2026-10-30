import { DispatchCallOutPort } from '../../../application/ports/in/dispatch-call-out.port';

export class DispatchCommand {
  constructor(private readonly dispatchCallOut: DispatchCallOutPort) {}

  async run(args: string[]): Promise<string> {
    const result = await this.dispatchCallOut.dispatch({ callOutId: args[0] ?? '' });
    return `dispatch ${result.callOutId}: ${result.status}`;
  }
}
