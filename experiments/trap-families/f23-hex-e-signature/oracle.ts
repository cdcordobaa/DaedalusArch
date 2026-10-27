/**
 * F23 oracle (trap family "vendor shape in the port", hexagonal; hand-written with the puzzle, independent of the
 * DaedalusArch instrument). Zero calls. Built on the P3r oracle's rules (experiments/puzzle-03/puzzles/p3r-shipping-quotes),
 * with the e-signature vendor's vocabulary, and with the vendor's vocabulary split in two: what the application sends
 * out (account, envelopes, reminders, errors) and what Inkwell sends in (callbacks: the webhook events, the handler
 * signatures, the webhook checker and its signature error). The split is by the top-level declaration of the vendor
 * typings (src/types/inkwell-sdk.d.ts, module 'inkwell-sdk') that holds the symbol or literal: INBOUND_DECLS below.
 *
 * The core is src/domain/** and src/application/**.
 * SG1 (H5, outbound: what we ask of the vendor stays in the application's language):
 *   (a) no core file refers to a symbol of an outbound vendor declaration (InkwellEnvelopeDraft, InkwellEnvelope,
 *       InkwellRecipient, InkwellError, InkwellClient, or a field of theirs such as envelopeId or recipientStatus);
 *   (b) no core file imports an adapter or the composition root;
 *   (c) no core file declares a property named like an outbound vendor-only field (OUTBOUND_FIELDS), so a renamed
 *       copy of an envelope or recipient type counts;
 *   (d) no core file holds a string equal to an outbound vendor literal ('SIGNER', 'CC', 'SIGNED', 'RATE_LIMITED',
 *       'INVALID_RECIPIENT', ...).
 * SG2 (H5, inbound: a callback reaches the core as the application's own outcome, not as the vendor's event or
 *   handler signature):
 *   (a) no core file refers to a symbol of an inbound vendor declaration (InkwellRecipientDeclinedEvent,
 *       InkwellWebhookEvent, InkwellWebhookHandlers, InkwellWebhooks, InkwellSignatureError, or a field of theirs such
 *       as declineReason or eventType); a core class that `implements InkwellWebhookHandlers` counts here;
 *   (b) no core file declares a method or property named like a vendor callback handler (onRecipientDeclined,
 *       onRecipientViewed, onEnvelopeExpired, onEnvelopeCompleted), so a renamed copy of the handler interface counts;
 *   (c) no core file holds a string equal to an inbound vendor literal ('recipient.declined', 'envelope.expired',
 *       'envelope.completed', 'recipient.viewed').
 * SG3 (H2/H1b, no dependency on the vendor in the core):
 *   (a) no runtime (non-type-only) import of 'inkwell-sdk' in a core file;
 *   (b) no require('inkwell-sdk') or import('inkwell-sdk') in a core file;
 *   (c) no core file names a vendor declaration in a string (for example comparing an error's name with
 *       'InkwellError' or 'InkwellSignatureError'), so a vendor error is not recognised by name.
 * The seed has no planted debt (its signing-allowance precedent is clean), so no file is excepted.
 *
 * Limits: a vendor value passed through `unknown` or `any` and read by computed keys is not seen. OUTBOUND_FIELDS is
 * a fixed list and leaves out names that are plain e-signature or e-mail vocabulary a clean core may choose itself
 * (envelopeId, emailAddress, fullName, role, recipientEmail, expiresInDays, recipients, documents); a renamed copy that
 * keeps only those is not seen. On the inbound side no field name is counted (eventType, occurredAt, declineReason and
 * eventId are ordinary event vocabulary): a renamed copy of an event that drops the handler names and the vendor's
 * literals is not seen, and neither is a core that receives the raw callback body and signature header as strings and
 * hands them to an outbound helper of its own (that moves transport into the core but is not a vendor type). Vendor
 * codes rebuilt from pieces (concatenation, case changes such as 'rate_limited') are not seen. Where the "already
 * finished" and "earlier signing" rules live is not judged. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f23-hex-e-signature/oracle.ts <tree>
 */
