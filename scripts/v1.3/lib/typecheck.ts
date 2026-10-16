/**
 * Type-checks a materialised reference-project variant with the TypeScript compiler API (no emit), using the
 * project's own tsconfig.json. Library files (`lib.*.d.ts`) are parsed once and shared across calls.
 */
import * as path from 'node:path';
import ts from 'typescript';

const libCache = new Map<string, ts.SourceFile>();

/** Diagnostics of the project at `projectDir` (empty when it compiles), as `file: message` strings. */
export function typecheckProject(projectDir: string): string[] {
  const configPath = path.join(projectDir, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (p) => ts.sys.readFile(p));
  if (config.error !== undefined) return [ts.flattenDiagnosticMessageText(config.error.messageText, '\n')];
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, projectDir);
  const host = ts.createCompilerHost(parsed.options);
  const libDir = path.dirname(ts.getDefaultLibFilePath(parsed.options));
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    if (path.dirname(fileName) !== libDir) return getSourceFile(fileName, languageVersion, onError, shouldCreate);
    const key = `${String(typeof languageVersion === 'object' ? languageVersion.languageVersion : languageVersion)}|${fileName}`;
    let sf = libCache.get(key);
    if (sf === undefined) {
      sf = getSourceFile(fileName, languageVersion, onError, shouldCreate);
      if (sf !== undefined) libCache.set(key, sf);
    }
    return sf;
  };
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  return diagnostics.map((d) => {
    const where = d.file ? `${path.relative(projectDir, d.file.fileName).split(path.sep).join('/')}: ` : '';
    return where + ts.flattenDiagnosticMessageText(d.messageText, '\n');
  });
}
