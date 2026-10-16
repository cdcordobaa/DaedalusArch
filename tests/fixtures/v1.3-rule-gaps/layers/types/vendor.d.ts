// Ambient typings for the packages the fixtures import (bare specifiers become Package nodes, no install needed).
declare module 'typeorm' {
  export class Repository<T> {
    save(entity: T): Promise<T>;
  }
}
declare module 'express' {
  export interface Request { body: Record<string, unknown> }
}
declare module '@nestjsx/crud' {
  export function Crud(): ClassDecorator;
}
