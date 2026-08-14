#!/usr/bin/env node
/*
 * Masar RTC — Supabase contract extractor.
 *
 * Single source of truth for "what the client asks the database for" versus
 * "what supabase/migrations/*.sql actually ships". Used by:
 *   - tests/test-rpc-contract.js  (fails CI on drift)
 *   - npm run rpc:report          (human-readable Markdown report)
 *
 * It is deliberately dependency-free and purely static: no database is
 * contacted, so it runs in CI without any Supabase credentials.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

/* Client files that are shipped to browsers/devices. supabase/*.sql helper
   scripts and supabase_schema.sql are NOT authoritative: only migrations are.
   tests/ is excluded on purpose: it contains mock clients and documentation
   strings whose fake RPC names are not real calls against the database. */
const CLIENT_GLOBS = ['app.js', 'js'];
const CLIENT_EXT = new Set(['.js', '.html']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'assets', 'android', 'ios', 'build']);

function walk(target, out) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return out;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (CLIENT_EXT.has(path.extname(abs))) out.push(target);
    return out;
  }
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(target, entry.name), out);
    } else if (CLIENT_EXT.has(path.extname(entry.name))) {
      out.push(path.join(target, entry.name));
    }
  }
  return out;
}

function clientFiles() {
  const out = [];
  for (const g of CLIENT_GLOBS) walk(g, out);
  return out.sort();
}

/* ── 1. Extract every supabase .rpc('name', { args }) call site ───────────── */

/* Reads the balanced argument list that follows `.rpc(`. Regex alone cannot
   handle nested object/array literals, so we scan with a small bracket counter. */
function readBalanced(src, openIndex) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [];
  let i = openIndex;
  let inStr = null;
  let escaped = false;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (pairs[ch]) { stack.push(pairs[ch]); continue; }
    if (ch === ')' || ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return { end: i, text: src.slice(openIndex + 1, i) };
    }
  }
  return null;
}

/* Splits a call argument list on top-level commas only. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let inStr = null;
  let escaped = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length);
}

/* Collects the top-level keys of an object literal `{ p_a: x, p_b: y }`. */
function objectKeys(literal) {
  const body = literal.trim();
  if (!body.startsWith('{')) return null; // spread/variable — unknown at build time
  const inner = body.slice(1, -1);
  const keys = [];
  for (const chunk of splitTopLevel(inner)) {
    const m = chunk.match(/^(?:\/\*[\s\S]*?\*\/\s*)?(?:'([^']+)'|"([^"]+)"|\[([^\]]+)\]|([A-Za-z_$][\w$]*))\s*:/);
    if (m) { keys.push(m[1] || m[2] || m[3] || m[4]); continue; }
    if (/^\.\.\./.test(chunk)) return null;      // spread — cannot resolve statically
    const shorthand = chunk.match(/^([A-Za-z_$][\w$]*)$/);
    if (shorthand) keys.push(shorthand[1]);
  }
  return keys;
}

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

function extractRpcCalls() {
  /* `.rpc(` on a Supabase client, plus this repo's own `rpc(name, args)`
     wrapper in js/api.js which forwards verbatim to client.rpc(). */
  const patterns = [
    /\.rpc\s*\(/g,
    /(?<![.\w$])rpc\s*\(/g
  ];
  const calls = [];
  for (const file of clientFiles()) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const seen = new Set();
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const open = m.index + m[0].length - 1;
        if (seen.has(open)) continue;
        seen.add(open);
        const bal = readBalanced(src, open);
        if (!bal) continue;
        const args = splitTopLevel(bal.text);
        if (!args.length) continue;
        const nameLit = args[0].match(/^'([^']+)'$|^"([^"]+)"$|^`([^`]+)`$/);
        if (!nameLit) continue;                    // dynamic name (the wrapper itself)
        const name = nameLit[1] || nameLit[2] || nameLit[3];
        const argLiteral = args[1] || '';
        calls.push({
          name,
          file,
          line: lineOf(src, m.index),
          args: argLiteral ? objectKeys(argLiteral) : [],
          argsResolved: argLiteral ? objectKeys(argLiteral) !== null : true,
          rawArgs: argLiteral
        });
      }
    }
  }
  return calls;
}

/* Indirect call sites: RTCApi.submitExcuse({...}) forwards a caller-built
   object straight into rpc('submit_excuse', a). Resolve those from the caller. */
