/**
 * Manifest module (C15.2): validation, single-writer lock, atomic append, golden-instance count
 * (FR-v1.2E-24 "edits code and appends the row in one step"; BR-U5a-01, 31, 34, 35; D-U5a-13, D-U5a-14;
 * SECURITY-05; NFR-08).
 *
 * - The frozen schema is read from `path.resolve(repoRoot, 'schemas/manifest.schema.json')` and compiled once per
 *   path with Ajv (strict, all errors) and ajv-formats.
 * - Every load validates (`MAN_INVALID` with the Ajv errors). Every append validates the whole manifest after the
 *   append, writes a temp file in the manifest's directory and renames it over the manifest; on any failure the
 *   manifest bytes are unchanged.
 * - One writer per manifest: `acquireManifestLock` creates `<manifest>.lock` with `O_EXCL`; an existing (also a
 *   stale) lock gives `MAN_LOCKED`. Callers hold the lock for the whole run.
 * - `appendManifestRow` refuses a row built under a cycle strategy other than the header's
 *   (`MAN_CYCLE_STRATEGY_MISMATCH`), so one manifest never mixes cycle-key forms (D-U5a-14).
 * - Rejection `detail` (and the whole rejection) passes through `scrubDeep` with the known secrets of the
 *   environment and the home directory (NFR-08).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Ajv } from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import { scrubDeep } from '../../src/shared/errors/scrub.js';
import { SYMBOLIC_DIMENSIONS } from '../../src/shared/types/enums.js';
import type {
  BaseKind,
  CycleStrategy,
  ExpectedBlock,
  LineShift,
  MutationSite,
  ProvisionedStub,
  SiteSelection,
  TypecheckEvidence,
} from './mutation/types.js';

export const MANIFEST_SCHEMA_PATH = 'schemas/manifest.schema.json';

export type Split = 'dev' | 'held-out' | 'probe';

export interface RowSeedDerivation {
  readonly projectId: string;
  readonly operatorId: string;
  readonly k: number;
}

export interface ManifestRow {
  /** `${projectId}:${operatorId}:${k}`. */
  readonly seedId: string;
  readonly projectId: string;
  readonly baseKind: BaseKind;
  /** Required for fixture | corpus. */
  readonly baseCommit?: string;
  /** Required for generated. */
  readonly baseGenerationTreeSha?: string;
  /** 40 hex. */
  readonly baseTreeSha: string;
  /** 64 hex. */
  readonly installLockSha256?: string;
  readonly specPath: string;
  /** 64 hex. */
  readonly specSha256: string;
  readonly split: Split;
  readonly operatorId: string;
  readonly catalogueVersion: string;
  /** uint32. */
  readonly rngSeed: number;
  readonly seedDerivation: RowSeedDerivation;
  readonly siteIndex: number;
  /** forced ⇒ split ≠ 'held-out' (schema). */
  readonly siteSelection: SiteSelection;
  readonly site: MutationSite;
  readonly editedFiles: readonly string[];
  readonly createdFiles: readonly string[];
  readonly lineShifts: readonly LineShift[];
  readonly expected: ExpectedBlock;
  readonly provisionedStubs: readonly ProvisionedStub[];
  readonly typecheck: TypecheckEvidence;
  /** ISO 8601 date-time. */
  readonly appliedAt: string;
}

export type RejectionReason = 'no-site' | 'precondition' | 'typecheck' | 'apply-error';

export interface ManifestRejection {
  readonly operatorId: string;
  readonly projectId: string;
  readonly reason: RejectionReason;
  /** Scrubbed. */
  readonly detail: string;
  readonly rngSeed?: number;
  readonly seedDerivation?: RowSeedDerivation;
  readonly appliedAt: string;
}

export interface ManifestHeader {
  readonly catalogueVersion: string;
  readonly masterSeed: number;
  readonly cycleStrategy: CycleStrategy;
}

export interface Manifest extends ManifestHeader {
  readonly schemaVersion: '1';
  readonly rows: readonly ManifestRow[];
  readonly rejections: readonly ManifestRejection[];
}

