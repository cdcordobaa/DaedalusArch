/**
 * U1 K3 (BR-U1-38, ADR-015 item 10, U1 Q21 B): FF-CV02 pattern `*Service|*UseCase` in the four shipped YAMLs.
 */
import * as path from 'node:path';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';

const ROOT = path.resolve(__dirname, '../../..');

describe('BR-U1-38: FF-CV02 covers UseCase', () => {
  it.each(['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'specs/clean-arch.yaml', 'specs/daedalus-arch.yaml'])(
    '%s: FF-CV02 pattern "*Service|*UseCase" compiled to ^(?:[^/]*Service|[^/]*UseCase)$',
    async (rel) => {
      const parsed = await parseSpec({ specFilePath: path.join(ROOT, rel) });
      if (!parsed.success) throw new Error(`${rel} did not parse`);
      expect(parsed.data.fitnessFunctions.find((f) => String(f.id) === 'FF-CV02')?.pattern).toBe('*Service|*UseCase');
      const compiled = compileFunctions(compilerInputFromSpec(parsed.data));
      if (!compiled.success) throw new Error(`${rel} did not compile`);
      const q = compiled.data.symbolicQueries.find((x) => String(x.functionId) === 'FF-CV02');
      expect(q?.params.pattern).toBe('^(?:[^/]*Service|[^/]*UseCase)$');
      expect(new RegExp(String(q?.params.pattern)).test('CreateTaskUseCase')).toBe(true);
    },
  );
});
