/**
 * v1.5 instrument (2026-10-29, `INSTRUMENT_ID` in `rule-set.ts`): the messages an agent reads for every rule the hub
 * delivers, in the style of `consistency.ts` (R-D4, R-XCTX): the rule in plain words (`ruleText`), why this code breaks
 * it, naming the code (`why`: file:line and the symbols), and a fix. Messages only: the rules themselves are the Cypher
 * files (`rules/*.cypher`) and the frozen v1.4 file rules; nothing here decides whether a rule fires.
 *
 * Each builder reads the finding's subject and evidence (the Cypher `RETURN` columns); when the evidence does not have
 * the expected shape, the message falls back to the evidence verbatim and the rule's own Cypher header (`rule:`,
 * `fix:`), so a rule added to the rule list later is delivered with a usable message before it gets a builder here.
 * No message names a study task or its domain.
 */
import type { FileViolation } from '../mcp-server/types.js';
import type { Finding, Rule } from './graph.js';

export interface RuleMessage { readonly ruleText: string; readonly why: string; readonly fix: string }

/** The short label shown in brackets on a finding's first line. */
export const RULE_LABELS: Readonly<Record<string, string>> = {
  'R-D4': 'one aggregate per command',
  'R-XCTX': 'cross-context write',
  'R-D4+R-XCTX': 'one aggregate per command; cross-context write',
  'R-D4R': 'repository saves several aggregates',
  'R-D3': 'aggregate calculation outside the aggregate',
  'R-D5': 'aggregate rule outside the aggregate',
  'R-D5S': 'declared invariant outside its owner',
  'R-D9': 'contract exposes an entity',
  'R-LOCK': 'lock in place of the aggregate boundary',
  'R-REF': 'aggregate holds another aggregate',
  'R-RTX': 'remote call inside a transaction',
  'R-PURE': 'technology in the domain',
  'R-H5': 'infrastructure in a port',
  'R-INJ': 'concrete adapter injected',
  'R-AXA': 'adapter imports adapter',
  'R-TRANSPORT': 'transport concept in the core',
  'R-LOCATOR': 'service locator',
  'R-COREIO': 'core I/O without a port',
  'R-ENTITY-OUT': 'entity as transport shape',
  'R-ADAPTER-RULE': 'business rule in an adapter',
  'R-MIRROR': 'vendor vocabulary in the core',
  'R-MIRROR2': 'vendor term in the core',
  'R-MIRROR-SEM': 'vendor value set copied into the core',
  'FF-S01': 'FF-S01 dependency-direction',
  'FF-S02': 'FF-S02 no-cyclic-deps',
  'FF-S03': 'FF-S03 no-layer-skip',
  'FF-S04': 'FF-S04 core-isolation',
  'FF-P01': 'FF-P01 domain-purity',
  'FF-P02': 'FF-P02 port-dependency-inversion',
  'FF-P03': 'FF-P03 port-adapter-pattern',
  'FF-DS02': 'FF-DS02 context-isolation',
  'FF-DT04': 'FF-DT04 domain-purity',
};

export const labelOf = (rule: string): string => RULE_LABELS[rule] ?? rule;

