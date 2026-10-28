import { CoinvaultClient } from 'coinvault-sdk';
import { CoinvaultDepositGateway } from './adapters/out/coinvault/coinvault-deposit.gateway';
import { InMemoryToolRepository } from './adapters/out/persistence/in-memory-tool.repository';
import { ToolController } from './adapters/in/http/tool.controller';
import { LendTool } from './application/lend-tool.use-case';

class Registry {
  private readonly entries = new Map<symbol, unknown>();
  register(token: symbol, value: unknown): void { this.entries.set(token, value); }
  get<T>(token: symbol): T { return this.entries.get(token) as T; }
}
const registry = new Registry();
const TOOLS = Symbol('tools');
function resolve<T>(token: symbol): T { return registry.get<T>(TOOLS) ?? registry.get<T>(token); }

export function createApp(apiKey: string): ToolController {
  registry.register(TOOLS, new InMemoryToolRepository());
  const deposits = new CoinvaultDepositGateway(new CoinvaultClient({ apiKey }));
  return new ToolController(new LendTool(resolve<InMemoryToolRepository>(TOOLS), deposits));
}