export interface ManifestValidation {
  readonly valid: boolean;
  readonly errors: readonly { readonly path: string; readonly message: string }[];
}

/** File operations of the atomic write; injectable so a crash between temp write and rename can be simulated. */
export interface ManifestIo {
  writeFile(file: string, data: string): void;
  rename(from: string, to: string): void;
}

const NODE_IO: ManifestIo = {
  writeFile: (file, data) => {
    fs.writeFileSync(file, data, { encoding: 'utf8', flag: 'wx' });
  },
  rename: (from, to) => {
    fs.renameSync(from, to);
  },
};

const validators = new Map<string, ValidateFunction>();

function validatorFor(repoRoot: string): ValidateFunction {
  const schemaPath = path.resolve(repoRoot, MANIFEST_SCHEMA_PATH);
  const cached = validators.get(schemaPath);
  if (cached !== undefined) return cached;
  const ajv = new Ajv({ strict: true, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
  const validate = ajv.compile(schema);
  validators.set(schemaPath, validate);
  return validate;
}

function toErrors(errors: readonly ErrorObject[] | null | undefined): ManifestValidation['errors'] {
  return (errors ?? []).map((e) => ({ path: e.instancePath === '' ? '/' : e.instancePath, message: e.message ?? e.keyword }));
}

/** Validates a manifest document against the frozen schema (BR-U5a-31). */
export function validateManifest(repoRoot: string, json: unknown): ManifestValidation {
  const validate = validatorFor(repoRoot);
  const valid = validate(json);
  return { valid, errors: valid ? [] : toErrors(validate.errors) };
}

function invalid<T>(manifestPath: string, errors: ManifestValidation['errors']): DomainResult<T> {
  return DomainResult.fail([
    {
      code: 'MAN_INVALID',
      message: `manifest ${path.basename(manifestPath)} fails schema validation (${String(errors.length)} error(s))`,
      context: { errors },
    },
  ]);
}

/** Reads and validates a manifest (validated on every load, BR-U5a-35). */
export function loadManifest(repoRoot: string, manifestPath: string): DomainResult<Manifest> {
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e: unknown) {
    return invalid(manifestPath, [{ path: '/', message: e instanceof Error ? e.message : String(e) }]);
  }
  const result = validateManifest(repoRoot, json);
  return result.valid ? DomainResult.ok(json as Manifest) : invalid(manifestPath, result.errors);
}

/** An empty manifest with the given header. */
export function emptyManifest(header: ManifestHeader): Manifest {
  return {
    schemaVersion: '1',
    catalogueVersion: header.catalogueVersion,
    masterSeed: header.masterSeed,
    cycleStrategy: header.cycleStrategy,
    rows: [],
    rejections: [],
  };
}

function serialise(m: Manifest): string {
  return JSON.stringify(m, null, 2) + '\n';
}

/**
 * Validates `next` and writes it atomically: temp file in the manifest's directory, then rename.
 * On any failure the manifest bytes are unchanged (the temp file is removed when possible).
 */
function writeValidated(repoRoot: string, manifestPath: string, next: Manifest, io: ManifestIo): DomainResult<void> {
  const check = validateManifest(repoRoot, next);
  if (!check.valid) return invalid(manifestPath, check.errors);
  const dir = path.dirname(manifestPath);
  const tmp = path.join(dir, `.${path.basename(manifestPath)}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`);
  try {
    io.writeFile(tmp, serialise(next));
    io.rename(tmp, manifestPath);
  } catch (e: unknown) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      // the old manifest is intact either way
    }
    return DomainResult.fail([
      { code: 'MAN_WRITE_FAILED', message: `manifest write failed: ${scrubText(e instanceof Error ? e.message : String(e))}` },
    ]);
  }
  return DomainResult.ok(undefined);
}

/** Creates a new, empty manifest file (refuses to overwrite an existing one). */
export function initManifest(
  repoRoot: string,
  manifestPath: string,
  header: ManifestHeader,
  io: ManifestIo = NODE_IO,
): DomainResult<void> {
  if (fs.existsSync(manifestPath)) {
    return DomainResult.fail([{ code: 'MAN_EXISTS', message: `manifest ${path.basename(manifestPath)} already exists` }]);
  }
  return writeValidated(repoRoot, manifestPath, emptyManifest(header), io);
}

