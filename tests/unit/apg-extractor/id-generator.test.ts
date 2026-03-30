import { generateNodeId, generateEdgeId, normalizeFilePath } from '../../../src/apg-extractor/id-generator.js';

describe('generateNodeId', () => {
  it('returns a 16-char lowercase hex string', () => {
    const id = generateNodeId('Class', 'src/foo.ts', 'Foo');
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic — same inputs produce same ID', () => {
    const a = generateNodeId('Class', 'src/services/user.service.ts', 'UserService');
    const b = generateNodeId('Class', 'src/services/user.service.ts', 'UserService');
    expect(a).toBe(b);
  });

  it('is case-insensitive — lowercase and uppercase inputs produce same ID', () => {
    const lower = generateNodeId('Class', 'src/user.ts', 'userservice');
    const upper = generateNodeId('Class', 'src/user.ts', 'UserService');
    // Both lowercased before hashing
    expect(lower).toBe(upper);
  });

  it('different types produce different IDs for same path+name', () => {
    const classId = generateNodeId('Class', 'src/foo.ts', 'Foo');
    const ifaceId = generateNodeId('Interface', 'src/foo.ts', 'Foo');
    expect(classId).not.toBe(ifaceId);
  });

  it('different file paths produce different IDs for same type+name', () => {
    const a = generateNodeId('Class', 'src/a/foo.ts', 'Foo');
    const b = generateNodeId('Class', 'src/b/foo.ts', 'Foo');
    expect(a).not.toBe(b);
  });
});

describe('generateEdgeId', () => {
  it('returns a 16-char lowercase hex string', () => {
    const id = generateEdgeId('IMPORTS', 'abc1234567890123', 'def1234567890123');
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic', () => {
    const a = generateEdgeId('IMPLEMENTS', 'aaa', 'bbb');
    const b = generateEdgeId('IMPLEMENTS', 'aaa', 'bbb');
    expect(a).toBe(b);
  });

  it('different edge types produce different IDs for same source+target', () => {
    const imports = generateEdgeId('IMPORTS', 'aaa', 'bbb');
    const implements_ = generateEdgeId('IMPLEMENTS', 'aaa', 'bbb');
    expect(imports).not.toBe(implements_);
  });

  it('is not symmetric — (A→B) !== (B→A)', () => {
    const forward = generateEdgeId('IMPORTS', 'aaa', 'bbb');
    const reverse = generateEdgeId('IMPORTS', 'bbb', 'aaa');
    expect(forward).not.toBe(reverse);
  });
});

describe('normalizeFilePath', () => {
  it('strips project root prefix', () => {
    const result = normalizeFilePath('/proj/src/foo.ts', '/proj');
    expect(result).toBe('src/foo.ts');
  });

  it('handles trailing slash on project root', () => {
    const result = normalizeFilePath('/proj/src/foo.ts', '/proj/');
    expect(result).toBe('src/foo.ts');
  });

  it('returns path unchanged if it does not start with project root', () => {
    const result = normalizeFilePath('/other/src/foo.ts', '/proj');
    expect(result).toBe('/other/src/foo.ts');
  });
});
