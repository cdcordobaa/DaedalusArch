import { annotateNodes, buildLayerMappings } from '../../../src/neo4j-ingestion/layer-annotator.js';
import type { APGNode } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';

const LAYER_MODEL: LayerModel = {
  layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], decorators: [], role: 'entity, value-object' },
    { name: 'application', directories: ['src/application/**'], naming: [], decorators: [], role: 'use-case' },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], decorators: ['Controller'], role: 'controller' },
  ],
};

function makeNode(overrides: Partial<APGNode> & { id: string; name: string; filePath: string; type: APGNode['type'] }): APGNode {
  return {
    id: overrides.id,
    type: overrides.type,
    name: overrides.name,
    filePath: overrides.filePath,
    properties: overrides.properties ?? {},
  };
}

describe('layer-annotator', () => {
  describe('buildLayerMappings', () => {
    it('converts LayerModel to LayerMapping array', () => {
      const mappings = buildLayerMappings(LAYER_MODEL);
      expect(mappings).toHaveLength(3);
      expect(mappings[0].layerName).toBe('domain');
      expect(mappings[0].directories).toEqual(['src/domain/**']);
    });
  });

  describe('annotateNodes', () => {
    it('annotates file in domain layer via directory match', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f1', type: 'File', name: 'User.ts', filePath: 'src/domain/User.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      const ann = result.annotations.get('f1');
      expect(ann?.layer).toBe('domain');
      expect(ann?.matchMethod).toBe('directory');
      expect(result.summary.mapped).toBe(1);
      expect(result.summary.unmapped).toBe(0);
    });

    it('annotates file in infrastructure layer', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f2', type: 'File', name: 'UserController.ts', filePath: 'src/infrastructure/UserController.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      expect(result.annotations.get('f2')?.layer).toBe('infrastructure');
    });

    it('marks unmapped files as layer: null', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f3', type: 'File', name: 'helpers.ts', filePath: 'src/utils/helpers.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      const ann = result.annotations.get('f3');
      expect(ann?.layer).toBeNull();
      expect(ann?.matchMethod).toBeNull();
      expect(result.summary.unmapped).toBe(1);
      expect(result.summary.unmappedFiles).toContain('src/utils/helpers.ts');
    });

    it('propagates layer to Method nodes via file path', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f1', type: 'File', name: 'UserService.ts', filePath: 'src/application/UserService.ts' }),
        makeNode({ id: 'm1', type: 'Method', name: 'UserService.execute', filePath: 'src/application/UserService.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      expect(result.annotations.get('m1')?.layer).toBe('application');
    });

    it('handles nested directory matching', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f4', type: 'File', name: 'UserRepo.ts', filePath: 'src/domain/repositories/UserRepo.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      expect(result.annotations.get('f4')?.layer).toBe('domain');
    });

    it('handles empty node list', () => {
      const result = annotateNodes([], LAYER_MODEL);
      expect(result.annotations.size).toBe(0);
      expect(result.summary.mapped).toBe(0);
      expect(result.summary.unmapped).toBe(0);
    });

    it('computes correct summary counts', () => {
      const nodes: APGNode[] = [
        makeNode({ id: 'f1', type: 'File', name: 'User.ts', filePath: 'src/domain/User.ts' }),
        makeNode({ id: 'f2', type: 'File', name: 'Ctrl.ts', filePath: 'src/infrastructure/Ctrl.ts' }),
        makeNode({ id: 'f3', type: 'File', name: 'util.ts', filePath: 'src/utils/util.ts' }),
      ];
      const result = annotateNodes(nodes, LAYER_MODEL);
      expect(result.summary.mapped).toBe(2);
      expect(result.summary.unmapped).toBe(1);
    });
  });
});
