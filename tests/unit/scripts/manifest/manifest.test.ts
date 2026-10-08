/**
 * Manifest module (U5a plan Step 7; BR-U5a-01, 34, 35; D-U5a-14; NFR-08).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  acquireManifestLock,
  appendManifestRow,
  appendRejection,
  countGoldenInstances,
  emptyManifest,
  initManifest,
  knownSecrets,
  loadManifest,
  validateManifest,
} from '../../../../scripts/lib/manifest.js';
import type { Manifest, ManifestHeader, ManifestRejection, ManifestRow } from '../../../../scripts/lib/manifest.js';
import type { ExpectedBlock } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const SHA1 = '7cd15b4b7c364284a468e6fcf12c1577633ed1fa';
const SHA256 = 'b'.repeat(64);
const HEADER: ManifestHeader = { catalogueVersion: SHA256, masterSeed: 20261008, cycleStrategy: 'simple-cycles' };

function positive(over: Partial<Extract<ExpectedBlock, { negative?: undefined }>> = {}): ExpectedBlock {
  return {
    functionIds: ['FF-S01'],
    disabledFunctionIds: [],
    absentTemplates: [],
    dimension: 'structural',
    keys: [
      {
        functionId: 'FF-S01',
        filePath: 'src/domain/entities/Task.ts',
        target: 'src/infrastructure/InMemoryTaskRepository.ts',
        discriminator: ['IMPORTS'],
        lineRule: 'site-line',
        line: 3,
      },
    ],
    collateral: [],
    coverage: 'in',
    ...over,
  };
}

function row(over: Partial<ManifestRow> = {}): ManifestRow {
  return {
    seedId: 'correct-reference:MO-S01:0',
    projectId: 'correct-reference',
    baseKind: 'fixture',
    baseCommit: SHA1,
    baseTreeSha: SHA1,
    specPath: 'specs/clean-arch.yaml',
    specSha256: SHA256,
    split: 'dev',
    operatorId: 'MO-S01',
    catalogueVersion: SHA256,
    rngSeed: 2184350454,
    seedDerivation: { projectId: 'correct-reference', operatorId: 'MO-S01', k: 0 },
    siteIndex: 0,
    siteSelection: 'forced',
    site: { filePath: 'src/domain/entities/Task.ts', line: 3, kind: 'import-edge', detail: {} },
    editedFiles: ['src/domain/entities/Task.ts'],
    createdFiles: [],
    lineShifts: [{ filePath: 'src/domain/entities/Task.ts', afterLine: 2, delta: 1 }],
    expected: positive(),
    provisionedStubs: [],
    typecheck: { tscPath: '/repo/node_modules/typescript/lib/tsc.js', tscVersion: '5.9.3', baseErrors: 0, mutantErrors: 0 },
    appliedAt: '2026-10-08T12:00:00Z',
    ...over,
  };
}

const corpus = (over: Partial<ManifestRow> = {}): ManifestRow =>
  row({ baseKind: 'corpus', split: 'held-out', siteSelection: 'sampled', projectId: 'p1', seedId: 'p1:MO-S01:0', ...over });

function rejection(over: Partial<ManifestRejection> = {}): ManifestRejection {
  return {
    operatorId: 'MO-S01',
    projectId: 'correct-reference',
    reason: 'no-site',
    detail: 'no eligible site',
    appliedAt: '2026-10-08T12:00:00Z',
    ...over,
  };
}

const sha = (file: string): string => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('manifest module (BR-U5a-34, 35)', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-manifest-'));
    file = path.join(dir, 'manifest.json');
    const init = initManifest(REPO, file, HEADER);
    expect(init.success).toBe(true);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates a valid empty manifest and refuses to overwrite it', () => {
    const loaded = loadManifest(REPO, file);
    expect(loaded.success && loaded.data).toEqual(emptyManifest(HEADER));
    const again = initManifest(REPO, file, HEADER);
    expect(!again.success && again.errors[0]?.code).toBe('MAN_EXISTS');
  });

  it('appends a valid row and a valid rejection, and validates on load', () => {
    expect(appendManifestRow(REPO, file, row(), 'simple-cycles').success).toBe(true);
    expect(appendRejection(REPO, file, rejection()).success).toBe(true);
    const loaded = loadManifest(REPO, file);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    expect(loaded.data.rows).toHaveLength(1);
    expect(loaded.data.rejections).toHaveLength(1);
    expect(fs.readdirSync(dir)).toEqual(['manifest.json']);
  });

  it('loadManifest fails with MAN_INVALID on an invalid or unparsable file', () => {
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: '1', rows: [] }));
    const bad = loadManifest(REPO, file);
    expect(!bad.success && bad.errors[0]?.code).toBe('MAN_INVALID');
    fs.writeFileSync(file, '{ not json');
    const unparsable = loadManifest(REPO, file);
    expect(!unparsable.success && unparsable.errors[0]?.code).toBe('MAN_INVALID');
  });

  it('a second writer gets MAN_LOCKED until the first releases', () => {
    const first = acquireManifestLock(file);
    expect(first.success).toBe(true);
    const second = acquireManifestLock(file);
    expect(!second.success && second.errors[0]?.code).toBe('MAN_LOCKED');
    if (first.success) first.data.release();
    const third = acquireManifestLock(file);
    expect(third.success).toBe(true);
    if (third.success) third.data.release();
    expect(fs.existsSync(`${file}.lock`)).toBe(false);
  });

  it('a stale lock file blocks with MAN_LOCKED', () => {
    fs.writeFileSync(`${file}.lock`, '99999\n');
    const r = acquireManifestLock(file);
    expect(!r.success && r.errors[0]?.code).toBe('MAN_LOCKED');
  });

  it('an invalid row leaves the manifest bytes unchanged', () => {
    appendManifestRow(REPO, file, row(), 'simple-cycles');
    const before = sha(file);
    const heldOutForced = corpus({ siteSelection: 'forced' });
    const r = appendManifestRow(REPO, file, heldOutForced, 'simple-cycles');
    expect(!r.success && r.errors[0]?.code).toBe('MAN_INVALID');
    expect(sha(file)).toBe(before);
    const r2 = appendRejection(REPO, file, { ...rejection(), reason: 'timeout' as 'no-site' });
    expect(!r2.success && r2.errors[0]?.code).toBe('MAN_INVALID');
    expect(sha(file)).toBe(before);
    expect(fs.readdirSync(dir)).toEqual(['manifest.json']);
  });

  it('a crash between the temp write and the rename leaves the old manifest valid', () => {
    appendManifestRow(REPO, file, row(), 'simple-cycles');
    const before = sha(file);
    const crashingIo = {
      writeFile: (f: string, data: string): void => {
        fs.writeFileSync(f, data);
      },
      rename: (): void => {
        throw new Error('simulated crash before rename');
      },
    };
    const r = appendManifestRow(REPO, file, row({ seedId: 'correct-reference:MO-S01:1' }), 'simple-cycles', crashingIo);
    expect(!r.success && r.errors[0]?.code).toBe('MAN_WRITE_FAILED');
    expect(sha(file)).toBe(before);
    const loaded = loadManifest(REPO, file);
    expect(loaded.success && loaded.data.rows).toHaveLength(1);
  });

  it('a temp file left by a crash does not affect the manifest', () => {
    const before = sha(file);
    const leavingIo = {
      writeFile: (f: string, data: string): void => {
        fs.writeFileSync(f, data);
      },
      rename: (): void => {
        throw new Error('killed');
      },
    };
    appendRejection(REPO, file, rejection(), leavingIo);
    expect(sha(file)).toBe(before);
    expect(loadManifest(REPO, file).success).toBe(true);
  });

  it('scrubs the rejection detail (NFR-08)', () => {
    const token = ['sk', 'ant', 'api03', 'AbCdEfGhIjKlMnOpQrStUvWxYz012345'].join('-');
    const home = os.homedir();
    const detail = `Error: cannot read ${path.join(home, 'secret', 'x.ts')} with key ${token}`;
    expect(appendRejection(REPO, file, rejection({ reason: 'apply-error', detail })).success).toBe(true);
    const loaded = loadManifest(REPO, file);
    expect(loaded.success).toBe(true);
    if (!loaded.success) return;
    const stored = loaded.data.rejections[0]?.detail ?? '';
    expect(stored).not.toContain(token);
    expect(stored).not.toContain(home);
    expect(stored).toContain('[REDACTED]');
    expect(fs.readFileSync(file, 'utf8')).not.toContain(token);
  });

  it('knownSecrets lists the home directory and secret-named environment values only', () => {
    const secrets = knownSecrets({ MY_API_KEY: 'abcdefgh12345', SHORT_TOKEN: 'abc', PATH: '/usr/bin:/bin:/opt/x' });
    expect(secrets).toContain(os.homedir());
    expect(secrets).toContain('abcdefgh12345');
    expect(secrets).not.toContain('abc');
    expect(secrets).not.toContain('/usr/bin:/bin:/opt/x');
  });

  it('refuses a row built under another cycle strategy with MAN_CYCLE_STRATEGY_MISMATCH (D-U5a-14)', () => {
    const before = sha(file);
    const r = appendManifestRow(REPO, file, row(), 'scc');
    expect(!r.success && r.errors[0]?.code).toBe('MAN_CYCLE_STRATEGY_MISMATCH');
    expect(sha(file)).toBe(before);
  });

  it('accepts scc rows on an scc manifest', () => {
    const sccFile = path.join(dir, 'scc.json');
    initManifest(REPO, sccFile, { ...HEADER, cycleStrategy: 'scc' });
    expect(appendManifestRow(REPO, sccFile, row(), 'scc').success).toBe(true);
    expect(appendManifestRow(REPO, sccFile, row(), 'simple-cycles').success).toBe(false);
  });
});

describe('validateManifest', () => {
  it('reports errors with paths for an invalid document and none for a valid one', () => {
    expect(validateManifest(REPO, emptyManifest(HEADER))).toEqual({ valid: true, errors: [] });
    const bad = validateManifest(REPO, { ...emptyManifest(HEADER), masterSeed: -1 });
    expect(bad.valid).toBe(false);
    expect(bad.errors.some((e) => e.path === '/masterSeed')).toBe(true);
  });
});

describe('countGoldenInstances (BR-U5a-01)', () => {
  it('counts only held-out symbolic positives that are not judge probes: seven kinds give 2', () => {
    const m: Manifest = {
      ...emptyManifest(HEADER),
      rows: [
        corpus(), // held-out positive in coverage
        corpus({ operatorId: 'MO-X01', seedId: 'p1:MO-X01:0', expected: positive({ coverage: 'outside' }) }), // outside coverage
        corpus({
          operatorId: 'MO-S01n',
          seedId: 'p1:MO-S01n:0',
          expected: { negative: true, twinOf: 'MO-S01', functionIds: [], keys: [], collateral: [], coverage: 'in' },
        }), // twin
        corpus({
          operatorId: 'MO-X02',
          seedId: 'p1:MO-X02:0',
          expected: positive({ functionIds: [], keys: [], dimension: 'semantic', coverage: 'outside', judgeProbe: 'semantic' }),
        }), // judge probe
        row(), // dev positive
        row({ split: 'probe', operatorId: 'SP-FF-S01', seedId: 'correct-reference:SP-FF-S01:0' }), // probe row
      ],
      rejections: [rejection({ projectId: 'p1' })],
    };
    expect(validateManifest(REPO, m)).toEqual({ valid: true, errors: [] });
    expect(countGoldenInstances(m)).toBe(2);
  });
});
