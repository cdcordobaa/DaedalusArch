import YAML from 'yaml';
import type { ADRRule, SemanticCriteria } from '../shared/types/spec.js';
import type { ADRFormat } from '../shared/types/enums.js';
import type { ADRParserStrategy } from './types.js';
import { DomainResult } from '../shared/errors/domain-result.js';

// ── Semantic Criterion Generation ─────────────────────────────────────────────

export function generateSemanticCriterion(
  decision: string,
  title: string,
): SemanticCriteria {
  const rule = decision.length > 500 ? decision.slice(0, 500) + '...' : decision;
  return {
    rule,
    rubric: {
      pass: `Code adheres to: ${title}`,
      fail: `Code violates: ${title}`,
      evidenceRequired: 'Cite specific code that confirms or violates the decision',
    },
  };
}

// ── MADR Parser ───────────────────────────────────────────────────────────────

export class MADRParser implements ADRParserStrategy {
  readonly format: ADRFormat = 'MADR';

  canParse(content: string): boolean {
    return content.includes('## Decision Drivers') || content.includes('## Considered Options');
  }

  parse(content: string, filePath: string): DomainResult<ADRRule> {
    try {
      const title = extractH1(content) ?? extractFilenameTitle(filePath);
      const decision = extractSection(content, 'Decision Outcome') ??
        extractSection(content, 'Decision') ?? '';

      return DomainResult.ok<ADRRule>({
        id: filePathToId(filePath),
        title,
        format: 'MADR',
        semanticCriterion: generateSemanticCriterion(decision, title),
        rawContent: content,
      });
    } catch (e) {
      return DomainResult.fromError<ADRRule>(e);
    }
  }
}

// ── Nygard Parser ─────────────────────────────────────────────────────────────

export class NygardParser implements ADRParserStrategy {
  readonly format: ADRFormat = 'Nygard';

  canParse(content: string): boolean {
    return content.includes('## Status') &&
      content.includes('## Context') &&
      content.includes('## Decision');
  }

  parse(content: string, filePath: string): DomainResult<ADRRule> {
    try {
      const title = extractH1(content) ?? extractFilenameTitle(filePath);
      const decision = extractSection(content, 'Decision') ?? '';

      return DomainResult.ok<ADRRule>({
        id: filePathToId(filePath),
        title,
        format: 'Nygard',
        semanticCriterion: generateSemanticCriterion(decision, title),
        rawContent: content,
      });
    } catch (e) {
      return DomainResult.fromError<ADRRule>(e);
    }
  }
}

// ── Y-Statement Parser ────────────────────────────────────────────────────────

export class YStatementParser implements ADRParserStrategy {
  readonly format: ADRFormat = 'Y-Statement';

  canParse(content: string): boolean {
    return content.includes('In the context of') &&
      content.includes('we decided') &&
      content.includes('to achieve');
  }

  parse(content: string, filePath: string): DomainResult<ADRRule> {
    try {
      const title = extractH1(content) ?? extractFilenameTitle(filePath);
      // Extract the full Y-statement as the decision
      const match = content.match(/In the context of[\s\S]*?(?:to achieve[\s\S]*?(?:\.|$))/);
      const decision = match?.[0]?.trim() ?? content.slice(0, 500);

      return DomainResult.ok<ADRRule>({
        id: filePathToId(filePath),
        title,
        format: 'Y-Statement',
        semanticCriterion: generateSemanticCriterion(decision, title),
        rawContent: content,
      });
    } catch (e) {
      return DomainResult.fromError<ADRRule>(e);
    }
  }
}

// ── Custom YAML ADR Parser ────────────────────────────────────────────────────

export class CustomYamlADRParser implements ADRParserStrategy {
  readonly format: ADRFormat = 'custom-yaml';

  canParse(_content: string, filePath: string): boolean {
    return filePath.endsWith('.yaml') || filePath.endsWith('.yml');
  }

  parse(content: string, filePath: string): DomainResult<ADRRule> {
    try {
      const parsed = YAML.parse(content) as Record<string, unknown>;
      const adr = (parsed['adr'] ?? parsed) as Record<string, unknown>;

      const title = (adr['title'] as string) ?? extractFilenameTitle(filePath);
      const decision = (adr['decision'] as string) ?? '';

      // Optional handcrafted Cypher rule (v1)
      const cypherBlock = adr['cypher_rule'] as Record<string, unknown> | undefined;
      const symbolicRule = cypherBlock
        ? {
          query: cypherBlock['query'] as string,
          params: (cypherBlock['params'] as Record<string, unknown>) ?? {},
          description: (cypherBlock['description'] as string) ?? '',
        }
        : undefined;

      const rule: ADRRule = {
        id: filePathToId(filePath),
        title,
        format: 'custom-yaml',
        ...(symbolicRule ? { symbolicRule } : {}),
        semanticCriterion: generateSemanticCriterion(decision, title),
        rawContent: content,
      };
      return DomainResult.ok(rule);
    } catch (e) {
      return DomainResult.fromError<ADRRule>(e);
    }
  }
}

// ── Parser Registry & Dispatcher ──────────────────────────────────────────────

export const ADR_PARSERS: readonly ADRParserStrategy[] = [
  new MADRParser(),
  new NygardParser(),
  new YStatementParser(),
  new CustomYamlADRParser(),
];

export function detectAndParseADR(
  content: string,
  filePath: string,
): DomainResult<ADRRule> | undefined {
  for (const parser of ADR_PARSERS) {
    if (parser.canParse(content, filePath)) {
      return parser.parse(content, filePath);
    }
  }
  return undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractH1(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function extractSection(content: string, heading: string): string | undefined {
  const regex = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|$)`, 'm');
  const match = content.match(regex);
  return match?.[1]?.trim() || undefined;
}

function extractFilenameTitle(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  return basename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
}

function filePathToId(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  return basename.replace(/\.[^.]+$/, '').toLowerCase().replace(/\s+/g, '-');
}
