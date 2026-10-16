/**
 * v1.3 labeller calibration: DACOS (Nandani et al., MSR 2023; Zenodo 10.5281/zenodo.7570428, CC-BY-4.0).
 *
 * `DACOSMain.sql` is a MySQL 8 dump. Two tables are read from its `INSERT` statements:
 * - `sample(id, designite_id, has_smell, is_class, path_to_file, project_name, sample_constraints, smells)`;
 *   `smells` lists the Designite candidates the sample was shown for (`1` complex method, `2` long parameter list,
 *   `3` multifaceted abstraction: inferred from the data, since the dump's `smell` table is empty);
 * - `annotation(id, iscm, isim, islp, isma, is_smell, sample_id)`: one row per annotation, bits as `_binary ''`
 *   (1) or `_binary '\0'` (0). There is no annotator column, so raters are interchangeable (`annotation-<n>`).
 * An item exists for a task only when the sample was shown as a candidate for it. The code is embedded: `files.zip`
 * holds one `.code` file per sample at `path_to_file` (without the leading `/`), read by `readZipEntries`.
 */
import * as zlib from 'node:zlib';
import type { CalibrationItem, HumanRating } from './types.js';

export type SqlValue = string | number | null | boolean;

/** Every value tuple of every `INSERT INTO \`<table>\` VALUES (...),(...);` statement. */
export function sqlInsertRows(sql: string, table: string): SqlValue[][] {
  const rows: SqlValue[][] = [];
  const head = `INSERT INTO \`${table}\` VALUES `;
  let at = sql.indexOf(head);
  while (at >= 0) {
    let i = at + head.length;
    let row: SqlValue[] | null = null;
    for (;;) {
      const ch = sql[i];
      if (ch === undefined || ch === ';') break;
      if (ch === '(') { row = []; i += 1; continue; }
      if (ch === ')') { if (row !== null) rows.push(row); row = null; i += 1; continue; }
      if (ch === ',' || ch === ' ' || ch === '\n') { i += 1; continue; }
      if (row === null) throw new Error(`sql: unexpected '${ch}' outside a tuple at ${String(i)}`);
      let binary = false;
      if (sql.startsWith('_binary ', i)) { binary = true; i += '_binary '.length; }
      if (sql[i] === '\'') {
        let s = '';
        i += 1;
        while (sql[i] !== '\'') {
          const c = sql[i];
          if (c === undefined) throw new Error('sql: unterminated string');
          if (c === '\\') {
            const n = sql[i + 1] ?? '';
            s += n === '0' ? '\0' : n === 'n' ? '\n' : n === 'r' ? '\r' : n === 'Z' ? '\x1a' : n === 't' ? '\t' : n;
            i += 2;
          } else { s += c; i += 1; }
        }
        i += 1;
        // BIT(1) is dumped as `_binary '<byte>'`: 0x00 (escaped `\0`) is false, 0x01 (raw) is true.
        row.push(binary && s === '\x01' ? true : binary && s === '\0' ? false : s);
        continue;
      }
      const m = /^(NULL|-?\d+(?:\.\d+)?)/.exec(sql.slice(i, i + 32));
      if (m === null) throw new Error(`sql: cannot read a value at ${String(i)}`);
      row.push(m[1] === 'NULL' ? null : Number(m[1]));
      i += (m[1] ?? '').length;
    }
    at = sql.indexOf(head, i);
  }
  return rows;
}

export function bit(v: SqlValue): boolean {
  return v === true || v === 1;
}

export const DACOS_SMELL_TASK: Readonly<Record<string, { task: string; column: number }>> = Object.freeze({
  // column = index in the annotation tuple (id, iscm, isim, islp, isma, is_smell, sample_id)
  '1': { task: 'complex-method', column: 1 },
  '2': { task: 'long-parameter-list', column: 3 },
  '3': { task: 'multifaceted-abstraction', column: 4 },
});

/** `/codesplit_java_method/<p>/<p>/<package>/<Class>/<method>.code` → `Class#method`; class files → `Class`. */
export function dacosUnitName(pathToFile: string, isClass: boolean): string {
  const parts = pathToFile.replace(/\.code$/, '').split('/').filter((p) => p !== '');
  const last = parts[parts.length - 1] ?? '';
  return isClass ? last : `${parts[parts.length - 2] ?? ''}#${last}`;
}

export function parseDacos(sql: string): CalibrationItem[] {
  const samples = new Map<number, SqlValue[]>();
  for (const r of sqlInsertRows(sql, 'sample')) samples.set(Number(r[0]), r);
  const ann = new Map<number, SqlValue[][]>();
  for (const r of sqlInsertRows(sql, 'annotation')) {
    const sid = r[6];
    if (typeof sid !== 'number') continue;
    ann.set(sid, [...(ann.get(sid) ?? []), r]);
  }
  const items: CalibrationItem[] = [];
  for (const sid of [...ann.keys()].sort((a, b) => a - b)) {
    const s = samples.get(sid);
    if (s === undefined) continue;
    const isClass = bit(s[3] ?? null);
    const pathToFile = typeof s[4] === 'string' ? s[4] : '';
    const smells = typeof s[7] === 'string' ? s[7].split(',').map((x) => x.trim()).filter((x) => x !== '') : [];
    const rows = [...(ann.get(sid) ?? [])].sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const code of smells) {
      const t = DACOS_SMELL_TASK[code];
      if (t === undefined || pathToFile === '') continue;
      const ratings: HumanRating[] = rows.map((r, n) => {
        const yes = bit(r[t.column] ?? null);
        return { rater: `annotation-${String(n + 1)}`, original: yes ? '1' : '0', binary: yes ? 'fail' : 'pass' };
      });
      items.push({
        id: `dacos:${String(sid)}:${t.task}`, dataset: 'dacos', task: t.task,
        unitKind: isClass ? 'class' : 'method', unitName: dacosUnitName(pathToFile, isClass), language: 'java',
        archiveEntry: pathToFile.replace(/^\/+/, ''), ratings,
      });
    }
  }
  return items;
}

/**
 * Reads the named entries of a zip archive (central directory, ZIP64 entry counts; stored or deflated entries
 * whose sizes fit 32 bits). Returns the text
 * of each entry found; missing names are absent from the map.
 */
export function readZipEntries(zip: Buffer, names: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>();
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 22 - 0xffff); i -= 1) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: no end-of-central-directory record');
  let count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  // ZIP64 (more than 65,535 entries, as in DACOS files.zip): the locator sits just before the classic record.
  if (eocd >= 20 && zip.readUInt32LE(eocd - 20) === 0x07064b50) {
    const z64 = Number(zip.readBigUInt64LE(eocd - 20 + 8));
    if (zip.readUInt32LE(z64) !== 0x06064b50) throw new Error('zip: bad ZIP64 end-of-central-directory record');
    count = Number(zip.readBigUInt64LE(z64 + 32));
    p = Number(zip.readBigUInt64LE(z64 + 48));
  }
  for (let e = 0; e < count; e += 1) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory entry');
    const method = zip.readUInt16LE(p + 10);
    const csize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (names.has(name)) {
      const lNameLen = zip.readUInt16LE(local + 26);
      const lExtraLen = zip.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = zip.subarray(start, start + csize);
      if (method === 0) out.set(name, data.toString('utf8'));
      else if (method === 8) out.set(name, zlib.inflateRawSync(data).toString('utf8'));
      else throw new Error(`zip: ${name} uses unsupported method ${String(method)}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
