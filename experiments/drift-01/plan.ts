/**
 * DRIFT-01 run plan (pure; design note §4). Per task and replicate: one shared session runs step 1 with arm `none`
 * from the seed; then one session per arm runs steps 2–5 from that step-1 snapshot. Order: replicate by replicate
 * (so a container loss costs at most the replicate in flight); within a replicate the tasks are shuffled, and after a
 * task's shared session its three arm sessions follow in a shuffled order. mulberry32, the harness's generator.
 */
export type Arm = 'none' | 'pull' | 'gate';
export interface PlanInput { readonly tasks: readonly { readonly id: string; readonly steps: number }[]; readonly replicates: number; readonly arms: readonly Arm[]; readonly orderSeed: number }
export interface PlannedSession {
  /** Neutral id (`c01`, …), in run order. */
  readonly id: string;
  readonly kind: 'shared' | 'arm';
  readonly taskId: string;
  readonly rep: number;
  readonly arm: Arm;
  /** 1-based step numbers this session runs. */
  readonly steps: readonly number[];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rnd: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function buildPlan(input: PlanInput): PlannedSession[] {
  const rnd = mulberry32(input.orderSeed);
  const out: Omit<PlannedSession, 'id'>[] = [];
  for (let rep = 0; rep < input.replicates; rep++) {
    for (const t of shuffle(input.tasks, rnd)) {
      const later = Array.from({ length: t.steps - 1 }, (_, i) => i + 2);
      out.push({ kind: 'shared', taskId: t.id, rep, arm: 'none', steps: [1] });
      for (const arm of shuffle(input.arms, rnd)) out.push({ kind: 'arm', taskId: t.id, rep, arm, steps: later });
    }
  }
  return out.map((s, i) => ({ id: `c${String(i + 1).padStart(2, '0')}`, ...s }));
}