/** The rule in plain words, per rule id (v1.5 Cypher rules and the frozen file rules the hub delivers). */
export const RULE_TEXT: Readonly<Record<string, string>> = {
  'R-D4': 'One command changes and saves one aggregate instance. Any other aggregate (another instance of the same type, or another type) is updated afterwards by a handler of a domain event that the first aggregate records.',
  'R-XCTX': 'A bounded context changes only its own aggregates. Another context\'s aggregate changes when that context reacts to an event it subscribes to, not inside this command.',
  'R-D4R': 'A repository saves one aggregate per call, so each save stays inside one consistency boundary. Several aggregates change in separate saves, linked by domain events.',
  'R-D3': 'A calculation over an aggregate\'s own state that sets its state belongs to the aggregate (a method or a value object), so the rule lives in one place.',
  'R-D5': 'A rule that protects an aggregate\'s state is checked inside the aggregate (its method or a value object it takes), so no caller can skip it or keep a second copy of it.',
  'R-D5S': 'Each invariant the architecture declares is enforced by the aggregate it names as owner, inside that aggregate; other code calls the aggregate and does not decide the invariant itself.',
  'R-D9': 'A context\'s published contract uses its own types. It never is, wraps or mirrors a domain entity or aggregate, so the model can change without breaking consumers.',
  'R-LOCK': 'Concurrent changes to the same data are kept consistent by the aggregate that owns the rule (its version and its repository), not by an in-process lock around the writes, which does not hold across processes.',
  'R-REF': 'An aggregate refers to another aggregate by its id only, so each can be loaded, changed and saved on its own.',
  'R-RTX': 'A transaction or lock covers local state only. Calls to remote systems run before it or after it, so a slow or failing remote never holds the lock.',
  'R-PURE': 'Domain code depends on nothing technical (database, HTTP, mail, file system, messaging, web framework). It reaches the outside world only through ports that adapters implement.',
  'R-H5': 'A port states what the application needs in its own terms. Vendor types, adapter types and locking or transaction mechanisms stay inside the adapter that implements it.',
  'R-INJ': 'Application code depends on ports (interfaces), never on adapter classes. Only the composition root knows and constructs the adapters.',
  'R-AXA': 'Adapters meet only through the application\'s ports: an inbound adapter calls a use case, an outbound adapter implements a port, and the composition root wires them. One adapter does not import another.',
  'R-TRANSPORT': 'Domain and application code speak in their own terms: they report domain errors and results. Only an adapter turns them into HTTP statuses, HTTP errors or storage errors.',
  'R-LOCATOR': 'A class receives its collaborators through its constructor, wired once in the composition root. It does not ask a container, registry or static accessor for them at run time.',
  'R-COREIO': 'Domain and application code reach the outside world (network, files, environment, database or cache clients, child processes) only through ports that adapters implement, so the core runs and is tested without that world.',
  'R-ENTITY-OUT': 'An inbound adapter reads and writes its own request and response shapes (DTOs). It does not use a domain entity as its request type or response body, so the domain can change without changing the API.',
  'R-ADAPTER-RULE': 'Adapters translate between a technology and the core. A decision that accepts, rejects, prices or changes domain state belongs to the domain or a use case, not to an adapter.',
  'R-MIRROR': 'The core uses its own vocabulary. An outbound adapter translates a vendor\'s codes and field names into it, so a vendor change stays inside the adapter.',
  'R-MIRROR2': 'Domain, application and port code use only terms the domain owns. A vendor SDK\'s codes, error names, field and method names stay in the outbound adapter, which translates them into the core\'s terms, so a vendor change stays inside the adapter.',
  'R-MIRROR-SEM': 'The core\'s values express distinctions the domain owns. An outbound adapter translates a vendor\'s values into them, so a vendor that adds, splits or renames a value changes the adapter, not the core\'s decisions.',
  'FF-S01': 'Each layer imports only the layers the architecture allows it to depend on, so dependencies point toward the core.',
  'FF-S02': 'Modules do not import each other in a cycle.',
  'FF-S03': 'An import follows an allowed edge between two layers. A layer does not reach a layer it has no edge to (for example an inbound adapter importing an outbound adapter).',
  'FF-S04': 'The core (domain and application, ports included) imports nothing from the adapters or the composition root.',
  'FF-P01': 'Domain code imports no framework, database or other technical package.',
  'FF-P02': 'Use cases depend on ports (interfaces) and receive their implementations from outside; they do not depend on or construct adapter classes.',
  'FF-P03': 'An outbound adapter implements a port that the core declares, and the core depends on that port.',
  'FF-DS02': 'A bounded context uses another context only through that context\'s published interface, never its internal files.',
  'FF-DT04': 'Domain code imports no framework, database, validation or other technical package.',
};

const stripCitation = (s: string): string => s.replace(/\s*\([^()]*\)\.?\s*$/, '.').replace(/\.\.$/, '.');
const at = (f: Pick<Finding, 'file' | 'line'>): string => `${f.file}:${f.line === null ? '?' : String(f.line)}`;
const sentence = (s: string): string => (/[.!?]$/.test(s) ? s : `${s}.`);

type Builder = (f: Finding) => { why: string; fix: string } | null;

