/**
 * SDD bridge (Docs/v1.3/sdd-demo.md): the "## Architecture" section of OpenSpec designs and AI-DLC application designs
 * becomes the DaedalusArch spec. Parsing, the order-independent merge and its conflicts, both front ends, the CLI, and
 * that a derived spec is valid and drives the MCP fast check (application -> outbound adapter blocks on FF-S01).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildSpecYaml, mergeArchitectures, parseArchitectureSection } from '../../../../scripts/sdd/lib/architecture-markdown.js';
import type { ArchitectureSection } from '../../../../scripts/sdd/lib/architecture-markdown.js';
import { aidlcDesignFiles, openSpecDesignFiles } from '../../../../scripts/sdd/lib/sdd-sources.js';
import { main as openSpecMain, openSpecToAac } from '../../../../scripts/sdd/openspec-to-aac.js';
import { aidlcToAac } from '../../../../scripts/sdd/aidlc-to-aac.js';
import { parseSpec } from '../../../../src/spec-parser/spec-parser.js';
import { checkSource } from '../../../../src/mcp-server/file-check.js';
import { ProjectView } from '../../../../src/mcp-server/project-files.js';

const REPO = path.resolve(__dirname, '../../../..');
const PRESETS = path.join(REPO, 'presets');

const BASE_DESIGN = `# Design

## Context

Some prose. \`## Architecture\` inside a fence must not count:

\`\`\`md
## Architecture
Style: layered
\`\`\`

## Architecture

Style: hexagonal

### Layers

| Layer | Kind | Directories | Roles |
|---|---|---|---|
| domain | domain | \`src/domain/**\` | entity, value-object |
| application | application | \`src/application/**\` | use-case, port |
| adapters-inbound | presentation | \`src/adapters/inbound/**\` | controller |
| adapters-outbound | infrastructure | \`src/adapters/outbound/**\` | repository |
| config | application | \`src/config/**\` | composition-root |

### Allowed dependencies

- application -> domain
- adapters-inbound -> application, domain
- adapters-outbound → application, domain
- config -> domain, application, adapters-inbound, adapters-outbound

### Forbidden in domain

- \`express\`
- \`typeorm\`

## Decisions

- not part of the architecture
`;

const SCHEDULED_DESIGN = `# Design

## Architecture

### Layers

| Layer | Kind | Directories | Roles |
|---|---|---|---|
| adapters-scheduled | presentation | \`src/adapters/scheduled/**\` | scheduled-job |

### Allowed dependencies

- adapters-scheduled -> application, domain
- config -> adapters-scheduled
`;

function section(md: string, source: string): ArchitectureSection {
  const r = parseArchitectureSection(md, source);
  if (!r.ok || r.value === undefined) throw new Error(r.ok ? 'no section' : r.errors.join('; '));
  return r.value;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-bridge-'));
}

function write(root: string, rel: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

describe('parseArchitectureSection', () => {
  it('reads style, layers, allowed dependencies (-> and →) and forbidden packages, ignoring fenced code and other sections', () => {
    const s = section(BASE_DESIGN, 'design.md');
    expect(s.style).toBe('hexagonal');
    expect(s.layers.map((l) => l.name)).toEqual(['domain', 'application', 'adapters-inbound', 'adapters-outbound', 'config']);
    expect(s.layers[0]).toEqual({ name: 'domain', kind: 'domain', directories: ['src/domain/**'], roles: ['entity', 'value-object'] });
    expect(s.allowed.get('adapters-outbound')).toEqual(['application', 'domain']);
    expect(s.allowed.get('config')).toHaveLength(4);
    expect(s.forbiddenInDomain).toEqual(['express', 'typeorm']);
  });

  it('answers undefined for an artifact without an architecture section', () => {
    expect(parseArchitectureSection('# Design\n\n## Decisions\n- x\n', 'd.md')).toEqual({ ok: true, value: undefined });
  });

  it('reports an unknown layer kind and an unreadable dependency line with the artifact name', () => {
    const md = '## Architecture\nStyle: hexagonal\n### Layers\n| Layer | Kind | Directories |\n|---|---|---|\n| core | kernel | `src/core/**` |\n### Allowed dependencies\n- core depends on nothing\n';
    const r = parseArchitectureSection(md, 'bad.md');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/bad\.md: layer "core" has kind "kernel"/);
      expect(r.errors.join('\n')).toMatch(/cannot read the allowed dependency/);
    }
  });

  it('adds component paths to their layer', () => {
    const md = `${BASE_DESIGN}\n`.replace('### Forbidden in domain', '### Components\n\n| Component | Layer | Path |\n|---|---|---|\n| billing | adapters-outbound | `lib/billing/**` |\n\n### Forbidden in domain');
    const merged = mergeArchitectures([section(md, 'd.md')]);
    expect(merged.ok && merged.value.layers.find((l) => l.name === 'adapters-outbound')?.directories).toEqual(['src/adapters/outbound/**', 'lib/billing/**']);
  });
});

describe('mergeArchitectures', () => {
  it('unites a later change that adds a layer and edges, in either order', () => {
    const a = section(BASE_DESIGN, 'a.md');
    const b = section(SCHEDULED_DESIGN, 'b.md');
    const ab = mergeArchitectures([a, b]);
    const ba = mergeArchitectures([b, a]);
    expect(ab.ok && ba.ok).toBe(true);
    if (ab.ok && ba.ok) {
      expect(ab.value.style).toBe('hexagonal');
      expect(ab.value.allowed.get('config')).toEqual(['adapters-inbound', 'adapters-outbound', 'adapters-scheduled', 'application', 'domain']);
      expect(Object.fromEntries(ab.value.allowed)).toEqual(Object.fromEntries(ba.value.allowed));
      expect(new Set(ab.value.layers.map((l) => l.name))).toEqual(new Set(ba.value.layers.map((l) => l.name)));
    }
  });

  it('refuses a layer whose kind differs between artifacts, two styles, no style, and an edge to an unknown layer', () => {
    const clash = section('## Architecture\nStyle: layered\n### Layers\n| Layer | Kind | Directories |\n|---|---|---|\n| domain | infrastructure | `x/**` |\n### Allowed dependencies\n- domain -> nowhere\n', 'c.md');
    const r = mergeArchitectures([section(BASE_DESIGN, 'a.md'), clash]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const t = r.errors.join('\n');
      expect(t).toMatch(/layer "domain" is domain in a\.md but infrastructure in c\.md/);
      expect(t).toMatch(/different styles: hexagonal, layered/);
      expect(t).toMatch(/unknown layer "nowhere"/);
    }
    const noStyle = mergeArchitectures([section(SCHEDULED_DESIGN, 'b.md')]);
    expect(!noStyle.ok && noStyle.errors.join()).toMatch(/no artifact states the style/);
    expect(mergeArchitectures([]).ok).toBe(false);
  });
});

describe('buildSpecYaml', () => {
  it('keeps the preset rules and replaces only the architecture and the domain-purity packages', () => {
    const merged = mergeArchitectures([section(BASE_DESIGN, 'a.md')]);
    if (!merged.ok) throw new Error('merge');
    const preset = fs.readFileSync(path.join(PRESETS, 'hexagonal.yaml'), 'utf8');
    const out = buildSpecYaml(merged.value, preset, ['header line']);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value.startsWith('# header line\n')).toBe(true);
    const doc = parseYaml(out.value) as { architecture: { allowed_dependencies: { from: string }[] }; fitness_functions: { name: string; forbidden_imports?: string[] }[] };
    const base = parseYaml(preset) as { fitness_functions: { name: string }[] };
    expect(doc.fitness_functions.map((f) => f.name)).toEqual(base.fitness_functions.map((f) => f.name));
    expect(doc.fitness_functions.find((f) => f.name === 'domain-purity')?.forbidden_imports).toEqual(['express', 'typeorm']);
    expect(doc.architecture.allowed_dependencies.map((d) => d.from)).toEqual(['application', 'adapters-inbound', 'adapters-outbound', 'config']);
  });

  it('refuses a preset of another style', () => {
    const merged = mergeArchitectures([section(BASE_DESIGN, 'a.md')]);
    if (!merged.ok) throw new Error('merge');
    expect(buildSpecYaml(merged.value, fs.readFileSync(path.join(PRESETS, 'layered.yaml'), 'utf8')).ok).toBe(false);
  });
});

describe('OpenSpec front end', () => {
  it('reads archived designs and the chosen active changes; the derived spec parses and drives check_file', async () => {
    const root = tmp();
    try {
      write(root, 'openspec/changes/archive/2026-10-16-add-catalog/design.md', BASE_DESIGN);
      write(root, 'openspec/changes/add-jobs/design.md', SCHEDULED_DESIGN);
      write(root, 'openspec/changes/other/proposal.md', '# no design here');
      const archivedOnly = openSpecDesignFiles(root, []);
      expect(archivedOnly.ok && archivedOnly.value.map((f) => f.rel)).toEqual(['openspec/changes/archive/2026-10-16-add-catalog/design.md']);
      expect(openSpecDesignFiles(root, ['nope']).ok).toBe(false);

      const res = openSpecToAac(root, PRESETS, ['add-jobs']);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.inputs.map((i) => i.rel)).toEqual(['openspec/changes/archive/2026-10-16-add-catalog/design.md', 'openspec/changes/add-jobs/design.md']);
      expect(openSpecToAac(root, PRESETS, ['add-jobs']).ok && openSpecToAac(root, PRESETS, ['add-jobs'])).toEqual(res);

      const specPath = path.join(root, 'spec.yaml');
      fs.writeFileSync(specPath, res.value.yaml);
      const parsed = await parseSpec({ specFilePath: specPath });
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      write(root, 'src/adapters/outbound/MemLoans.ts', 'export class MemLoans { all(): number[] { return []; } }\n');
      const bad = checkSource(parsed.data, {
        path: 'src/application/Report.ts',
        content: "import { MemLoans } from '../adapters/outbound/MemLoans';\nexport class Report { constructor(private readonly l: MemLoans) {} }\n",
        view: new ProjectView({ root }),
      });
      expect(bad.blockingVerdict).toBe('block');
      expect(bad.findings.map((f) => f.ruleId)).toContain('FF-S01');
      const job = checkSource(parsed.data, {
        path: 'src/adapters/scheduled/Job.ts',
        content: "import { Report } from '../../application/Report';\nexport class Job { constructor(private readonly r: Report) {} }\n",
        view: new ProjectView({ root }),
      });
      expect(job.layer).toBe('adapters-scheduled');
      expect(job.blockingVerdict).toBe('pass');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('CLI: writes, then --check passes; a changed design makes --check fail; a bad design exits 2', () => {
    const root = tmp();
    try {
      write(root, 'openspec/changes/add-catalog/design.md', BASE_DESIGN);
      const out = path.join(root, '.daedalus/architecture.yaml');
      const errs: string[] = [];
      const run = (...a: string[]): number => openSpecMain(['--project', root, '--presets', PRESETS, ...a], REPO, () => undefined, (t) => errs.push(t));
      expect(run('--out', out)).toBe(0);
      expect(run('--out', out, '--check')).toBe(0);
      write(root, 'openspec/changes/add-catalog/design.md', BASE_DESIGN.replace('- `typeorm`\n', ''));
      expect(run('--out', out, '--check')).toBe(1);
      write(root, 'openspec/changes/add-catalog/design.md', '## Architecture\nStyle: hexagonal\n');
      expect(run('--out', out)).toBe(2);
      expect(openSpecMain([], REPO, () => undefined, () => undefined)).toBe(2);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('AI-DLC front end', () => {
  it('reads application-design artifacts and unit functional designs', () => {
    const root = tmp();
    try {
      write(root, 'aidlc-docs/inception/application-design/application-design.md', BASE_DESIGN);
      write(root, 'aidlc-docs/inception/application-design/components.md', '# Components\n\nNo architecture section.\n');
      write(root, 'aidlc-docs/construction/jobs/functional-design/business-logic-model.md', SCHEDULED_DESIGN);
      const files = aidlcDesignFiles(root);
      expect(files.ok && files.value.map((f) => f.rel)).toEqual([
        'aidlc-docs/inception/application-design/application-design.md',
        'aidlc-docs/inception/application-design/components.md',
        'aidlc-docs/construction/jobs/functional-design/business-logic-model.md',
      ]);
      const res = aidlcToAac(root, PRESETS);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.yaml).toContain('Generated by scripts/sdd/aidlc-to-aac.ts');
        expect(res.value.merged.layers.map((l) => l.name)).toContain('adapters-scheduled');
      }
      expect(aidlcToAac(tmp(), PRESETS).ok).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('SDD demo transcript', () => {
  it('replays: the committed demo is rebuilt byte for byte and every tool call gives the recorded result (fast checks only)', async () => {
    const { replay } = await import('../../../../scripts/sdd/lib/replay.js');
    const report = await replay({ repoRoot: REPO, demoDir: path.join(REPO, 'examples/sdd-library-loans'), fullEval: false });
    expect(report.steps.filter((s) => !s.ok)).toEqual([]);
    expect(report.treeDiff).toEqual([]);
    expect(report.markdownMatches).toBe(true);
    expect(report.typecheck).toBe(true);
    expect(report.scenarios.ok).toBe(true);
    const blocked = report.steps.filter((s) => s.what === 'check_file -> block');
    expect(blocked.map((s) => s.change)).toEqual(['add-overdue-report']);
  }, 120_000);
});