function extractForwardedArgs() {
  const forwarded = {};
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const re = /API\.submitExcuse\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const bal = readBalanced(src, m.index + m[0].length - 1);
    if (!bal) continue;
    const keys = objectKeys(splitTopLevel(bal.text)[0] || '');
    if (keys) forwarded.submit_excuse = keys;
  }
  return forwarded;
}

/* ── 2. Extract every function shipped by supabase/migrations ─────────────── */

const BASE_TYPES = [
  'uuid', 'text', 'jsonb', 'json', 'boolean', 'bool', 'int', 'integer', 'int2', 'int4', 'int8',
  'smallint', 'bigint', 'numeric', 'decimal', 'real', 'double precision', 'timestamptz',
  'timestamp with time zone', 'timestamp', 'date', 'time', 'void', 'record', 'trigger', 'citext'
];

function normaliseType(raw) {
  let t = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  t = t.replace(/\s*\(\s*\d+(\s*,\s*\d+)?\s*\)/, '');       // varchar(40) -> varchar
  const arr = /\[\s*\]\s*$/.test(t);
  t = t.replace(/\[\s*\]\s*$/, '').trim();
  const alias = {
    integer: 'int4', int: 'int4', int4: 'int4', smallint: 'int2', int2: 'int2',
    bigint: 'int8', int8: 'int8', boolean: 'bool', bool: 'bool',
    'timestamp with time zone': 'timestamptz', timestamptz: 'timestamptz',
    'double precision': 'float8', decimal: 'numeric',
    'character varying': 'varchar'
  };
  t = alias[t] || t;
  return arr ? t + '[]' : t;
}

/* Splits a PostgreSQL parameter list on commas that are not inside parens. */
function splitParams(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") inStr = !inStr;
    if (inStr) continue;
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  const tail = text.slice(start);
  if (tail.trim()) parts.push(tail);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseParams(text) {
  if (!text || !text.trim()) return [];
  return splitParams(text).map((raw) => {
    let s = raw.replace(/\s+/g, ' ').trim();
    let mode = 'IN';
    const modeMatch = s.match(/^(IN|OUT|INOUT|VARIADIC)\s+/i);
    if (modeMatch) { mode = modeMatch[1].toUpperCase(); s = s.slice(modeMatch[0].length); }
    let hasDefault = false;
    const defMatch = s.match(/\s+(DEFAULT\s+|=\s*)/i);
    if (defMatch) { hasDefault = true; s = s.slice(0, defMatch.index); }
    /* `p_batch_id UUID` -> name + type. A bare `UUID` is a positional arg. */
    const named = s.match(/^([A-Za-z_][\w$]*)\s+(.+)$/);
    let name = null;
    let type = s;
    if (named && !BASE_TYPES.includes(named[1].toLowerCase())) {
      name = named[1];
      type = named[2];
    }
    return { name, type: normaliseType(type), hasDefault, mode };
  });
}

/* Reads the RETURNS clause, stopping before the language/volatility keywords. */
function parseReturns(text) {
  const m = text.match(/\bRETURNS\s+([\s\S]*?)(?=\bLANGUAGE\b|\bAS\s*\$)/i);
  if (!m) return null;
  return m[1].replace(/\s+/g, ' ').trim().replace(/\s*(STABLE|IMMUTABLE|VOLATILE|SECURITY DEFINER|SECURITY INVOKER|SET search_path = \w+)\s*/gi, ' ').trim();
}

/* Strips the $$ ... $$ bodies so their contents never look like DDL. */
function stripBodies(sql) {
  return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, (m) => '$BODY$'.padEnd(8, ' ') + '\n'.repeat((m.match(/\n/g) || []).length));
}

function migrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
}

