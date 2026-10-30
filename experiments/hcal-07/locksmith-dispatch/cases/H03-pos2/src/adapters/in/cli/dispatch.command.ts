import { CallOutController } from '../http/call-out.controller';

export class DispatchCommand {
  constructor(private readonly controller: CallOutController) {}

  async run(args: string[]): Promise<string> {
    const res = await this.controller.postDispatch({ method: 'POST', path: '/call-outs/dispatch', params: { id: args[0] ?? '' }, body: null });
    return `dispatch ${args[0]}: ${res.status}`;
  }
}
