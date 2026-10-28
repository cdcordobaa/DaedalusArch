import { CoinvaultClient } from 'coinvault-sdk';
import { CoinvaultDepositGateway } from './adapters/out/coinvault/coinvault-deposit.gateway';
import { InMemoryToolRepository } from './adapters/out/persistence/in-memory-tool.repository';
import { ToolController } from './adapters/in/http/tool.controller';
import { LendTool } from './application/lend-tool.use-case';

export function createApp(apiKey: string): ToolController {
  const tools = new InMemoryToolRepository();
  const deposits = new CoinvaultDepositGateway(new CoinvaultClient({ apiKey }));
  return new ToolController(new LendTool(tools, deposits));
}