function parseMigrations() {
  const functions = new Map();   // name -> [definition, ...] in apply order
  const grants = [];
  const revokes = [];
  const tables = new Map();      // table -> Set(columns)
  const policies = [];
  const rlsEnabled = new Set();
  const notifies = [];

  for (const file of migrationFiles()) {
    const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const sql = stripBodies(rawSql);

    /* Functions. CREATE and DROP are collected into one list ordered by
       position in the file, because a DROP that precedes a CREATE (the usual
       "drop first, return type changed" pattern) must not cancel it out. */
    const events = [];
    let m;

    const fnRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([A-Za-z_][\w$]*)\s*\(/gi;
    while ((m = fnRe.exec(sql)) !== null) {
      const bal = readBalanced(sql, m.index + m[0].length - 1);
      if (!bal) continue;
      const after = sql.slice(bal.end + 1, bal.end + 900);
      events.push({
        pos: m.index,
        name: m[1],
        file,
        line: lineOf(sql, m.index),
        params: parseParams(bal.text),
        returns: parseReturns(after) || '(unknown)',
        orReplace: /OR\s+REPLACE/i.test(m[0]),
        securityDefiner: /SECURITY\s+DEFINER/i.test(after),
        searchPath: /SET\s+search_path/i.test(after)
      });
    }

    /* DROP FUNCTION — a dropped-and-not-recreated function must not count. */
    const dropRe = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([A-Za-z_][\w$]*)\s*\(([^)]*)\)/gi;
    while ((m = dropRe.exec(sql)) !== null) {
      events.push({ pos: m.index, name: m[1], file, line: lineOf(sql, m.index), dropped: true, params: parseParams(m[2]) });
    }

    events.sort((a, b) => a.pos - b.pos);
    for (const ev of events) {
      if (!functions.has(ev.name)) functions.set(ev.name, []);
      functions.get(ev.name).push(ev);
    }

    /* Grants / revokes on functions and tables */
    const grantRe = /(GRANT|REVOKE)\s+([\s\S]*?)\s+(?:TO|FROM)\s+([^;]+);/gi;
    while ((m = grantRe.exec(sql)) !== null) {
      const entry = {
        kind: m[1].toUpperCase(),
        body: m[2].replace(/\s+/g, ' ').trim(),
        roles: m[3].replace(/\s+/g, ' ').trim().split(',').map((r) => r.trim().toLowerCase()),
        file,
        line: lineOf(sql, m.index)
      };
      const fnMatch = entry.body.match(/ON\s+FUNCTION\s+(?:public\.)?([A-Za-z_][\w$]*)\s*\(([^)]*)\)/i);
      if (fnMatch) { entry.target = 'function'; entry.fn = fnMatch[1]; entry.fnParams = parseParams(fnMatch[2]).map((p) => p.type); }
      const allFn = /ON\s+ALL\s+FUNCTIONS\s+IN\s+SCHEMA/i.test(entry.body);
      if (allFn) { entry.target = 'all-functions'; }
      const tblMatch = entry.body.match(/ON\s+(?:TABLE\s+)?(?:public\.)?([A-Za-z_][\w$]*)\s*$/i);
      if (!entry.target && tblMatch) { entry.target = 'table'; entry.table = tblMatch[1]; }
      (entry.kind === 'GRANT' ? grants : revokes).push(entry);
    }

    /* Tables + columns */
    const tblRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([A-Za-z_][\w$]*)\s*\(/gi;
    while ((m = tblRe.exec(sql)) !== null) {
      const bal = readBalanced(sql, m.index + m[0].length - 1);
      if (!bal) continue;
      const name = m[1];
      if (!tables.has(name)) tables.set(name, new Set());
      for (const colDef of splitParams(bal.text)) {
        const cm = colDef.trim().match(/^([A-Za-z_][\w$]*)\s+/);
        if (!cm) continue;
        const first = cm[1].toUpperCase();
        if (['PRIMARY', 'UNIQUE', 'CHECK', 'FOREIGN', 'CONSTRAINT', 'EXCLUDE', 'LIKE'].includes(first)) continue;
        tables.get(name).add(cm[1]);
      }
    }
    const addColRe = /ALTER\s+TABLE\s+(?:public\.)?([A-Za-z_][\w$]*)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][\w$]*)/gi;
    while ((m = addColRe.exec(sql)) !== null) {
      if (!tables.has(m[1])) tables.set(m[1], new Set());
      tables.get(m[1]).add(m[2]);
    }
    const dropColRe = /ALTER\s+TABLE\s+(?:public\.)?([A-Za-z_][\w$]*)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][\w$]*)/gi;
    while ((m = dropColRe.exec(sql)) !== null) {
      if (tables.has(m[1])) tables.get(m[1]).delete(m[2]);
    }

    /* RLS + policies */
    const rlsRe = /ALTER\s+TABLE\s+(?:public\.)?([A-Za-z_][\w$]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    while ((m = rlsRe.exec(sql)) !== null) rlsEnabled.add(m[1]);
    const disableRls = /ALTER\s+TABLE\s+[\w.]*([A-Za-z_][\w$]*)\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
    while ((m = disableRls.exec(sql)) !== null) rlsEnabled.delete(m[1]);
    const polRe = /CREATE\s+POLICY\s+"?([A-Za-z_][\w$]*)"?\s+ON\s+((?:storage|public)\.)?([A-Za-z_][\w$]*)/gi;
    while ((m = polRe.exec(sql)) !== null) {
      policies.push({ name: m[1], schema: (m[2] || 'public.').replace('.', ''), table: m[3], file, line: lineOf(sql, m.index) });
    }

    /* Schema-cache reload signals */
    const notifyRe = /NOTIFY\s+pgrst\s*,\s*'reload schema'/gi;
    while ((m = notifyRe.exec(sql)) !== null) notifies.push({ file, line: lineOf(sql, m.index) });
  }

  return { functions, grants, revokes, tables, policies, rlsEnabled, notifies, files: migrationFiles() };
}

