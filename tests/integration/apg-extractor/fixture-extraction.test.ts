/**
 * Integration test: runs extractAPG against the correct-reference fixture from U1.
 * Validates the full extraction pipeline against real TypeScript source files.
 */
import { resolve } from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';

const FIXTURE = resolve(__dirname, '../../../fixtures/correct-reference');

describe('Integration: correct-reference fixture extraction', () => {
  let result: Awaited<ReturnType<typeof extractAPG>>;

  beforeAll(async () => {
    result = await extractAPG(FIXTURE);
  }, 60_000);

  it('extraction succeeds (DomainResult.ok)', () => {
    expect(result.success).toBe(true);
  });

  it('produces File nodes for all .ts source files', () => {
    if (!result.success) return;
    const fileNodes = result.data.nodes.filter(n => n.type === 'File');
    // correct-reference has at least 10 .ts files
    expect(fileNodes.length).toBeGreaterThanOrEqual(10);
  });

  it('produces Class nodes for declared classes', () => {
    if (!result.success) return;
    const classNodes = result.data.nodes.filter(n => n.type === 'Class');
    expect(classNodes.length).toBeGreaterThan(0);
    // Known classes in correct-reference
    const classNames = classNodes.map(n => n.name);
    expect(classNames).toContain('TaskController');
    expect(classNames).toContain('CreateTaskUseCase');
  });

  it('produces Interface nodes for declared interfaces', () => {
    if (!result.success) return;
    const ifaceNodes = result.data.nodes.filter(n => n.type === 'Interface');
    expect(ifaceNodes.length).toBeGreaterThan(0);
    const ifaceNames = ifaceNodes.map(n => n.name);
    expect(ifaceNames).toContain('ITaskRepository');
  });

  it('produces CONSTRUCTOR_INJECTS edges (structural DI from fixture)', () => {
    if (!result.success) return;
    // TaskController injects ICreateTaskUseCase and ICompleteTaskUseCase
    // CreateTaskUseCase injects ITaskRepository
    const injectEdges = result.data.edges.filter(e => e.type === 'CONSTRUCTOR_INJECTS');
    expect(injectEdges.length).toBeGreaterThan(0);
  });

  it('produces IMPLEMENTS edges', () => {
    if (!result.success) return;
    // CreateTaskUseCase implements ICreateTaskUseCase
    const implEdges = result.data.edges.filter(e => e.type === 'IMPLEMENTS');
    expect(implEdges.length).toBeGreaterThan(0);
  });

  it('produces DECLARES edges (File → Class/Interface)', () => {
    if (!result.success) return;
    const declEdges = result.data.edges.filter(e => e.type === 'DECLARES');
    expect(declEdges.length).toBeGreaterThan(0);
  });

  it('produces CONTAINS edges (Class → Method)', () => {
    if (!result.success) return;
    const containsEdges = result.data.edges.filter(e => e.type === 'CONTAINS');
    expect(containsEdges.length).toBeGreaterThan(0);
  });

  it('parse coverage is 100% for the clean reference fixture (US-1.6)', () => {
    if (!result.success) return;
    expect(result.data.parseCoverage.percentage).toBe(100);
    expect(result.data.parseCoverage.skipped).toHaveLength(0);
  });

  it('all node IDs are 16-char hex strings (deterministic IDs)', () => {
    if (!result.success) return;
    for (const node of result.data.nodes) {
      expect(node.id).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('all node IDs are unique', () => {
    if (!result.success) return;
    const ids = result.data.nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all edge sourceId and targetId reference existing node IDs', () => {
    if (!result.success) return;
    const nodeIdSet = new Set(result.data.nodes.map(n => n.id));
    for (const edge of result.data.edges) {
      expect(nodeIdSet.has(edge.sourceId)).toBe(true);
      expect(nodeIdSet.has(edge.targetId)).toBe(true);
    }
  });

  it('no duplicate edges (same type+source+target)', () => {
    if (!result.success) return;
    const keys = result.data.edges.map(e => `${e.type}:${e.sourceId}:${e.targetId}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
