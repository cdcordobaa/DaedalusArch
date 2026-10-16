declare module 'mongoose' {
  export interface ClientSession {
    readonly id: unknown;
    endSession(): Promise<void>;
  }
}