/* ── 3. Reconcile client calls against migrations ─────────────────────────── */

/* The final live definition of a function: the last CREATE that is not
   followed by a DROP of the same argument signature. */
function effectiveDefs(defs) {
  const live = [];
  for (const d of defs) {
    if (d.dropped) {
      const sig = d.params.map((p) => p.type).join(',');
      for (let i = live.length - 1; i >= 0; i -= 1) {
        if (live[i].params.filter((p) => p.mode !== 'OUT').map((p) => p.type).join(',') === sig) live.splice(i, 1);
      }
      continue;
    }
    live.push(d);
  }
  /* Keep only the last definition per argument signature (CREATE OR REPLACE). */
  const bySig = new Map();
  for (const d of live) bySig.set(d.params.filter((p) => p.mode !== 'OUT').map((p) => p.type).join(','), d);
  return [...bySig.values()];
}

function grantedRoles(schema, fnName, defs) {
  const roles = new Set();
  let sawBlanketRevoke = false;
  const ordered = [...schema.grants, ...schema.revokes].sort((a, b) => {
    const fi = schema.files.indexOf(a.file) - schema.files.indexOf(b.file);
    return fi !== 0 ? fi : a.line - b.line;
  });
  for (const g of ordered) {
    if (g.target === 'all-functions') {
      if (g.kind === 'REVOKE') { roles.clear(); sawBlanketRevoke = true; }
      continue;
    }
    if (g.target !== 'function' || g.fn !== fnName) continue;
    for (const r of g.roles) {
      if (g.kind === 'GRANT') roles.add(r);
      else roles.delete(r);
    }
  }
  return { roles: [...roles], sawBlanketRevoke, defs };
}

