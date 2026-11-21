// solve.js — fast, exact drop-in for csv-reader 1.0.0
// make.fun bounty csv-reader-speed-01-run-20261121
// run({ text, header }) -> { columns, rows, errors }
//
// Spec (competition description, GET /api/competitions/csv-reader-speed-01-run-20261121):
// - A U+FEFF at the very start is dropped.
// - A record ends at LF or CRLF; a line left with no characters is no record.
// - Outside quotes a CR not followed by LF is dropped (error stray_cr).
// - A field that opens with a quote runs to the next quote that is not doubled;
//   "" inside it is one quote and each CRLF or lone CR inside it is read as LF;
//   what follows its closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends); a quote that never
//   closes is a literal character and the text after it is read again as
//   unquoted (unterminated_quote). A quote inside an unquoted field is literal.
// - Fields stay strings, never trimmed or converted.
// - columns is the first record when header is true, else null; rows holds the
//   records after it (every record when header is false), each padded with ""
//   (short_row, with fields: its field count) or cut (long_row, with extra: the
//   cut fields) to the first record's width.
// - Each error is {code, line, row}, in the order met; a record's short_row or
//   long_row when it ends: line the 1-based line its record starts on, counting
//   every LF, CRLF and lone CR inside quotes, and row its record's index in
//   rows, null for the header.
//
// Strategy: fast path per record when the line has no quotes and no CR except a
// trailing CRLF (String split, C speed); slow char-by-char path only for broken
// lines. No caching between cases: run() is stateless. No network, no clock,
// deterministic.

const COMMA = 44; // ,
const LF = 10;    // \n
const CR = 13;    // \r
const QUOTE = 34; // "

export function run(input) {
  const inp = input || {};
  let text = inp.text;
  if (typeof text !== 'string') text = text == null ? '' : String(text);
  const header = !!inp.header;
  const n = text.length;
  let pos = 0;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  const records = [];
  const errors = [];
  let line = 1;
  let recordIndex = 0;

  const rowOf = (ri) => (header ? (ri === 0 ? null : ri - 1) : ri);

  while (true) {
    // Skip empty lines; drop leading lone CRs (each: stray_cr).
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) { pos++; line++; }
      else if (c === CR) {
        if (pos + 1 < n && text.charCodeAt(pos + 1) === LF) { pos += 2; line++; }
        else { errors.push({ code: 'stray_cr', line, row: rowOf(recordIndex) }); pos++; }
      } else break;
    }
    if (pos >= n) break;

    const recordStartLine = line;
    const row = rowOf(recordIndex);

    // NOTE: never indexOf('"') / indexOf('\r') from pos on the whole text:
    // with no match they scan to EOF, which is O(n) per record (O(n^2)
    // total). Bound every search to this line's segment instead.
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = n;
    let atEof = lineEnd >= n;
    let seg = text.slice(pos, lineEnd);
    const hasQuote = seg.indexOf('"') !== -1;
    const crAt = seg.indexOf('\r');

    let fields;
    if (!hasQuote && (crAt === -1 || (crAt === seg.length - 1 && !atEof))) {
      // Fast path: no quotes, no CR except a trailing CRLF.
      if (crAt === seg.length - 1) seg = seg.slice(0, -1);
      fields = seg.split(',');
      if (!atEof) { pos = lineEnd + 1; line++; }
      else pos = n;
    } else {
      // Slow path: broken line (quotes and/or stray CRs, possibly multi-line).
      const r = parseRecordSlow(text, n, pos, line, row, errors);
      fields = r.fields; pos = r.pos; line = r.line; atEof = r.atEof;
    }

    if (recordIndex > 0) {
      const width = records[0].length;
      if (fields.length < width) {
        errors.push({ code: 'short_row', line: recordStartLine, row, fields: fields.length });
        while (fields.length < width) fields.push('');
      } else if (fields.length > width) {
        errors.push({ code: 'long_row', line: recordStartLine, row, extra: fields.slice(width) });
        fields.length = width;
      }
    }
    records.push(fields);
    recordIndex++;
    if (atEof) break;
  }

  return {
    columns: header ? (records.length ? records[0] : null) : null,
    rows: header ? records.slice(1) : records,
    errors,
  };
}

