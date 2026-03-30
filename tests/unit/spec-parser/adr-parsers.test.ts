import { MADRParser, NygardParser, YStatementParser, CustomYamlADRParser, detectAndParseADR, generateSemanticCriterion } from '../../../src/spec-parser/adr-parsers.js';

describe('adr-parsers', () => {
  describe('format detection', () => {
    const madrContent = `# Use PostgreSQL for persistence\n\n## Status\nAccepted\n\n## Decision Drivers\n- Need ACID\n\n## Considered Options\n- PostgreSQL\n- MongoDB\n\n## Decision Outcome\nChose PostgreSQL for ACID compliance.`;
    const nygardContent = `# Use Event Sourcing\n\n## Status\nAccepted\n\n## Context\nWe need audit trail.\n\n## Decision\nUse event sourcing for the order service.`;
    const yStatementContent = `# Architecture Decision\n\nIn the context of choosing a database, facing the need for ACID compliance, we decided to use PostgreSQL to achieve data integrity, accepting higher operational cost.`;

    it('MADRParser detects MADR format', () => {
      const parser = new MADRParser();
      expect(parser.canParse(madrContent, 'adr-001.md')).toBe(true);
      expect(parser.canParse(nygardContent, 'adr-002.md')).toBe(false);
    });

    it('NygardParser detects Nygard format', () => {
      const parser = new NygardParser();
      expect(parser.canParse(nygardContent, 'adr-002.md')).toBe(true);
      expect(parser.canParse(yStatementContent, 'adr-003.md')).toBe(false);
    });

    it('YStatementParser detects Y-Statement format', () => {
      const parser = new YStatementParser();
      expect(parser.canParse(yStatementContent, 'adr-003.md')).toBe(true);
      expect(parser.canParse(madrContent, 'adr-001.md')).toBe(false);
    });

    it('CustomYamlADRParser detects YAML files', () => {
      const parser = new CustomYamlADRParser();
      expect(parser.canParse('anything', 'adr.yaml')).toBe(true);
      expect(parser.canParse('anything', 'adr.yml')).toBe(true);
      expect(parser.canParse('anything', 'adr.md')).toBe(false);
    });
  });

  describe('MADR parsing', () => {
    it('extracts title and decision from MADR', () => {
      const content = `# Use PostgreSQL\n\n## Decision Drivers\n- Need ACID\n\n## Decision Outcome\nChose PostgreSQL for ACID compliance.`;
      const parser = new MADRParser();
      const result = parser.parse(content, 'adr-001.md');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Use PostgreSQL');
        expect(result.data.format).toBe('MADR');
        expect(result.data.semanticCriterion).toBeDefined();
      }
    });
  });

  describe('Nygard parsing', () => {
    it('extracts decision from Nygard ADR', () => {
      const content = `# Use Event Sourcing\n\n## Status\nAccepted\n\n## Context\nNeed audit trail.\n\n## Decision\nUse event sourcing for order service.`;
      const parser = new NygardParser();
      const result = parser.parse(content, 'adr-002.md');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Use Event Sourcing');
        expect(result.data.format).toBe('Nygard');
      }
    });
  });

  describe('Y-Statement parsing', () => {
    it('extracts Y-Statement content', () => {
      const content = `# DB Choice\n\nIn the context of data storage, we decided to use PostgreSQL to achieve ACID compliance.`;
      const parser = new YStatementParser();
      const result = parser.parse(content, 'adr-003.md');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('DB Choice');
        expect(result.data.format).toBe('Y-Statement');
      }
    });
  });

  describe('Custom YAML parsing', () => {
    it('parses YAML ADR with cypher_rule', () => {
      const content = `adr:\n  title: Use Repository Pattern\n  status: Accepted\n  context: Need abstraction\n  decision: Use repository interfaces in domain\n  cypher_rule:\n    query: "MATCH (c:Class) RETURN c"\n    params: {}\n    description: Check repos`;
      const parser = new CustomYamlADRParser();
      const result = parser.parse(content, 'adr.yaml');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Use Repository Pattern');
        expect(result.data.format).toBe('custom-yaml');
        expect(result.data.symbolicRule).toBeDefined();
        expect(result.data.symbolicRule!.query).toBe('MATCH (c:Class) RETURN c');
      }
    });

    it('parses YAML ADR without cypher_rule', () => {
      const content = `adr:\n  title: Use DDD\n  status: Accepted\n  context: Complex domain\n  decision: Apply DDD patterns`;
      const parser = new CustomYamlADRParser();
      const result = parser.parse(content, 'adr.yaml');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbolicRule).toBeUndefined();
        expect(result.data.semanticCriterion).toBeDefined();
      }
    });
  });

  describe('detectAndParseADR', () => {
    it('dispatches to correct parser', () => {
      const madr = `# Test\n\n## Considered Options\n- A\n- B\n\n## Decision Outcome\nPick A.`;
      const result = detectAndParseADR(madr, 'test.md');
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      if (result!.success) {
        expect(result!.data.format).toBe('MADR');
      }
    });

    it('returns undefined for unrecognized format', () => {
      const result = detectAndParseADR('Just some random text', 'random.md');
      expect(result).toBeUndefined();
    });
  });

  describe('generateSemanticCriterion', () => {
    it('generates criterion from decision text', () => {
      const criterion = generateSemanticCriterion('Use PostgreSQL for persistence', 'DB Choice');
      expect(criterion.rule).toBe('Use PostgreSQL for persistence');
      expect(criterion.rubric.pass).toContain('DB Choice');
      expect(criterion.rubric.fail).toContain('DB Choice');
    });

    it('truncates long decision text to 500 chars', () => {
      const longText = 'x'.repeat(600);
      const criterion = generateSemanticCriterion(longText, 'Test');
      expect(criterion.rule.length).toBeLessThanOrEqual(503); // 500 + '...'
    });
  });
});
