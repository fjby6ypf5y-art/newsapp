// Runs every test in this folder and prints a one-line verdict for each.
//
//   node tests/run.mjs            all of them
//   node tests/run.mjs swipe      only those whose name contains "swipe"
//
// A test "fails" here if it throws, reports a JS error, or prints a line
// containing ***, which is how the tests mark a wrong result. Everything else
// is a report to read: several of these measure timings and positions rather
// than asserting, because that is what the questions were.
import { readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const only = process.argv[2] || '';
const files = readdirSync(here)
  .filter(f => f.endsWith('.mjs') && f !== 'run.mjs' && f.includes(only))
  .sort();

let bad = 0;
for (const f of files) {
  const out = await new Promise(res =>
    execFile('node', [path.join(here, f)], { timeout: 120000, maxBuffer: 1 << 24 },
      (err, stdout, stderr) => res({ err, stdout, stderr })));
  const text = out.stdout + out.stderr;
  const marks = text.split('\n').filter(l => l.includes('***'));
  const errored = out.err || /ERRORS |PAGEERROR/.test(text);
  const ok = !errored && !marks.length;
  if (!ok) bad++;
  console.log((ok ? '  ok   ' : 'FAILED ') + f.replace('.mjs', ''));
  if (!ok) {
    for (const m of marks.slice(0, 3)) console.log('         ' + m.trim());
    if (out.err) console.log('         ' + String(out.err).split('\n')[0]);
  }
}
console.log('\n' + (files.length - bad) + '/' + files.length + ' clean');
process.exit(bad ? 1 : 0);
