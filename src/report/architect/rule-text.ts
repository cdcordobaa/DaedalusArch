/**
 * Plain-language text of the architect HTML report (`evaluate --html`). Rule ids stay out of the visible text: the
 * report shows them in a tooltip only. This is display text; it does not change any rule, template or tier.
 */

export interface PlainRule {
  /** Short title, e.g. "Dependencies point inward". */
  readonly title: string;
  /** One sentence: what the rule asks of the code. */
  readonly says: string;
}

/** Display tiers. `defining` = v1.3 blocking, `warning` = v1.3 advisory, `not-counted` = a part reported N/A. */
export type DisplayTier = 'defining' | 'warning' | 'not-counted';

export const TIER_LABELS: Readonly<Record<DisplayTier, string>> = {
  defining: 'defining rule (can fail)',
  warning: 'warning (never fails)',
  'not-counted': 'not counted (not applicable)',
};

export const TIER_EXPLANATIONS: Readonly<Record<DisplayTier, string>> = {
  defining: 'A defining rule states what the architecture is. One broken defining rule fails the verdict.',
  warning: 'A warning is a metric, proxy or convention. It is reported for information and never fails the verdict.',
  'not-counted': 'This part of the rule cannot be measured reliably yet, so it is shown but does not count.',
};

const RULES: Readonly<Record<string, PlainRule>> = {
  'FF-S01': { title: 'Dependencies point inward', says: 'A file may only depend on layers allowed for it. An inner layer must never import from an outer layer.' },
  'FF-S02': { title: 'No circular dependencies', says: 'Files must not import each other in a loop.' },
  'FF-S03': { title: 'No skipping layers', says: 'A layer should use the layer next to it and not jump over it.' },
  'FF-S04': { title: 'The core does not depend outward', says: 'The domain (core) layer must not import from any outer layer.' },
  'FF-P01': { title: 'The domain is framework-free', says: 'Domain code must not import frameworks or infrastructure libraries.' },
  'FF-P02': { title: 'Depend on abstractions', says: 'Classes should receive their dependencies as interfaces rather than concrete classes.' },
  'FF-P03': { title: 'Repository contracts live in the core', says: 'Each repository interface belongs to the domain and its implementation to infrastructure.' },
  'FF-P04': { title: 'Use cases stay isolated', says: 'A use case should not depend directly on infrastructure or on other use cases.' },
  'FF-P05': { title: 'Controllers do not touch entities', says: 'Controllers should go through use cases instead of using domain entities directly.' },
  'FF-P06': { title: 'Domain state stays pure', says: 'Domain objects must not receive or hold infrastructure objects.' },
  'FF-C01': { title: 'The domain is stable', says: 'The domain layer should have few outgoing dependencies.' },
  'FF-C02': { title: 'Limited fan-out', says: 'A file should not import too many other modules.' },
  'FF-C03': { title: 'Instability fits the role', says: 'How much a module depends on others, compared with how much others depend on it, should fit its layer.' },
  'FF-C04': { title: 'No orphan files', says: 'Every file should be used by some other file.' },
  'FF-C05': { title: 'Limited fan-in', says: 'A single file should not be depended on by too many others.' },
  'FF-C06': { title: 'Enough abstractions', says: 'The share of interfaces and abstract classes should reach the threshold.' },
  'FF-SO01': { title: 'One responsibility per class', says: 'A class should not expose too many public methods.' },
  'FF-SO02': { title: 'Small interfaces', says: 'An interface should not declare too many methods.' },
  'FF-SO03': { title: 'Shallow inheritance', says: 'Class hierarchies should not be too deep.' },
  'FF-CV01': { title: 'Naming conventions', says: 'File names should follow the naming pattern of their layer.' },
  'FF-CV02': { title: 'Service naming', says: 'Service files should follow the service naming pattern.' },
  'FF-CV03': { title: 'Repository naming', says: 'Repository files should follow the repository naming pattern.' },
  'FF-CV04': { title: 'Controller naming', says: 'Controller files should follow the controller naming pattern.' },
  'FF-CV05': { title: 'Every file has a test', says: 'Each source file should have a matching test file.' },
  'FF-CV06': { title: 'Index files only re-export', says: 'Index (barrel) files should re-export and hold no logic.' },
  'FF-N01': { title: 'Architectural integrity (AI review)', says: 'An AI reviewer judged whether the code keeps the architecture intact.' },
  'FF-N02': { title: 'Intent alignment (AI review)', says: 'An AI reviewer judged whether the code follows the stated design intent.' },
  'FF-DS01': { title: 'Every file is in a bounded context', says: 'Each source file should lie inside a declared bounded context.' },
  'FF-DS02': { title: 'Contexts talk through their public API', says: 'A bounded context may only be used through its public API or anti-corruption layer.' },
  'FF-DT01': { title: 'Only aggregate roots are referenced', says: 'Code outside an aggregate may only reference its root, not its inner entities.' },
  'FF-DT02': { title: 'Repositories only for aggregate roots', says: 'Repositories should exist only for aggregate roots.' },
  'FF-DT03': { title: 'Value objects are immutable', says: 'Value objects must not be changed after they are created.' },
  'FF-DT04': { title: 'The domain is framework-free', says: 'Domain code must not import frameworks or infrastructure libraries.' },
  'FF-DT05': { title: 'Domain events live in the domain', says: 'Domain events should be defined in the domain layer.' },
  'FF-DT06': { title: 'Application services stay thin', says: 'Application services should coordinate and hold no business rules.' },
};

/** "dependency-direction" → "Dependency direction". */
export function humanizeName(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words === '' ? 'Unnamed rule' : words.charAt(0).toUpperCase() + words.slice(1);
}

/** The plain text of a rule; unknown ids fall back to the spec's rule name and the violation-type explanation. */
export function plainRule(ruleId: string, specName: string | undefined, fallbackSays: string): PlainRule {
  return RULES[ruleId] ?? { title: humanizeName(specName ?? 'custom rule'), says: fallbackSays };
}

/** Removes rule ids (`FF-S01`, `FF-DT03`, …) from visible text; ids are shown in tooltips only. */
export function withoutRuleIds(text: string): string {
  return text.replace(/\s*\(?\bFF-[A-Z]+\d+\b\)?:?\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
