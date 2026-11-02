---
name: verify
description: Pre-commit verification for this repo — runs lint, typecheck, unit/engine/SGP/golden tests, and, depending on what changed, parity and e2e screenshots; then reports a pass/fail checklist. Use before every commit or when the user asks to check the work.
when_to_use: ตรวจงาน, พร้อม commit ไหม, verify, before opening a PR
disable-model-invocation: true
allowed-tools: Bash(pnpm lint*) Bash(pnpm typecheck*) Bash(pnpm test*) Bash(node --test reference/*) Bash(git diff*) Bash(git status*)
---

# Verify

## 1. What changed
Run `git status` and `git diff --stat`. Classify the change: engine, schema, structured prompt (sgp/vocabulary), web UI, storage, docs only.

## 2. Always
```bash
pnpm lint && pnpm typecheck && pnpm test
node --test reference/sgp-reference.test.mjs
```

## 3. Conditional
| Changed | Also run / check |
|---|---|
| `packages/engine/src/` cpu/, gl/ หรือ stats/ | `pnpm test:e2e -- parity`; if goldens changed, `pnpm golden:diff` and list which presets moved |
| `schema.ts` | `SCHEMA_VERSION` bumped? migration test added? `seed/parameter-schema.json` regenerated? docs/05 updated? |
| `apps/web` UI | `pnpm test:e2e -- screens` (light/dark, 360/1440 px); no JSX string literals; focus visible |
| `src/sgp/`, `seed/sgp-vocabulary.json`, `seed/sgp-bridge-instruction.md` | SGP suite incl. round-trip; every file in `seed/structured-prompts/` parses with zero warnings; docs/06 tables regenerated |
| any code | `pnpm test:e2e -- network`: no request leaves the origin |
| storage / import-export | import the fixture libraries in `tests/fixtures/library/`, including the prototype `kreadsi-prompts` format |

## 4. Rules check
Go through CLAUDE.md "กฎที่ห้ามละเมิด" 1–10 and confirm each against the diff.

## 5. Report
A short checklist in Thai: each command with ✅/❌, anything skipped and why, and the first error message for any failure. Do not commit; leave that to the user unless they asked.
