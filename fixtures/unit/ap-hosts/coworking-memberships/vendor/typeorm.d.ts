// Minimal typings of the typeorm surface this project and the anti-pattern operators use.
export declare function Entity(name?: string): ClassDecorator;
export declare function Column(options?: Record<string, unknown>): PropertyDecorator;
export declare function PrimaryGeneratedColumn(strategy?: string): PropertyDecorator;
export declare function CreateDateColumn(options?: Record<string, unknown>): PropertyDecorator;
export type FindOptionsWhere<T> = { [P in keyof T]?: T[P] };
export interface FindManyOptions<T> {
  where?: FindOptionsWhere<T>;
  order?: { [P in keyof T]?: 'ASC' | 'DESC' };
}
export declare class Repository<T> {
  create(entity: Partial<T>): T;
  save(entity: T): Promise<T>;
  findOne(options: FindManyOptions<T>): Promise<T | null>;
  find(options?: FindManyOptions<T>): Promise<T[]>;
  count(options?: FindManyOptions<T>): Promise<number>;
}
export type EntityTarget<T> = abstract new (...args: never[]) => T;
export declare function getRepository<T>(target: EntityTarget<T>): Repository<T>;
export interface DataSourceOptions {
  type: 'postgres';
  url?: string;
  entities: unknown[];
  synchronize?: boolean;
}
export declare class DataSource {
  constructor(options: DataSourceOptions);
  initialize(): Promise<DataSource>;
  getRepository<T>(target: EntityTarget<T>): Repository<T>;
}
