/**
 * EFF-01 inputs (design DR-6 to DR-8): the committed question set, key and repo pins, hashed; and the verbatim
 * `architecture:` block of a spec (DR-7).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../../src/shared/errors/domain-result.js';

export const QUESTIONS_REL = 'experiments/eff-01/questions.json';
export const ANSWERS_REL = 'experiments/eff-01/answers.json';
export const REPOS_REL = 'experiments/eff-01/repos.json';

export interface Eff01Question {
  readonly id: string;
  readonly repoId: string;
  readonly template: string;
  readonly class: string;
  readonly text: string;
  readonly answerFormat: Readonly<Record<string, unknown>>;
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface Eff01Repo {
  readonly id: string;
  readonly sha: string;
  /** Repo-relative spec path. */
  readonly spec: string;
}

export interface Eff01Key {
  readonly template: string;
  readonly answer: unknown;
}

export interface Eff01Inputs {
  readonly conventions: readonly string[];
  /** Questions per repo, in file order. */
  readonly questions: Readonly<Record<string, readonly Eff01Question[]>>;
  readonly questionById: ReadonlyMap<string, Eff01Question>;
  readonly keys: ReadonlyMap<string, Eff01Key>;
  readonly repos: readonly Eff01Repo[];
  readonly sha256: { readonly questions: string; readonly answers: string; readonly repos: string };
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function err(code: string, message: string): DomainError {
  return { code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parses the three files' texts (separate from the reads so tests can feed perturbed copies). */
export function parseEff01Inputs(texts: { questions: string; answers: string; repos: string }): DomainResult<Eff01Inputs> {
  let q: unknown;
  let a: unknown;
  let r: unknown;
  try {
    q = JSON.parse(texts.questions);
    a = JSON.parse(texts.answers);
    r = JSON.parse(texts.repos);
  } catch (e) {
    return DomainResult.fail([err('EFF01_INPUT_INVALID', `an EFF-01 input is not JSON: ${(e as Error).message}`)]);
  }
  if (!isRecord(q) || !Array.isArray(q.conventions) || !isRecord(q.repos)) return DomainResult.fail([err('EFF01_INPUT_INVALID', 'questions.json lacks conventions or repos')]);
  if (!isRecord(a) || !isRecord(a.repos)) return DomainResult.fail([err('EFF01_INPUT_INVALID', 'answers.json lacks repos')]);
  if (!isRecord(r) || !Array.isArray(r.repos)) return DomainResult.fail([err('EFF01_INPUT_INVALID', 'repos.json lacks repos')]);

  const errors: DomainError[] = [];
  const repos: Eff01Repo[] = [];
  for (const entry of r.repos as unknown[]) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.sha !== 'string' || typeof entry.spec !== 'string') {
      errors.push(err('EFF01_INPUT_INVALID', 'a repos.json entry lacks id, sha or spec'));
      continue;
    }
    repos.push({ id: entry.id, sha: entry.sha, spec: entry.spec });
  }
  const questions: Record<string, Eff01Question[]> = {};
  const questionById = new Map<string, Eff01Question>();
  const keys = new Map<string, Eff01Key>();
  const qRepos = Object.keys(q.repos);
  const repoIds = repos.map((x) => x.id);
  if (qRepos.length !== repoIds.length || !qRepos.every((id) => repoIds.includes(id))) {
    errors.push(err('EFF01_INPUT_MISMATCH', 'questions.json and repos.json name different repos'));
  }
  for (const repoId of qRepos) {
    const list = q.repos[repoId];
    const keyRepo = a.repos[repoId];
    if (!Array.isArray(list)) {
      errors.push(err('EFF01_INPUT_INVALID', `questions.json repo ${repoId} is not a list`));
      continue;
    }
    const keyAnswers = isRecord(keyRepo) && isRecord(keyRepo.answers) ? keyRepo.answers : undefined;
    if (keyAnswers === undefined) errors.push(err('EFF01_INPUT_MISMATCH', `answers.json has no answers for ${repoId}`));
    questions[repoId] = [];
    for (const raw of list as unknown[]) {
      if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.template !== 'string' || typeof raw.text !== 'string' || !isRecord(raw.answerFormat)) {
        errors.push(err('EFF01_INPUT_INVALID', `a question of ${repoId} lacks id, template, text or answerFormat`));
        continue;
      }
      const question: Eff01Question = {
        id: raw.id,
        repoId,
        template: raw.template,
        class: typeof raw.class === 'string' ? raw.class : '',
        text: raw.text,
        answerFormat: raw.answerFormat,
        ...(isRecord(raw.params) ? { params: raw.params } : {}),
      };
      questions[repoId].push(question);
      questionById.set(question.id, question);
      const key = keyAnswers?.[raw.id];
      if (!isRecord(key) || !('answer' in key)) {
        errors.push(err('EFF01_INPUT_MISMATCH', `question ${raw.id} has no key in answers.json`));
        continue;
      }
      if (key.template !== raw.template) errors.push(err('EFF01_INPUT_MISMATCH', `question ${raw.id}: template differs between questions.json and answers.json`));
      keys.set(raw.id, { template: raw.template, answer: key.answer });
    }
  }
  if (errors.length > 0) return DomainResult.fail(errors);
  return DomainResult.ok({
    conventions: (q.conventions as unknown[]).map(String),
    questions,
    questionById,
    keys,
    repos,
    sha256: { questions: sha256Hex(texts.questions), answers: sha256Hex(texts.answers), repos: sha256Hex(texts.repos) },
  });
}

/** Reads and hashes the committed question set, key and pins. */
export function loadEff01Inputs(repoRoot: string): DomainResult<Eff01Inputs> {
  try {
    return parseEff01Inputs({
      questions: fs.readFileSync(path.join(repoRoot, QUESTIONS_REL), 'utf8'),
      answers: fs.readFileSync(path.join(repoRoot, ANSWERS_REL), 'utf8'),
      repos: fs.readFileSync(path.join(repoRoot, REPOS_REL), 'utf8'),
    });
  } catch (e) {
    return DomainResult.fail([err('EFF01_INPUT_MISSING', `an EFF-01 input cannot be read: ${(e as NodeJS.ErrnoException).code ?? 'error'}`)]);
  }
}

const ARCH_LINE = /^architecture:\s*$/;
const TOP_LEVEL_KEY = /^[A-Za-z_][A-Za-z0-9_]*:/;

/**
 * DR-7: from the one line matching `^architecture:\s*$` up to (not including) the next top-level key, trailing blank
 * lines dropped. Zero or several matching lines are refused (a comment mentioning `architecture:` does not match).
 * `stripComments` (author question 8, default off) drops whole-line YAML comments.
 */
export function architectureBlock(specText: string, opts: { readonly stripComments?: boolean } = {}): DomainResult<string> {
  const lines = specText.split(/\r?\n/);
  const starts = lines.map((l, i) => (ARCH_LINE.test(l) ? i : -1)).filter((i) => i >= 0);
  if (starts.length !== 1) {
    return DomainResult.fail([err('EFF01_SPEC_ARCH_BLOCK', `the spec has ${String(starts.length)} lines matching ^architecture:\\s*$ (exactly one is required)`)]);
  }
  const start = starts[0] ?? 0;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (TOP_LEVEL_KEY.test(lines[i] ?? '')) {
      end = i;
      break;
    }
  }
  let block = lines.slice(start, end);
  if (opts.stripComments === true) block = block.filter((l) => !/^\s*#/.test(l));
  while (block.length > 0 && (block[block.length - 1] ?? '').trim() === '') block.pop();
  return DomainResult.ok(block.join('\n'));
}
