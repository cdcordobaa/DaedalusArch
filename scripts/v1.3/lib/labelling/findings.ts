/**
 * v1.3 labelling (Docs/v1.3/validation-protocol.md §3): the findings to label, read from evaluate reports.
 *
 * A job names one evaluated project: its source root, its spec and the report (or reference-run evidence file) whose
 * `violations` hold the findings. Every finding keeps the fields the report schema gives it (rule, file, line,
 * target, discriminator, evidence, message); nothing else of the report is read (no score, no judge output).
 *
 * The template a finding comes from is recovered from its type (`CUSTOM_<template>` for the hexagonal and DDD
 * libraries, the built-in type otherwise) and checked against its rule id and the spec's style.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { ruleTier } from '../../../../src/scoring-engine/rule-tiers.js';
import type { RuleTier } from '../../../../src/scoring-engine/rule-tiers.js';

export interface LabellingJob {
  /** Project id (E1: `<model>/<task>/<spec>/<run>`; reference: `<style>/<variant>`). */
  readonly projectId: string;
  /** Absolute path of the project source root (holds its tsconfig.json). */
  readonly projectRoot: string;
  /** Absolute path of the spec YAML the report was evaluated with. */
  readonly spec: string;
  /** Absolute path of the report or evidence JSON (`violations` array). */
  readonly report: string;
  /** Architecture style; read from the spec when absent. */
  readonly style?: string;
  /** `adr-032`: the source is read with the pinned E1 tsconfig (the tree's own is ignored); default `own`. */
  readonly tsconfig?: 'own' | 'adr-032';
}

export interface JobsFile {
  readonly schemaVersion: 1;
  readonly kind: 'e1' | 'reference' | 'custom';
  readonly jobs: readonly LabellingJob[];
}

export interface Finding {
  /** Stable key: sha256 over project id and the violation id (or its identity fields). */
  readonly key: string;
  readonly projectId: string;
  readonly style: string;
  readonly ruleId: string;
  /** Template name, '' when it cannot be recovered. */
  readonly template: string;
  readonly type: string;
  readonly tier: RuleTier;
  readonly file: string;
  readonly line?: number;
  readonly lines?: readonly number[];
  readonly target?: string;
  readonly discriminator: readonly string[];
  readonly evidence: readonly string[];
  readonly message: string;
  readonly violationId?: string;
}

/** Built-in violation type -> template (the frozen CYPHER_TEMPLATES names). */
export const BUILT_IN_TYPE_TEMPLATES: Readonly<Record<string, string>> = Object.freeze({
  LAYER_VIOLATION: 'dependency-direction',
  CYCLIC_DEPENDENCY: 'no-cyclic-deps',
  LAYER_SKIP: 'no-layer-skip',
  DOMAIN_OUTWARD_DEP: 'no-domain-outward-dep',
  DOMAIN_PURITY_VIOLATION: 'domain-purity',
  DEPENDENCY_INVERSION_VIOLATION: 'dependency-inversion',
  REPOSITORY_PATTERN_VIOLATION: 'repository-pattern',
  USE_CASE_ISOLATION_VIOLATION: 'use-case-isolation',
  CONTROLLER_ENTITY_VIOLATION: 'controller-no-entity',
  DOMAIN_STATE_PURITY_VIOLATION: 'domain-state-purity',
  FAN_OUT_EXCEEDED: 'module-fan-out',
  FAN_IN_EXCEEDED: 'max-fan-in',
  ORPHAN_FILE: 'no-orphan-files',
  LOW_ABSTRACTION_RATIO: 'abstraction-ratio',
  SRP_VIOLATION: 'single-responsibility-proxy',
  ISP_VIOLATION: 'interface-segregation-proxy',
  INHERITANCE_DEPTH_EXCEEDED: 'inheritance-depth',
  MISSING_TEST_FILE: 'test-file-pairing',
  INDEX_LOGIC_VIOLATION: 'no-index-logic',
});

/** `NAMING_CONVENTION` is shared by four templates; the rule id decides (template-registry.ts). */
const NAMING_TEMPLATES: Readonly<Record<string, string>> = Object.freeze({
  'FF-CV01': 'naming-conventions', 'FF-CV02': 'naming-services', 'FF-CV03': 'naming-repos', 'FF-CV04': 'naming-controllers',
});

