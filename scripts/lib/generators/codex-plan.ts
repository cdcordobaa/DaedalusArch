/**
 * The Codex configuration of a plan file (ADR-029): the plan's `codex` block (pins) plus the machine-local homes.
 *
 * `codexConfigFromPlan(plan, modelId, repoRoot, homes)` checks the pinned catalog file against
 * `codex.modelCatalogSha256` (`GEN_CODEX_CATALOG_CHANGED`) and builds a `CodexCliConfig`. The homes default to
 * `~/.firewall/generator-codex-home` (`CODEX_HOME`, logged in with the author's ChatGPT plan) and
 * `~/.firewall/generator-codex-userhome` (the child's empty `HOME`); `--codex-home` / `--codex-user-home` override.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { createCodexCliConfig } from './codex-cli.js';
import type { CodexCliConfig } from './codex-cli.js';
import { createGeneratorCliConfig } from './config.js';
import type { GeneratorPlanFile } from './schedule.js';

export interface CodexHomes {
  readonly codexHome?: string;
  readonly userHome?: string;
  readonly realHome?: string;
}

export function defaultCodexHome(realHome: string = os.homedir()): string {
  return path.join(realHome, '.firewall', 'generator-codex-home');
}

export function defaultCodexUserHome(realHome: string = os.homedir()): string {
  return path.join(realHome, '.firewall', 'generator-codex-userhome');
}

export function codexConfigFromPlan(
  plan: Pick<GeneratorPlanFile, 'binary' | 'outRoot' | 'harnessRoot' | 'allowBash' | 'timeoutMs' | 'codex'>,
  modelId: string,
  repoRoot: string,
  homes: CodexHomes = {},
  outputRoot: string = plan.outRoot,
): DomainResult<CodexCliConfig> {
  const block = plan.codex;
  if (block === undefined) return DomainResult.fail([{ code: 'GEN_PLAN_INVALID', message: 'a codex-cli adapter needs a codex block' }]);
  const catalog = path.resolve(repoRoot, block.modelCatalog);
  let sha: string;
  try {
    sha = crypto.createHash('sha256').update(fs.readFileSync(catalog)).digest('hex');
  } catch {
    return DomainResult.fail([{ code: 'GEN_CODEX_CATALOG_CHANGED', message: `pinned model catalog ${block.modelCatalog} is not readable` }]);
  }
  if (sha !== block.modelCatalogSha256) {
    return DomainResult.fail([{ code: 'GEN_CODEX_CATALOG_CHANGED', message: `pinned model catalog ${block.modelCatalog} changed (sha256 ${sha})` }]);
  }
  const base = createGeneratorCliConfig(
    {
      binary: plan.binary,
      modelId,
      outputRoot,
      harnessRoot: plan.harnessRoot,
      allowBash: plan.allowBash,
      ...(plan.timeoutMs !== undefined ? { timeoutMs: plan.timeoutMs } : {}),
    },
    repoRoot,
  );
  if (!base.success) return DomainResult.fail(base.errors);
  const realHome = homes.realHome ?? os.homedir();
  return createCodexCliConfig(
    {
      base: base.data,
      codexHome: homes.codexHome ?? defaultCodexHome(realHome),
      userHome: homes.userHome ?? defaultCodexUserHome(realHome),
      realHome,
      reasoningEffort: block.reasoningEffort,
      cliVersion: block.cliVersion,
      modelCatalog: catalog,
    },
    repoRoot,
  );
}
