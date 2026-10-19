/**
 * MEAN-01 meaning analysis: assemble one `MeaningAnalysis` from the loaded inputs (design §5 flow, BR-06, BR-08,
 * BR-43, BR-52). Pure: the CLI loads the files, hashes the scripts and resolves the display paths.
 */
import { agreement } from './agreement.js';
import { crossTab, reasonCounts } from './crosstab.js';
import { MeaningInputError, checkDistinct } from './load.js';
import { precision } from './precision.js';
import type { AnalysisConfig, FileHash, MeaningAnalysis, RunMode, Sample, Sheet } from './types.js';
import { PROTOCOL, otherField } from './types.js';

export interface AnalyseInput {
  readonly sample: Sample;
  /** Display path of the sample. */
  readonly samplePath: string;
  readonly rater: Sheet | null;
  readonly author: Sheet | null;
  readonly config: AnalysisConfig;
  readonly scriptHashes: readonly FileHash[];
}

/** BR-43: the codebook's registered bootstrap settings. */
export const isProtocol = (config: AnalysisConfig): boolean => config.seed === PROTOCOL.seed && config.resamples === PROTOCOL.resamples;

export function analyse(input: AnalyseInput): MeaningAnalysis {
  const { sample, rater, author, config } = input;
  if (rater === null && author === null) throw new MeaningInputError(['at least one of --rater and --author is needed']);
  if (rater !== null && author !== null) checkDistinct(rater, author);
  const secondary = otherField(config.primary);
  const mode: RunMode = rater !== null && author !== null ? 'two-rater' : rater === null ? 'single-rater-author' : 'single-rater-rater';
  const sheets = [rater, author].filter((s): s is Sheet => s !== null);
  const agreementBlock = rater !== null && author !== null
    ? { primary: agreement(sample, rater, author, config.primary, config), secondary: agreement(sample, rater, author, secondary, config) }
    : null;
  const reference = rater ?? author;
  if (reference === null) throw new MeaningInputError(['no answer sheet']);
  const notes = (s: Sheet | null): number => (s === null ? 0 : [...s.rows.values()].filter((r) => r.note.trim() !== '').length);
  return {
    synthetic: sheets.some((s) => s.simulated),
    protocol: isProtocol(config),
    mode,
    status: agreementBlock === null ? 'single-rater' : agreementBlock.primary.result,
    config: { ...config, secondary },
    inputs: {
      sample: { path: input.samplePath, sha256: sample.sha256, items: sample.items.length, strata: sample.strata.length, frameN: sample.frameN },
      rater: rater === null ? null : { path: rater.path, sha256: rater.sha256 },
      author: author === null ? null : { path: author.path, sha256: author.sha256 },
    },
    scriptHashes: input.scriptHashes,
    agreement: agreementBlock,
    precision: {
      primary: precision(sample, { rater, author }, config.primary, config),
      secondary: precision(sample, { rater, author }, secondary, config),
    },
    crosstab: sheets.map((s) => crossTab(sample, s)),
    reasonCodes: reasonCounts(sample, reference),
    notes: { rater: notes(rater), author: notes(author) },
    warnings: sheets.flatMap((s) => s.warnings),
  };
}
