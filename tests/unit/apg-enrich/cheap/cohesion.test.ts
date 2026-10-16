import { runOn } from './helpers.js';

const SPLIT = `export class Split {
  private a = 0;
  private b = 0;
  private c = 0;
  incA(): void { this.a++; }
  readA(): number { return this.a + this.helper(); }
  helper(): number { return 1; }
  incB(): void { this.b++; }
  incC(): void { this.c++; }
}
`;

describe('cohesion proxy (LCOM4)', () => {
  it('counts connected method groups through shared fields and calls', async () => {
    const fx = await runOn({ 'src/x/domain/split.ts': SPLIT }, ['cohesion'], { lcom4Threshold: 3 });
    try {
      const lcom = fx.enrichment.nodeFacts.find((n) => n.key === 'lcom4');
      // {incA, readA, helper} {incB} {incC}
      expect(lcom?.value).toBe(3);
      expect(fx.flags('cohesion').map((f) => f.kind)).toEqual(['low-cohesion']);
      expect(fx.enrichment.summaries.cohesion?.fieldsFromMemberFacts).toBe(1);
    } finally {
      fx.cleanup();
    }
  });

  it('reports responsibility breadth from I/O categories and other components', async () => {
    const fx = await runOn({
      'src/a/application/a.service.ts': `import axios from 'axios';
import { getRepository } from 'typeorm';
import { B } from '../../b/domain/b';
import { C } from '../../c/domain/c';
export class AService {
  run(): unknown { void getRepository(B); return [axios.get('u'), new C()]; }
}
`,
      'src/b/domain/b.ts': 'export class B { x = 1; }\n',
      'src/c/domain/c.ts': 'export class C { y = 1; }\n',
    }, ['cohesion'], { breadthThreshold: 4 });
    try {
      const breadth = fx.enrichment.nodeFacts.find((n) => n.key === 'responsibilityBreadth' && (n.value as { breadth: number }).breadth > 0);
      expect(breadth?.value).toEqual({ breadth: 4, ioCategories: ['db', 'http-client'], componentDependencies: ['b', 'c'] });
      expect(fx.flags('cohesion').map((f) => `${f.kind}:${f.className ?? ''}`)).toEqual(['broad-responsibility:AService']);
    } finally {
      fx.cleanup();
    }
  });
});
