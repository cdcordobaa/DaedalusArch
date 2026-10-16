export interface MailProvider { send(message: { to: string; subject: string; body: string }): void }
export interface Clock { now(): string }
export interface Ids { next(): string }