/** The template of a finding from its type; `INSTABILITY_VIOLATION` and naming types are shared, so the id decides. */
export function templateOf(type: string, ruleId: string): string {
  if (type.startsWith('CUSTOM_')) return type.slice('CUSTOM_'.length);
  const direct = BUILT_IN_TYPE_TEMPLATES[type];
  if (direct !== undefined) return direct;
  if (type === 'INSTABILITY_VIOLATION') return ruleId === 'FF-C01' ? 'domain-stability' : 'component-instability';
  if (type === 'NAMING_CONVENTION') return NAMING_TEMPLATES[ruleId] ?? '';
  return '';
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function findingKey(projectId: string, identity: unknown): string {
  return createHash('sha256').update(JSON.stringify([projectId, identity])).digest('hex').slice(0, 24);
}

/** The findings of one report object (`violations`), neural (judge) rows excluded. */
export function findingsOfReport(report: unknown, job: Pick<LabellingJob, 'projectId'>, style: string): Finding[] {
  if (!isRecord(report) || !Array.isArray(report.violations)) throw new Error(`${job.projectId}: report has no violations array`);
  const out: Finding[] = [];
  for (const v of report.violations) {
    if (!isRecord(v)) continue;
    const ruleId = str(v.functionId) ?? '';
    const type = str(v.type) ?? '';
    const file = str(v.filePath) ?? '';
    if (ruleId === '' || file === '' || v.route === 'neuronal' || ruleId === 'FF-N01' || ruleId === 'FF-N02') continue;
    const discriminator = strings(v.discriminator);
    const line = typeof v.line === 'number' ? v.line : undefined;
    const target = str(v.target);
    const id = str(v.id);
    const lines = Array.isArray(v.lines) ? v.lines.filter((n): n is number => typeof n === 'number') : undefined;
    out.push({
      key: findingKey(job.projectId, id ?? [ruleId, file, line, target, discriminator]),
      projectId: job.projectId, style, ruleId, template: templateOf(type, ruleId), type,
      tier: ruleTier(ruleId, style).tier, file,
      ...(line !== undefined && { line }),
      ...(lines !== undefined && lines.length > 0 && { lines }),
      ...(target !== undefined && { target }),
      discriminator, evidence: strings(v.evidence), message: str(v.message) ?? '',
      ...(id !== undefined && { violationId: id }),
    });
  }
  return out;
}

/** Reads the style named in a spec YAML (`architecture.style`) without parsing the rest. */
export function styleOfSpecText(text: string): string {
  const doc = YAML.parse(text) as unknown;
  const arch = isRecord(doc) ? doc.architecture : undefined;
  return isRecord(arch) ? str(arch.style) ?? '' : '';
}

export function loadJobs(file: string): JobsFile {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!isRecord(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.jobs)) throw new Error(`${file}: not a jobs file (schemaVersion 1, jobs[])`);
  const base = path.dirname(path.resolve(file));
  const abs = (p: string): string => path.resolve(base, p);
  const jobs = raw.jobs.map((j, i): LabellingJob => {
    if (!isRecord(j)) throw new Error(`${file}: jobs[${String(i)}] is not an object`);
    const projectId = str(j.projectId);
    const projectRoot = str(j.projectRoot);
    const spec = str(j.spec);
    const report = str(j.report);
    if (projectId === undefined || projectRoot === undefined || spec === undefined || report === undefined) {
      throw new Error(`${file}: jobs[${String(i)}] needs projectId, projectRoot, spec and report`);
    }
    const style = str(j.style);
    const tsconfig = j.tsconfig === 'adr-032' ? 'adr-032' as const : undefined;
    return { projectId, projectRoot: abs(projectRoot), spec: abs(spec), report: abs(report), ...(style !== undefined && { style }), ...(tsconfig !== undefined && { tsconfig }) };
  });
  const kind = raw.kind === 'e1' || raw.kind === 'reference' ? raw.kind : 'custom';
  return { schemaVersion: 1, kind, jobs };
}

export function jobStyle(job: LabellingJob): string {
  return job.style ?? styleOfSpecText(fs.readFileSync(job.spec, 'utf8'));
}

/** Every finding of every job, in job order then report order. */
export function loadFindings(jobs: readonly LabellingJob[]): Finding[] {
  return jobs.flatMap((job) => findingsOfReport(JSON.parse(fs.readFileSync(job.report, 'utf8')) as unknown, job, jobStyle(job)));
}