import ts from 'typescript';
import { importsOf, lineOf, loadTree, report, resolveRelative, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';

const VENDOR = 'inkwell-sdk';
const PLANTED = new Set<string>();
const isCore = (rel: string): boolean => /^src\/(domain|application)\//.test(rel);
/** Top-level vendor declarations that describe what Inkwell sends in (callbacks). Everything else is outbound. */
const INBOUND_DECLS = new Set([
  'InkwellEventBase', 'InkwellRecipientDeclinedEvent', 'InkwellRecipientViewedEvent', 'InkwellEnvelopeExpiredEvent',
  'InkwellEnvelopeCompletedEvent', 'InkwellWebhookEvent', 'InkwellWebhookHandlers', 'InkwellWebhooks', 'InkwellSignatureError',
]);
/** Field names of the vendor's outbound data model that a core has no reason to share. */
const OUTBOUND_FIELDS = new Set([
  'emailSubject', 'documentBase64', 'routingOrder', 'recipientStatus', 'envelopeStatus', 'sentDateTime', 'recipientEmails',
  'remindedCount', 'remindedDateTime', 'planCode', 'envelopesRemaining', 'billingCycleEndsAt', 'errorCode',
]);
/** The vendor's callback handler names. */
const HANDLER_NAMES = new Set(['onRecipientDeclined', 'onRecipientViewed', 'onEnvelopeExpired', 'onEnvelopeCompleted']);

const treeArg = process.argv[2];
if (treeArg === undefined) {
  process.stderr.write('usage: oracle.ts <tree>\n');
  process.exit(2);
}
const tree = loadTree(treeArg);
const isVendorFile = (f: string): boolean => /\/src\/types\/inkwell-sdk\.d\.ts$/.test(f) || /node_modules\/inkwell-sdk\//.test(f);
/** Name of the top-level declaration (in the vendor module block) that holds this node. */
const topLevelName = (n: ts.Node): string | undefined => {
  let p: ts.Node = n;
  while (p.parent !== undefined && !ts.isModuleBlock(p.parent) && !ts.isSourceFile(p.parent)) p = p.parent;
  const named = p as ts.Node & { name?: ts.Node };
  return named.name !== undefined && ts.isIdentifier(named.name) ? named.name.text : undefined;
};
/** 'in' or 'out' for a symbol declared by the vendor typings; undefined for any other symbol. */
const vendorSide = (s: ts.Symbol | undefined): 'in' | 'out' | undefined => {
  const sym = s !== undefined && (s.flags & ts.SymbolFlags.Alias) !== 0 ? tree.checker.getAliasedSymbol(s) : s;
  const decl = (sym?.declarations ?? []).find((d) => isVendorFile(d.getSourceFile().fileName));
  if (decl === undefined) return undefined;
  return INBOUND_DECLS.has(topLevelName(decl) ?? '') ? 'in' : 'out';
};

// The vendor vocabulary: declared names, and literal-type values by side, read from the typings in the tree.
const vendorNames = new Set<string>();
const literals = { in: new Set<string>(), out: new Set<string>() };
for (const sf of tree.program.getSourceFiles().filter((f) => isVendorFile(f.fileName))) {
  const visit = (n: ts.Node): void => {
    if ((ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)) && n.name !== undefined) vendorNames.add(n.name.text);
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) literals[INBOUND_DECLS.has(topLevelName(n) ?? '') ? 'in' : 'out'].add(n.literal.text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const sideOfLiteral = (text: string): 'in' | 'out' | undefined => (literals.in.has(text) ? 'in' : literals.out.has(text) ? 'out' : undefined);

const sg1: string[] = [];
const sg2: string[] = [];
const sg3: string[] = [];
for (const rel of tree.files.filter((f) => isCore(f) && !PLANTED.has(f))) {
  const sf = tree.source(rel);
  for (const imp of importsOf(sf)) {
    const target = resolveRelative(rel, imp.spec);
    if (target !== null && /^src\/(adapters|config)\//.test(target)) sg1.push(`${rel}:${String(imp.line)} imports ${imp.spec} (an adapter or the composition root)`);
  }
  const seen = new Set<string>();
  const add = (list: string[], line: number, what: string): void => {
    const key = `${String(line)}|${what}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(`${rel}:${String(line)} ${what}`);
  };
  const bySide = (side: 'in' | 'out'): string[] => (side === 'in' ? sg2 : sg1);
  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n)) {
      if (ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === VENDOR) {
        const c = n.importClause;
        const allTypes = c !== undefined && (c.isTypeOnly || (c.name === undefined && c.namedBindings !== undefined && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.every((e) => e.isTypeOnly)));
        if (!allTypes) add(sg3, lineOf(sf, n), `runtime import of ${VENDOR}`);
      }
      return;
    }
    if (ts.isCallExpression(n) && n.arguments.length > 0 && ts.isStringLiteral(n.arguments[0]!) && n.arguments[0].text === VENDOR
      && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
      add(sg3, lineOf(sf, n), `dynamic load of ${VENDOR}`);
    }
    if (ts.isIdentifier(n)) {
      const side = vendorSide(tree.checker.getSymbolAtLocation(n));
      if (side !== undefined) add(bySide(side), lineOf(sf, n), `${side === 'in' ? 'inbound' : 'outbound'} vendor symbol ${n.text}`);
    }
    if ((ts.isPropertySignature(n) || ts.isPropertyDeclaration(n) || ts.isMethodSignature(n) || ts.isMethodDeclaration(n)) && n.name !== undefined && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) {
      if (OUTBOUND_FIELDS.has(n.name.text)) add(sg1, lineOf(sf, n), `declares the vendor field name ${n.name.text}`);
      if (HANDLER_NAMES.has(n.name.text)) add(sg2, lineOf(sf, n), `declares the vendor callback handler ${n.name.text}`);
    }
    if (ts.isStringLiteralLike(n) && !ts.isImportDeclaration(n.parent) && !ts.isLiteralTypeNode(n.parent)) {
      const side = sideOfLiteral(n.text);
      if (side !== undefined) add(bySide(side), lineOf(sf, n), `vendor code '${n.text}'`);
      const named = [...vendorNames].find((v) => n.text.includes(v));
      if (named !== undefined) add(sg3, lineOf(sf, n), `names the vendor declaration ${named} in a string`);
    }
    if (ts.isLiteralTypeNode(n) && ts.isStringLiteral(n.literal)) {
      const side = sideOfLiteral(n.literal.text);
      if (side !== undefined) add(bySide(side), lineOf(sf, n), `vendor code '${n.literal.text}' in a type`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

const verdicts: SubGoalVerdict[] = [
  { id: 'SG1', family: 'H5', pass: sg1.length === 0, evidence: sg1 },
  { id: 'SG2', family: 'H5-in', pass: sg2.length === 0, evidence: sg2 },
  { id: 'SG3', family: 'H2/H1b', pass: sg3.length === 0, evidence: sg3 },
];
process.exitCode = report('f23-hex-e-signature', treeArg, verdicts);
