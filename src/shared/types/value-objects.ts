declare const _brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [_brand]: B };

export type AVRScore = Brand<number, 'AVRScore'>;
export type AHSScore = Brand<number, 'AHSScore'>;
export type Confidence = Brand<number, 'Confidence'>;
export type CommitSha = Brand<string, 'CommitSha'>;
export type FunctionId = Brand<string, 'FunctionId'>;
export type RunId = Brand<string, 'RunId'>;

export function avrScore(n: number): AVRScore {
  if (n < 0 || n > 1) throw new RangeError(`AVRScore must be in [0,1], got ${n}`);
  return n as AVRScore;
}

export function ahsScore(n: number): AHSScore {
  if (n < 0 || n > 1) throw new RangeError(`AHSScore must be in [0,1], got ${n}`);
  return n as AHSScore;
}

export function confidence(n: number): Confidence {
  if (n < 0 || n > 1) throw new RangeError(`Confidence must be in [0,1], got ${n}`);
  return n as Confidence;
}

export function commitSha(s: string): CommitSha {
  if (!/^[0-9a-f]{40}$/i.test(s)) throw new TypeError(`Invalid commit SHA (must be 40-char hex): "${s}"`);
  return s as CommitSha;
}

export function functionId(s: string): FunctionId {
  return s as FunctionId;
}

export function runId(s: string): RunId {
  return s as RunId;
}
