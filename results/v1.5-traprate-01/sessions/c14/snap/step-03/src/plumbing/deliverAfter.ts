import type { MessageDispatcher } from './MessageDispatcher';

/** Wraps an entry point so that the events its command wrote are delivered before it returns to the caller. */
export function deliverAfter(dispatcher: MessageDispatcher) {
  return <A extends unknown[], R>(command: (...args: A) => R) =>
    (...args: A): R => {
      const result = command(...args);
      dispatcher.drain();
      return result;
    };
}
