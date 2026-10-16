// Minimal typings of typedi 0.10.
export declare class Token<T> {
  constructor(name?: string);
  private readonly __type?: T;
}
export declare function Service(): ClassDecorator;
export declare function Inject(token: Token<unknown>): ParameterDecorator;
export declare class Container {
  static get<T>(type: (abstract new (...args: never[]) => T) | Token<T>): T;
  static set<T>(token: Token<T>, value: T): void;
}
