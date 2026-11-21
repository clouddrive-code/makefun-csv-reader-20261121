// main.ts — entrypoint the harness runs (node /bot/main.ts, Node 22).
// Answers every case with solve.js's run(). No network, no clock, no caching
// between cases: each case is answered alone from its own input.
//
// Input is accepted in every shape a harness plausibly uses, and the output
// mirrors the input shape:
// - stdin (or a file given as argv[1]) holding one JSON case {text, header}
//   -> one JSON answer object on stdout
// - a JSON array of cases -> a JSON array of answers
// - an object {cases: [...]} -> a JSON array of answers
// - newline-delimited JSON cases (one per line) -> one JSON answer per line
// - a file path as argv[1] (optional output path as argv[2]); INPUT_FILE /
//   CASES_FILE / MAKEFUN_INPUT and OUTPUT_FILE env vars are also honoured.
// - if the input is not JSON at all, it is treated as one case
//   {text: <the raw input>, header: false}.
import { readFileSync, writeFileSync } from 'node:fs';
import { run } from './solve.js';

function readInput() {
  let raw = '';
  let inFile = null;
  let outFile = null;
  const argv = process.argv.slice(2);
  if (!process.stdin.isTTY) {
    try {
      const buf = readFileSync(0, 'utf8');
      if (buf && buf.length > 0) raw = buf;
    } catch {}
  }
  if (!raw) {
    if (argv[0]) inFile = argv[0];
    else if (process.env.MAKEFUN_INPUT) inFile = process.env.MAKEFUN_INPUT;
    else if (process.env.INPUT_FILE) inFile = process.env.INPUT_FILE;
    else if (process.env.CASES_FILE) inFile = process.env.CASES_FILE;
    if (inFile) raw = readFileSync(inFile, 'utf8');
    if (argv[1]) outFile = argv[1];
    else if (process.env.OUTPUT_FILE) outFile = process.env.OUTPUT_FILE;
  } else if (argv[0]) {
    outFile = argv[0];
  }
  return { raw, outFile };
}

function parseCases(raw) {
  if (!raw || raw.length === 0) return { cases: [], mode: 'array' };
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  if (parsed !== null && parsed !== undefined) {
    if (Array.isArray(parsed)) return { cases: parsed, mode: 'array' };
    if (Array.isArray(parsed.cases)) return { cases: parsed.cases, mode: 'array' };
    if (typeof parsed === 'object' && 'text' in parsed) return { cases: [parsed], mode: 'single' };
    return { cases: [parsed], mode: 'single' };
  }
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length > 1) {
    try {
      const cases = lines.map((l) => JSON.parse(l));
      return { cases, mode: 'ndjson' };
    } catch {}
  }
  return { cases: [{ text: raw, header: false }], mode: 'single' };
}

const { raw, outFile } = readInput();
const { cases, mode } = parseCases(raw);
const answers = cases.map((c) => run(c));
let out;
if (mode === 'single') out = JSON.stringify(answers[0] ?? { columns: null, rows: [], errors: [] });
else if (mode === 'ndjson') out = answers.map((a) => JSON.stringify(a)).join('\n');
else out = JSON.stringify(answers);
if (outFile) writeFileSync(outFile, out);
else process.stdout.write(out + (mode === 'ndjson' ? '\n' : ''));
