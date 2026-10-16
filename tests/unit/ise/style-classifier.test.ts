import { boundedContexts, classifyStyle, scoreStyles, styleFeatures } from '../../../src/ise/style-classifier.js';
import { cleanShaped, dddShaped, graph, hexShaped, layeredShaped } from './helpers.js';

describe('ISE style classifier', () => {
  it('classifies a clean-architecture-shaped project from its directory tokens and dependency inversion', () => {
    const c = classifyStyle(cleanShaped());
    expect(c.best).toBe('clean-architecture');
    expect(c.ranked[0]?.evidence.join(' ')).toMatch(/domain \+ application \+ infrastructure/);
    expect(c.features.inwardImplements).toBe(2);
  });

  it('still classifies it from edge structure alone when the directories carry no known token', () => {
    const c = classifyStyle(cleanShaped('kernel', 'orchestration', 'platform'));
    expect(c.best).toBe('clean-architecture');
    expect(c.ranked[0]?.evidence.join(' ')).toMatch(/dependency inversion/);
  });

  it('classifies a layered chain without inversion as layered, with or without layer names', () => {
    expect(classifyStyle(layeredShaped()).best).toBe('layered');
    expect(classifyStyle(layeredShaped('frontend', 'kernel', 'platform')).best).toBe('layered');
  });

  it('classifies NestJS from @Module classes and dot-suffix files', () => {
    const g = graph({
      files: ['src/app.module.ts', 'src/users/users.module.ts', 'src/users/users.controller.ts', 'src/users/users.service.ts'],
      edges: ['src/app.module.ts>src/users/users.module.ts', 'src/users/users.module.ts>src/users/users.controller.ts', 'src/users/users.controller.ts>src/users/users.service.ts'],
      classes: [['src/app.module.ts', 'AppModule', ['Module']], ['src/users/users.module.ts', 'UsersModule', ['Module']], ['src/users/users.controller.ts', 'UsersController', ['Controller']], ['src/users/users.service.ts', 'UsersService', ['Injectable']]],
    });
    const c = classifyStyle(g);
    expect(c.best).toBe('nestjs');
    expect(c.features.nestModuleClasses).toBe(2);
  });

  it('classifies hexagonal from adapters with inbound/outbound directories', () => {
    const g = graph({
      files: ['src/domain/Room.ts', 'src/application/ports/out/RoomRepository.ts', 'src/application/BookRoom.ts', 'src/adapters/inbound/http/RoomController.ts', 'src/adapters/outbound/db/SqlRoomRepository.ts', 'src/config/container.ts'],
      edges: [
        'src/application/BookRoom.ts>src/domain/Room.ts', 'src/application/BookRoom.ts>src/application/ports/out/RoomRepository.ts',
        'src/adapters/inbound/http/RoomController.ts>src/application/BookRoom.ts', 'src/adapters/outbound/db/SqlRoomRepository.ts>src/application/ports/out/RoomRepository.ts',
        'src/config/container.ts>src/adapters/inbound/http/RoomController.ts', 'src/config/container.ts>src/adapters/outbound/db/SqlRoomRepository.ts',
      ],
    });
    expect(classifyStyle(g).best).toBe('hexagonal');
  });

  it('detects bounded contexts and classifies DDD', () => {
    const files = ['src/ordering/domain/Order.ts', 'src/ordering/application/PlaceOrder.ts', 'src/billing/domain/Invoice.ts', 'src/billing/infrastructure/Repo.ts', 'src/shared-kernel/Money.ts', 'src/utils/x.ts', 'src/main.ts'];
    expect(boundedContexts(files, 'src/')).toEqual(['src/billing/', 'src/ordering/']);
    const g = graph({ files, edges: ['src/ordering/application/PlaceOrder.ts>src/ordering/domain/Order.ts', 'src/main.ts>src/ordering/application/PlaceOrder.ts'] });
    expect(classifyStyle(g).best).toBe('ddd');
  });

  it('gives every style the same confidence when there is no evidence at all', () => {
    const f = styleFeatures(graph({ files: ['src/a.ts'] }));
    const ranked = scoreStyles(f);
    expect(ranked.every((r) => r.points === 0 && r.confidence === 0.2)).toBe(true);
  });

  it('classifies hexagonal from structure alone: a structural container split into inbound and outbound adapters', () => {
    const c = classifyStyle(hexShaped('plugins', 'entry', 'exit'));
    expect(c.best).toBe('hexagonal');
    expect(c.features.inboundAdapters).toEqual(['src/plugins/entry/']);
    expect(c.features.outboundAdapters).toEqual(['src/plugins/exit/']);
    expect(c.features.drivingPorts).toBe(1);
    expect(c.ranked[0]?.evidence.join(' ')).toMatch(/separate inbound .* and outbound .* adapter units/);
  });

  it('keeps a clean-architecture project (one outer ring holding the entry file) out of hexagonal', () => {
    for (const g of [cleanShaped(), cleanShaped('kernel', 'orchestration', 'platform')]) {
      const c = classifyStyle(g);
      expect(c.best).toBe('clean-architecture');
      expect(c.features.inboundAdapters.length * c.features.outboundAdapters.length).toBe(0);
    }
  });

  it('classifies DDD from repeated internal layering when the layer folders are renamed', () => {
    const c = classifyStyle(dddShaped('kernel', 'orchestration', 'platform'));
    expect(c.best).toBe('ddd');
    expect(c.features.contexts).toEqual(['src/billing/', 'src/ordering/']);
  });
});