/** Per-rule builders; `null` (the evidence did not have the expected shape) falls back to the generic message. */
const BUILDERS: Readonly<Record<string, Builder>> = {
  'R-AXA': (f) => {
    const m = /^(.+?) imports (.+?) \((.+?)\), another adapter$/.exec(f.evidence);
    if (m === null) return null;
    const [, from, target, toPkg] = m as unknown as [string, string, string, string];
    return {
      why: `${f.file} (${at(f)}), in adapter package ${from}, imports ${target}, a file of the adapter package ${toPkg}.`,
      fix: `Remove the import of ${target} from ${f.file}. If ${f.file} needs data or an action from it, call a use case through an in-port (inbound adapter) or depend on the port that ${target} implements (outbound), and let the composition root connect the adapters. If ${target} is only a helper (shaping a reply, translating an error), give ${from} its own copy instead of reaching into ${toPkg}.`,
    };
  },
  'R-INJ': (f) => {
    const m = /^(.+?) depends on (.+?) \((.+?), (.+?)\)$/.exec(f.evidence);
    if (m === null) return null;
    const [, cls, adapter, adapterFile, form] = m as unknown as [string, string, string, string, string];
    return {
      why: `${cls} (${at(f)}) depends on the adapter class ${adapter} (${adapterFile}) through ${form === 'new' ? 'a `new` expression' : `its ${form}`}.`,
      fix: `Type ${cls}'s dependency with the port that ${adapter} implements (declare that port in the application if there is none), receive it through the constructor, and construct ${adapter} only in the composition root.`,
    };
  },
  'R-H5': (f) => {
    const m = /^([a-z-]+): (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, form, detail] = m as unknown as [string, string, string];
    const what = form === 'vendor-type' ? 'a vendor type' : form === 'adapter-type' ? 'an adapter type' : form === 'scope-callback' ? 'a lock or transaction callback' : form;
    return {
      why: `The port method ${f.subject} (${at(f)}) carries ${what} in its signature: ${detail}.`,
      fix: `State what ${f.subject} needs in the application's own terms (plain values and domain types, one operation for the whole need), and keep ${detail} inside the adapter that implements the port.`,
    };
  },
  'R-TRANSPORT': (f) => {
    const m = /^(\S+) code uses a transport concept: (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, role, detail] = m as unknown as [string, string, string];
    return {
      why: `${f.file} (${at(f)}), ${role} code, uses a transport concept: ${detail}.`,
      fix: `Replace ${detail} with a domain error or result in ${f.file}, and translate it into the HTTP status or storage error in the adapter that calls or implements this code.`,
    };
  },
  'R-LOCATOR': (f) => {
    const m = /^(\S+) code obtains a dependency at run time: (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, role, detail] = m as unknown as [string, string, string];
    return {
      why: `${f.file} (${at(f)}), ${role} code, obtains a collaborator at run time instead of receiving it: ${detail}.`,
      fix: `Add the collaborator as a constructor parameter typed by its port, remove ${detail}, and resolve or construct the implementation only in the composition root.`,
    };
  },
  'R-COREIO': (f) => {
    const m = /^(\S+) code performs I\/O without a port: (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, role, detail] = m as unknown as [string, string, string];
    return {
      why: `${f.file} (${at(f)}), ${role} code, performs I/O directly: ${detail}.`,
      fix: `Declare an out-port for what ${f.file} needs from ${detail} (in the core's terms), call that port from the use case, and implement it in an outbound adapter wired by the composition root.`,
    };
  },
  'R-ENTITY-OUT': (f) => {
    const m = /^(.+?) (.+?) the domain entity (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, handler, form, entity] = m as unknown as [string, string, string, string];
    return {
      why: `The inbound handler ${handler} (${at(f)}) ${form} the domain entity ${entity}.`,
      fix: `Define a request or response DTO in the adapter with only the fields the caller needs, and map between it and ${entity} in ${handler}.`,
    };
  },
  'R-ADAPTER-RULE': (f) => {
    const m = /^(.+?) decides on domain state \((.*)\) and (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, unit, reads, effect] = m as unknown as [string, string, string, string];
    return {
      why: `${unit} (${at(f)}), adapter code, decides on domain state (${reads}) and ${effect}.`,
      fix: `Move this decision into the entity, a domain service or the use case that ${unit} calls, and let ${unit} only translate the outcome (for example a domain error into a status).`,
    };
  },
  'R-MIRROR': (f) => {
    const m = /^(\S+) type (.+?) mirrors (.+?) of (.+?): (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, role, core, vendor, mod, detail] = m as unknown as [string, string, string, string, string, string];
    return {
      why: `The ${role} type ${core} (${at(f)}) re-declares ${vendor} of ${mod}: ${detail}.`,
      fix: `Name ${core}'s values in the core's own terms, and map ${mod}'s codes or fields to them in the outbound adapter that uses ${mod}.`,
    };
  },
  'R-MIRROR2': (f) => {
    const m = /^\[([a-z-]+)\] \S+:\d+ (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, shape, detail] = m as unknown as [string, string, string];
    const src = /\(([^()]+?) of (\S+?)\)/.exec(detail) ?? / ([A-Za-z0-9_$]+)(?:\.[A-Za-z0-9_$]+)? of (\S+?)(?::|$)/.exec(detail);
    const mod = src?.[2] ?? 'the vendor SDK';
    const term = shape === 'field-set' ? (/: (.+)$/.exec(detail)?.[1] ?? f.subject)
      : shape === 'field' ? (/ \S+?\.(\S+) of \S+$/.exec(detail)?.[1] ?? f.subject)
        : (/'([^']+)'/.exec(detail)?.[1] ?? f.subject);
    const fix = shape === 'field-set'
      ? `Give ${f.subject} the fields the core needs, named in the domain's terms (not the vendor's ${term}), and map ${mod}'s fields to them in the outbound adapter that uses ${mod}.`
      : shape === 'field'
        ? `Rename ${f.subject} to a term the domain owns (not ${term}), and translate between the two in the outbound adapter that uses ${mod}.`
        : shape === 'error'
          ? `Translate at the adapter: catch ${mod}'s error there and raise or return a core error the domain owns (for example a named refusal or a provider outage), so the core never compares '${term}'.`
          : `Translate at the adapter into a core term the domain owns: map ${mod}'s '${term}' to a value of a core type in the outbound adapter, and let the core compare only its own terms.`;
    return { why: `${at(f)}: ${detail} (the vendor term ${shape === 'field-set' ? `set ${term}` : `'${term}'`}, from ${mod}).`, fix };
  },
  'R-MIRROR-SEM': (f) => {
    const m = /^\[value-set\] \S+:\d+ (\S+) mirrors (\S+) of (\S+) \((.+?); mapped at (\S+?)(, one to one)?\) and the core branches on it at (\S+) \| model fact: (.*)$/.exec(f.evidence);
    if (m === null) return null;
    const [, core, vendor, mod, pairs, mapAt, , branch, reason] = m as unknown as [string, string, string, string, string, string, string | undefined, string, string];
    return {
      why: `${core} (${at(f)}) renames ${vendor} of ${mod} value for value (${pairs}; the adapter maps it at ${mapAt}), and the core decides on it at ${branch}: the core's distinctions are the vendor's. ${reason}`,
      fix: `Give ${core} the distinctions the domain needs (the ones its spec and rules name, often fewer than ${vendor}'s), map ${mod}'s values onto them in the adapter at ${mapAt.split(':')[0]}, and let the core decide only on its own members.`,
    };
  },
  'R-PURE': (f) => {
    const m = /^domain code imports (.+?) \((.+)\)$/.exec(f.evidence);
    if (m === null) return null;
    const [, mod, category] = m as unknown as [string, string, string];
    return {
      why: `${f.file} (${at(f)}), domain code, imports ${mod} (${category}).`,
      fix: `Remove the import of ${mod} from ${f.file}: declare a port for what the domain needs, call it from the application service, and implement it in an adapter that uses ${mod}.`,
    };
  },
  'R-D4R': (f) => {
    const m = /^(.+?) persists (?:a collection of |two or more )(.+?) aggregates in one call$/.exec(f.evidence);
    if (m === null) return null;
    const [, method, root] = m as unknown as [string, string, string];
    return {
      why: `The repository method ${method} (${at(f)}) saves ${f.evidence.includes('a collection of') ? 'a collection of' : 'two or more'} ${root} aggregates in one call.`,
      fix: `Replace ${method} with a method that saves one ${root}; let each command save the aggregate it changes, and update the others in handlers of the domain events it records.`,
    };
  },
  'R-RTX': (f) => {
    const m = /^inside (.+?)\(\.\.\.\) reaches (.+?) at (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, scope, mod, site] = m as unknown as [string, string, string, string];
    return {
      why: `${f.subject} (${at(f)}) calls ${mod} (at ${site}) inside ${scope}(...), so the remote call runs while the transaction or lock is held.`,
      fix: `Call ${mod} outside ${scope}(...): before it, or after commit through an event or outbox, and pass only its result into the scoped callback.`,
    };
  },
  'R-D5': (f) => {
    const m = /^if \((.*)\) throws: (.*?)( \[the aggregate also checks this: duplicated\])?$/.exec(f.evidence);
    if (m === null) return null;
    const [, cond, reason, dup] = m as unknown as [string, string, string, string | undefined];
    return {
      why: `${f.subject} (${at(f)}) decides a rule about an aggregate's state itself: if (${cond}) it throws ${reason}${dup !== undefined ? ', and the aggregate also checks it (two copies of the rule)' : ''}.`,
      fix: `Move the check (${cond}) into the aggregate method that changes this state, or into a value object it takes, and let ${f.subject} call that method; keep one copy of the rule.`,
    };
  },
  'R-D5S': (f) => {
    const m = /^checks declared invariant (.+?) \((.*)\) outside its owner (.+?): if \((.*)\)$/.exec(f.evidence);
    if (m === null) return null;
    const [, id, statement, owner, cond] = m as unknown as [string, string, string, string, string];
    return {
      why: `${f.subject} (${at(f)}) checks the declared invariant ${id} ("${statement}") itself, with if (${cond}), outside its owner ${owner}.`,
      fix: `Move the check of ${id} into ${owner}, the owner the architecture declares (for a rule over a set, the aggregate that holds the set), and let ${f.subject} call it.`,
    };
  },
  'R-LOCK': (f) => {
    const m = /^calls (.+?) around writes to (.+)$/.exec(f.evidence);
    if (m === null) return null;
    const [, lock, roots] = m as unknown as [string, string, string];
    return {
      why: `${f.subject} (${at(f)}) calls ${lock} around its writes to ${roots}, so an in-process lock stands in for the aggregate's consistency boundary.`,
      fix: `Remove ${lock}: give the rule it protects to the aggregate that holds that data, and let its repository reject conflicting writes (an optimistic version check).`,
    };
  },
  'R-D3': (f) => {
    const m = /^computes (.+) from the state of (.+?) and hands it back to it$/.exec(f.evidence);
    if (m === null) return null;
    const [, expr, root] = m as unknown as [string, string, string];
    return {
      why: `${f.subject} (${at(f)}) computes ${expr} from the state of ${root} and sets the result back on it.`,
      fix: `Move the calculation into a method of ${root} (or a value object) that takes the inputs and sets the result itself, and let ${f.subject} call that method.`,
    };
  },
  'R-D9': (f) => {
    const m = /^(.+?) exposes (.+?) \((.+?)\) via (.+)$/.exec(f.evidence);
    if (m === null) return { why: `The published contract ${f.subject} (${at(f)}) ${f.evidence.replace(/^\S+ /, '')}.`, fix: `Give ${f.subject} its own fields, only those its consumers need, and map the entity to it in the application layer or the published module.` };
    const [, contract, entity, entityFile, via] = m as unknown as [string, string, string, string, string];
    return {
      why: `The published contract ${contract} (${at(f)}) exposes the domain entity ${entity} (${entityFile}) through ${via}.`,
      fix: `Declare ${contract} with only the fields its consumers need, map ${entity} to it in the application layer (or the published module), and do not return or re-export ${entity}.`,
    };
  },
  'R-REF': (f) => {
    const m = /^(.+?) holds a (.+?) object; it should hold its id$/.exec(f.evidence);
    if (m === null) return null;
    const [, member, other] = m as unknown as [string, string, string];
    return {
      why: `${member} (${at(f)}) holds a ${other} object, another aggregate, instead of its id.`,
      fix: `Replace ${member} with ${other}'s id (or a value object of it), and load ${other} through its repository when it is needed.`,
    };
  },
};

