// Minimal typings of @nestjs/typeorm.
export declare function InjectRepository(entity: abstract new (...args: never[]) => unknown): ParameterDecorator;
export interface TypeOrmModuleOptions {
  type: 'postgres';
  url?: string;
  entities?: unknown[];
  synchronize?: boolean;
}
export declare class TypeOrmModule {
  static forRoot(options: TypeOrmModuleOptions): unknown;
  static forFeature(entities: unknown[]): unknown;
}