/** Single writer (BR-U5a-35): `<manifest>.lock` created with O_EXCL; any existing lock gives `MAN_LOCKED`. */
export function acquireManifestLock(manifestPath: string): DomainResult<{ release(): void }> {
  const lockPath = `${manifestPath}.lock`;
  let fd: number;
  try {
    fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  } catch (e: unknown) {
    // `code` check without `instanceof Error`: Node errors may come from another realm (jest VM).
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'EEXIST') {
      return DomainResult.fail([
        { code: 'MAN_LOCKED', message: `manifest ${path.basename(manifestPath)} is locked by another writer (${path.basename(lockPath)})` },
      ]);
    }
    throw e;
  }
  fs.writeSync(fd, `${String(process.pid)}\n`);
  fs.closeSync(fd);
  let released = false;
  return DomainResult.ok({
    release(): void {
      if (released) return;
      released = true;
      fs.rmSync(lockPath, { force: true });
    },
  });
}

/**
 * Appends one row (BR-U5a-35). `cycleStrategy` is the strategy the row was built under
 * (`ApplyOptions.cycleStrategy`); it must equal the manifest header's (D-U5a-14).
 */
export function appendManifestRow(
  repoRoot: string,
  manifestPath: string,
  row: ManifestRow,
  cycleStrategy: CycleStrategy,
  io: ManifestIo = NODE_IO,
): DomainResult<void> {
  const loaded = loadManifest(repoRoot, manifestPath);
  if (!loaded.success) return loaded;
  const current = loaded.data;
  if (current.cycleStrategy !== cycleStrategy) {
    return DomainResult.fail([
      {
        code: 'MAN_CYCLE_STRATEGY_MISMATCH',
        message: `row built under cycle strategy '${cycleStrategy}' but the manifest header records '${current.cycleStrategy}'`,
      },
    ]);
  }
  return writeValidated(repoRoot, manifestPath, { ...current, rows: [...current.rows, row] }, io);
}

/** Appends one rejection (BR-U5a-34, 35); the rejection is scrubbed first (NFR-08). */
export function appendRejection(
  repoRoot: string,
  manifestPath: string,
  rejection: ManifestRejection,
  io: ManifestIo = NODE_IO,
): DomainResult<void> {
  const loaded = loadManifest(repoRoot, manifestPath);
  if (!loaded.success) return loaded;
  const scrubbed = scrubDeep(rejection, knownSecrets());
  return writeValidated(repoRoot, manifestPath, { ...loaded.data, rejections: [...loaded.data.rejections, scrubbed] }, io);
}

/**
 * Golden-set instances (BR-U5a-01): held-out rows that are positive (no `negative`), not judge probes, and whose
 * operator is symbolic (dimension a symbolic member, in or outside coverage). Twins, judge probes, dev and probe
 * rows, and rejections never count.
 */
export function countGoldenInstances(m: Manifest): number {
  return m.rows.filter(isGoldenRow).length;
}

/** One row of the golden set (BR-U5a-01; the rule of `countGoldenInstances`). */
export function isGoldenRow(r: Pick<ManifestRow, 'split' | 'expected'>): boolean {
  const symbolic: readonly string[] = SYMBOLIC_DIMENSIONS;
  return r.split === 'held-out' && r.expected.negative !== true && r.expected.judgeProbe === undefined && symbolic.includes(r.expected.dimension);
}

const SECRET_ENV_NAME = /(KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH)/i;

/** Values to remove by literal match: the home directory and secret-named environment values. */
export function knownSecrets(env: NodeJS.ProcessEnv = process.env): readonly string[] {
  const secrets = [os.homedir()];
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && value.length >= 8 && SECRET_ENV_NAME.test(name)) secrets.push(value);
  }
  return secrets;
}

function scrubText(text: string): string {
  return scrubDeep(text, knownSecrets());
}
