// Ambient typings for '@nestjs/common' (bare specifier, no install).
declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator;
  export function Controller(prefix?: string): ClassDecorator;
  export function Module(metadata: { imports?: unknown[]; controllers?: unknown[]; providers?: unknown[]; exports?: unknown[] }): ClassDecorator;
  export function Global(): ClassDecorator;
}
