import type { PipelineCommand } from '../../shared/interfaces/pipeline-stage.js';
import type { FirewallContext } from '../../shared/context/firewall-context.js';
import type { DomainResult as DomainResultType } from '../../shared/errors/domain-result.js';
import { DomainResult } from '../../shared/errors/domain-result.js';
import { extractAPG } from '../../apg-extractor/index.js';
import type { GraphMode } from '../../apg-extractor/types.js';
import { toPipelineError, toPipelineWarning } from './map-helpers.js';

export class ExtractCommand implements PipelineCommand {
  readonly name = 'extract-apg';

  constructor(
    private readonly projectPath: string,
    private readonly excludePatterns: string[] = [],
    /** `ast-only` is the APG ablation arm (ADR-021 SO2); absent = `full`. */
    private readonly graphMode?: GraphMode,
    /** ADR-032: explicit tsconfig (the project's own `tsconfig.json` is then ignored); absent = `<project>/tsconfig.json`. */
    private readonly tsconfigPath?: string,
    /** In-memory file contents (absolute path; `null` = removed); absent = the files on disk. */
    private readonly sourceOverrides?: ReadonlyMap<string, string | null>,
  ) {}

  async execute(context: FirewallContext): Promise<DomainResultType<void>> {
    const options = {
      excludePatterns: this.excludePatterns,
      ...(this.graphMode !== undefined && { graphMode: this.graphMode }),
    };
    // The overrides argument is passed only when present (MCP template checks): every other caller is unchanged.
    const result = this.sourceOverrides === undefined
      ? await extractAPG(this.projectPath, options, this.tsconfigPath)
      : await extractAPG(this.projectPath, options, this.tsconfigPath, this.sourceOverrides);

    if (!result.success) {
      return DomainResult.fail<void>(
        result.errors.map((e) => toPipelineError(e, this.name, true)),
      );
    }

    context.setApgResult(result.data);

    // Extractor warnings travel in APGResult.warnings (BR-U2-26); route them to the context (BR-U3-56).
    for (const w of result.data.warnings) {
      context.addWarning(toPipelineWarning({
        code: w.code, message: w.message,
        context: { filePath: w.filePath, ...(w.severity !== undefined ? { severity: w.severity } : {}) },
      }, this.name));
    }

    if (result.warnings) {
      for (const w of result.warnings) {
        context.addWarning(toPipelineWarning(w, this.name));
      }
    }

    context.addAuditEntry({
      timestamp: new Date().toISOString(),
      stage: this.name,
      event: `Extracted APG: ${result.data.nodes.length} nodes, ${result.data.edges.length} edges (${result.data.parseCoverage.percentage}% coverage)`,
    });

    return DomainResult.ok(undefined);
  }
}
