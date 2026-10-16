import { runOn } from './helpers.js';

describe('framework-in-core proxy', () => {
  it('flags express types in application and domain signatures, type-only and nested, not in infrastructure', async () => {
    const fx = await runOn({
      'src/o/application/o.service.ts': `import type { Request, Response } from 'express';
export class OService {
  constructor(private readonly r?: Request) {}
  handle(input: string, request?: Request): string { return input; }
  respond(): Promise<Response[]> { return Promise.resolve([]); }
  plain(id: string): string { return id; }
}
export const helper = (req: import('express').Request): unknown => req.body;
`,
      'src/o/domain/o.ts': `import { Repository } from 'typeorm';
export class O {
  static load(repo: Repository<O>): O { void repo; return new O(); }
}
`,
      'src/o/infrastructure/http.ts': `import type { Request } from 'express';
export class Http { handle(req: Request): unknown { return req.body; } }
`,
    }, ['framework-in-core']);
    try {
      expect(fx.flags('framework-in-core').map((f) => `${f.kind}:${f.className ?? ''}.${f.methodName ?? ''}`).sort()).toEqual([
        'framework-type-parameter:.helper',
        'framework-type-parameter:O.load',
        'framework-type-parameter:OService.handle',
        'framework-type-return:OService.respond',
      ]);
    } finally {
      fx.cleanup();
    }
  });
});