/** The message of a v1.5 Cypher finding (any rule but the R-D4/R-XCTX pair, which `consistency.ts` describes). */
export function cypherMessage(f: Finding, rule: Pick<Rule, 'rule' | 'fix'> | undefined): RuleMessage {
  const built = BUILDERS[f.rule]?.(f) ?? null;
  const ruleText = RULE_TEXT[f.rule] ?? (rule !== undefined && rule.rule !== '' ? stripCitation(rule.rule) : f.rule);
  if (built !== null) return { ruleText, ...built };
  const who = f.subject === f.file ? f.file : `${f.subject} in ${f.file}`;
  return { ruleText, why: sentence(`${who} (${at(f)}): ${f.evidence}`), fix: rule !== undefined && rule.fix !== '' ? rule.fix : 'Change this code so that it follows the rule above.' };
}

/** The message of a frozen file-rule finding (`check_diff`, blocking tier): plain rule text, the code, the frozen fix. */
export function frozenMessage(v: Pick<FileViolation, 'ruleId' | 'construct' | 'subject' | 'reason' | 'fix' | 'file' | 'line'>): RuleMessage {
  const ruleText = RULE_TEXT[v.ruleId] ?? sentence(v.construct);
  return { ruleText, why: sentence(`${v.file}:${String(v.line)}, ${v.subject}: ${v.reason}`), fix: v.fix };
}
