/**
 * BR-U5b-73: every U5b CLI has `--self-test`, which runs a built-in known-bad input and exits 1.
 * In-process check of the four CLIs completed at Step 33 (rescore, select-corpus, fetch-corpus, prepare-bases);
 * the other seven CLIs carried it from their own steps and are run by the Step 33 exit check.
 */
import type { ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { main as fetchMain } from '../../../../scripts/fetch-corpus.js';
import { main as prepareMain } from '../../../../scripts/prepare-bases.js';
import { main as rescoreMain } from '../../../../scripts/rescore.js';
import { main as selectMain } from '../../../../scripts/select-corpus.js';
import { ROOT } from './score-fixture.js';

const repoRoot = ROOT;

function capture(): { out: (t: string) => void; err: (t: string) => void; text: () => string } {
  let s = '';
  return { out: (t) => { s += t; }, err: (t) => { s += t; }, text: () => s };
}

/** A runner that fails the test if a self-test reaches a subprocess. */
const noRunner: ProcessRunner = {
  run: () => {
    throw new Error('self-test started a subprocess');
  },
};

describe('U5b CLI --self-test (BR-U5b-73)', () => {
  it('rescore refuses a report without inputs (RESCORE_INPUT_MISSING) and exits 1', async () => {
    const io = capture();
    expect(await rescoreMain(['--self-test'], repoRoot, { ...io, writeFile: () => { throw new Error('write'); } })).toBe(1);
    expect(io.text()).toContain('self-test: RESCORE_INPUT_MISSING');
  });

  it('select-corpus refuses an empty candidate list (CORPUS_SHORTFALL) and exits 1', async () => {
    const io = capture();
    expect(await selectMain(['--self-test'], repoRoot, io)).toBe(1);
    expect(io.text()).toContain('self-test: CORPUS_SHORTFALL');
  });

  it('fetch-corpus refuses a wrong overlay hash before any clone (OVERLAY_SHA_MISMATCH) and exits 1', async () => {
    const io = capture();
    expect(await fetchMain(['--self-test'], repoRoot, io, noRunner)).toBe(1);
    expect(io.text()).toContain('self-test: OVERLAY_SHA_MISMATCH');
  });

  it('prepare-bases refuses an unmapped selection (PREP_SELECTION_UNMAPPED) and exits 1', async () => {
    const io = capture();
    expect(await prepareMain(['--self-test'], repoRoot, io, noRunner)).toBe(1);
    expect(io.text()).toContain('self-test: PREP_SELECTION_UNMAPPED');
  });
});