// Parse one record starting at startPos (a non-line-break char). Returns
// { fields, pos, line, atEof }. pos ends just past the record terminator
// (or at EOF).
function parseRecordSlow(text, n, startPos, startLine, row, errors) {
  let pos = startPos;
  let line = startLine;
  const fields = [];

  while (true) {
    let field;
    if (pos < n && text.charCodeAt(pos) === QUOTE) {
      // Quoted field: look for the closing quote ("" is one literal quote).
      let j = pos + 1;
      let closed = -1;
      while (j < n) {
        if (text.charCodeAt(j) === QUOTE) {
          if (j + 1 < n && text.charCodeAt(j + 1) === QUOTE) { j += 2; continue; }
          closed = j; break;
        }
        j++;
      }
      if (closed === -1) {
        // Unterminated: the quote is a literal character; re-read the rest
        // of the field as unquoted. Error is emitted at detection time.
        errors.push({ code: 'unterminated_quote', line, row });
        const r = parseUnquoted(text, n, pos, line, errors, row);
        field = r.field; pos = r.pos;
      } else {
        // Decode the quoted span: "" -> ", CRLF / lone CR / LF -> LF.
        let k = pos + 1;
        let chunkStart = k;
        const chunks = [];
        while (k < closed) {
          const c = text.charCodeAt(k);
          if (c === QUOTE) {
            chunks.push(text.slice(chunkStart, k));
            chunks.push('"');
            k += 2; chunkStart = k;
          } else if (c === CR) {
            chunks.push(text.slice(chunkStart, k));
            chunks.push('\n');
            if (k + 1 < closed && text.charCodeAt(k + 1) === LF) k += 2; else k += 1;
            chunkStart = k; line++;
          } else if (c === LF) {
            chunks.push(text.slice(chunkStart, k));
            chunks.push('\n');
            k += 1; chunkStart = k; line++;
          } else k++;
        }
        chunks.push(text.slice(chunkStart, closed));
        let value = chunks.length === 1 ? chunks[0] : chunks.join('');
        pos = closed + 1;
        // Junk after the closing quote, up to the next comma or line break,
        // appended as it stands. Lone CRs are dropped (stray_cr) and junk
        // continues past them; CRLF ends the field.
        let jStart = pos;
        let jParts = null;
        while (pos < n) {
          const c = text.charCodeAt(pos);
          if (c === COMMA || c === LF) break;
          if (c === CR) {
            if (pos + 1 < n && text.charCodeAt(pos + 1) === LF) break;
            if (jParts === null) jParts = [];
            jParts.push(text.slice(jStart, pos));
            errors.push({ code: 'stray_cr', line, row });
            pos++; jStart = pos; continue;
          }
          pos++;
        }
        let junk;
        if (jParts !== null) { jParts.push(text.slice(jStart, pos)); junk = jParts.join(''); }
        else junk = text.slice(jStart, pos);
        if (junk.length > 0) {
          value += junk;
          errors.push({ code: 'quote_junk', line, row });
        }
        field = value;
      }
    } else {
      const r = parseUnquoted(text, n, pos, line, errors, row);
      field = r.field; pos = r.pos;
    }
    fields.push(field);

    if (pos >= n) return { fields, pos, line, atEof: true };
    const c = text.charCodeAt(pos);
    if (c === COMMA) { pos++; continue; }
    if (c === LF) { pos++; line++; return { fields, pos, line, atEof: false }; }
    if (c === CR) { pos += 2; line++; return { fields, pos, line, atEof: false }; }
    // Defensive: a lone CR right after a field (should not happen, the field
    // parsers drop lone CRs): drop it and parse the next field.
    errors.push({ code: 'stray_cr', line, row });
    pos++;
  }
}

// Parse one unquoted field starting at startPos. Stops at comma, LF, CRLF or
// EOF; lone CRs are dropped (stray_cr). Quotes are literal characters.
// Returns { field, pos }. Line never changes here (dropped CRs are not breaks).
function parseUnquoted(text, n, startPos, line, errors, row) {
  let pos = startPos;
  let fStart = pos;
  let parts = null;
  while (pos < n) {
    const c = text.charCodeAt(pos);
    if (c === COMMA || c === LF) break;
    if (c === CR) {
      if (pos + 1 < n && text.charCodeAt(pos + 1) === LF) break;
      if (parts === null) parts = [];
      parts.push(text.slice(fStart, pos));
      errors.push({ code: 'stray_cr', line, row });
      pos++; fStart = pos; continue;
    }
    pos++;
  }
  let field;
  if (parts !== null) { parts.push(text.slice(fStart, pos)); field = parts.join(''); }
  else field = text.slice(fStart, pos);
  return { field, pos };
}
