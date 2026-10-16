export interface IdGenerator { next(prefix: string): string }
export interface Clock { now(): Date }