function analyse() {
  const schema = parseMigrations();
  const calls = extractRpcCalls();
  const forwarded = extractForwardedArgs();

  /* Merge the argument sets observed at every call site for a given RPC. */
  const byName = new Map();
  for (const c of calls) {
    if (!byName.has(c.name)) byName.set(c.name, { name: c.name, sites: [], args: new Set(), unresolved: false });
    const rec = byName.get(c.name);
    rec.sites.push({ file: c.file, line: c.line });
    if (!c.argsResolved || c.args === null) rec.unresolved = true;
    else for (const a of c.args) rec.args.add(a);
  }
  for (const [name, keys] of Object.entries(forwarded)) {
    if (!byName.has(name)) continue;
    const rec = byName.get(name);
    rec.unresolved = false;
    for (const k of keys) rec.args.add(k);
  }

  const findings = [];
  const rows = [];

  for (const rec of [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const defs = schema.functions.has(rec.name) ? effectiveDefs(schema.functions.get(rec.name)) : [];
    const clientArgs = [...rec.args].sort();
    const row = {
      name: rec.name,
      clientArgs,
      unresolved: rec.unresolved,
      sites: rec.sites,
      defs,
      status: 'ok',
      issues: []
    };

    if (!defs.length) {
      row.status = 'missing';
      row.issues.push('لا توجد أي نسخة من الدالة في supabase/migrations');
      findings.push({ level: 'error', rpc: rec.name, message: 'RPC مفقودة تمامًا من الـ migrations' });
    } else {
      /* PostgREST resolves an RPC by the *set of named arguments* in the JSON
         body. A definition matches when every client key is a declared IN
         parameter and every parameter the client omits has a DEFAULT. */
      const match = defs.find((d) => {
        const ins = d.params.filter((p) => p.mode === 'IN' || p.mode === 'VARIADIC');
        const names = ins.map((p) => p.name);
        const unknown = clientArgs.filter((a) => !names.includes(a));
        const missing = ins.filter((p) => !clientArgs.includes(p.name) && !p.hasDefault);
        return !unknown.length && !missing.length;
      });
      if (!match && !rec.unresolved) {
        row.status = 'signature-mismatch';
        const d = defs[0];
        const ins = d.params.filter((p) => p.mode === 'IN' || p.mode === 'VARIADIC');
        const names = ins.map((p) => p.name);
        const unknown = clientArgs.filter((a) => !names.includes(a));
        const missing = ins.filter((p) => !clientArgs.includes(p.name) && !p.hasDefault).map((p) => p.name);
        if (unknown.length) row.issues.push('الواجهة ترسل معاملات غير معرّفة: ' + unknown.join(', '));
        if (missing.length) row.issues.push('معاملات إلزامية بدون قيمة من الواجهة: ' + missing.join(', '));
        findings.push({ level: 'error', rpc: rec.name, message: 'عدم تطابق التوقيع: ' + row.issues.join(' | ') });
      }
      row.match = match || defs[0];

      /* Overload ambiguity: PostgREST cannot choose between two definitions
         that both accept exactly the client's argument set. */
      const allMatches = defs.filter((d) => {
        const ins = d.params.filter((p) => p.mode === 'IN' || p.mode === 'VARIADIC');
        const names = ins.map((p) => p.name);
        return !clientArgs.filter((a) => !names.includes(a)).length
          && !ins.filter((p) => !clientArgs.includes(p.name) && !p.hasDefault).length;
      });
      if (allMatches.length > 1) {
        row.issues.push('تحميل زائد غامض: ' + allMatches.length + ' تعريفات تقبل نفس المعاملات');
        findings.push({ level: 'error', rpc: rec.name, message: 'overload غامض — PostgREST سيفشل في الاختيار' });
      }
    }

    /* Execution grants */
    const g = grantedRoles(schema, rec.name, defs);
    row.grants = g.roles;
    if (defs.length && !g.roles.length) {
      if (row.status === 'ok') row.status = 'no-grant';
      row.issues.push('لا يوجد GRANT EXECUTE — سيظهر الخطأ كأن الدالة غير موجودة');
      findings.push({ level: 'error', rpc: rec.name, message: 'GRANT EXECUTE مفقود' });
    }
    if (g.roles.includes('public')) {
      row.issues.push('ممنوحة لـ PUBLIC — صلاحية أوسع من اللازم');
      findings.push({ level: 'warn', rpc: rec.name, message: 'EXECUTE ممنوح لـ PUBLIC' });
    }

    /* SECURITY DEFINER without a pinned search_path is a privilege-escalation
       vector; every RPC in this project must pin it. */
    for (const d of defs) {
      if (d.securityDefiner && !d.searchPath) {
        row.issues.push('SECURITY DEFINER بدون SET search_path');
        findings.push({ level: 'error', rpc: rec.name, message: 'SECURITY DEFINER بدون search_path مثبت' });
      }
    }

    rows.push(row);
  }

  /* Functions defined in migrations but never called by the app (informational
     — helpers and triggers legitimately live here). */
  const called = new Set(byName.keys());
  const orphans = [...schema.functions.keys()].filter((n) => !called.has(n)).sort();

  return { schema, rows, findings, orphans, calls };
}

module.exports = {
  analyse,
  parseMigrations,
  extractRpcCalls,
  effectiveDefs,
  migrationFiles,
  ROOT
};

if (require.main === module) {
  const { rows, findings } = analyse();
  for (const r of rows) {
    const flag = r.status === 'ok' && !r.issues.length ? 'OK  ' : 'FAIL';
    console.log(`${flag} ${r.name}(${r.clientArgs.join(', ')})  →  ${r.status}${r.issues.length ? ' :: ' + r.issues.join(' ; ') : ''}`);
  }
  const errors = findings.filter((f) => f.level === 'error');
  console.log(`\n${rows.length} RPC مستدعاة — ${errors.length} خطأ، ${findings.length - errors.length} تحذير`);
  process.exit(errors.length ? 1 : 0);
}
