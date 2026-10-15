import { GetBalance } from '../application';
import { BalanceDto } from './balance.dto';
export class BalanceController {
  constructor(private readonly useCase: GetBalance) {}
  async get(id: string): Promise<BalanceDto> {
    return new BalanceDto(await this.useCase.run(id));
  }
}
