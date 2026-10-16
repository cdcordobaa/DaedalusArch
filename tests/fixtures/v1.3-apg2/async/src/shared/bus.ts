import { EventEmitter } from 'events';
// One process-wide bus. Publishers and subscribers both import this file, never each other.
export const bus = new EventEmitter();
