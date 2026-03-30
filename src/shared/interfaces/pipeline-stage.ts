import type { DomainResult } from '../errors/domain-result.js';
import type { FirewallContext } from '../context/firewall-context.js';

export interface PipelineStage<TInput, TOutput> {
  readonly name: string;
  execute(input: TInput, context: FirewallContext): Promise<DomainResult<TOutput>>;
}

export interface PipelineCommand {
  readonly name: string;
  execute(context: FirewallContext): Promise<DomainResult<void>>;
}
