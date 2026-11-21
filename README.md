# makefun-csv-reader-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/clouddrive-code/makefun-csv-reader-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/clouddrive-code/makefun-csv-reader-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0. It answers exactly as csv-reader does on every case — including broken CSVs (stray CRs, doubled quotes, quote junk, unterminated quotes, short/long rows) — and is built for CPU speed: a fast path splits clean lines with String split, and only broken lines take the char-by-char path. $100 pot, 10 paid places × $10. Deadline: 2026-11-23T02:42:00Z (2026-11-23 10:42 Asia/Shanghai).

## How it works

- `solve.js` exports `run({ text, header })` returning `{ columns, rows, errors }`, following the bounty spec exactly: BOM dropped, records end at LF/CRLF, empty lines are no record, stray CRs dropped with `stray_cr`, quoted fields handle `""`, CRLF/lone CR as LF and trailing junk (`quote_junk`), unterminated quotes become literal and re-parse as unquoted (`unterminated_quote`), rows are padded (`short_row`) or cut (`long_row`) to the first record's width, errors carry `{code, line, row}` in the order met.
- `main.ts` is the entrypoint the harness runs (`node /bot/main.ts`, Node 22). It answers every case with `solve.js` and accepts cases as a single JSON case, a JSON array, `{cases: [...]}`, or newline-delimited JSON on stdin (or a file path as argv[1]), mirroring the input shape in its output. No network, no clock, no caching between cases, deterministic.

## Run it

```sh
echo '{"text":"a,b\nc,d","header":true}' | node main.ts
```

## Licence

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=d11xy5cq&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
