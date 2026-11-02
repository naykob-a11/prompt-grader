---
name: structured-prompt
description: Work on the Structured Grading Prompt (SGP) — the text format users write or attach to set grading parameters, its local parser/serializer in packages/engine/src/sgp, the vocabulary file, the prompt editor UI, file attach/export, and the copy-to-chat instruction. Use for any change to how prompts are read, written, attached or explained.
when_to_use: พร้อมต์อ่านผิด, แก้รูปแบบพร้อมต์, ตัวอ่าน sgp, แนบไฟล์พร้อมต์, คำสั่งสำหรับแชต Claude, prompt editor, porting reference/sgp-reference.mjs
---

# Structured Grading Prompt (SGP)

Spec: `docs/06-structured-prompt-format.md` · files and clipboard: `docs/09-file-formats.md`
Reference behavior: `reference/sgp-reference.mjs` with acceptance tests `reference/sgp-reference.test.mjs`
Vocabulary (data, not code): `seed/sgp-vocabulary.json` · chat instruction: `seed/sgp-bridge-instruction.md`

## Non-negotiables
1. **Round-trip.** `parse(serialize(p)).params` equals `p` for every valid `p`, with zero warnings. The random round-trip test must stay green.
2. **Never throw.** Any input — binary junk, 2,000 lines, unbalanced parentheses — returns a result with warnings. Linear time; no catastrophic regex.
3. **Numbers beat words.** `(…)` numbers are exact; words are for people.
4. **Unknown is a warning, not an error.** One bad line never discards the rest of the file.
5. **Words live in the vocabulary JSON.** No Thai or English matching words in TypeScript.
6. **No network.** The parser and the chat bridge never send anything; the user copies and pastes.

## Porting the reference (phase P5)
Follow `porting-notes.md`. Port behavior exactly, then improve only with a spec change + new test.

## Changing the format
1. Write the change in `docs/06-structured-prompt-format.md` first (rules §4, tables §5).
2. Add failing tests to `packages/engine/test/sgp.test.ts` (and mirror in `reference/sgp-reference.test.mjs` if the reference must change too — keep both in sync).
3. Implement in `src/sgp/`, then regenerate `seed/structured-prompts/*.sgp.txt` with the serializer and confirm `git diff` shows only intended changes.
4. If a word's numeric meaning changed (e.g. `ปานกลาง` no longer 35): bump the format version in the vocabulary, add a conversion for older files, and tell the user — saved prompts would otherwise change look.
5. Update `seed/sgp-bridge-instruction.md` whenever headings, levels or colors change, so chat replies stay parseable. Verify by pasting the sample reply in the instruction through the parser: zero warnings.

## Editor behavior (apps/web/features/prompt-editor)
- Parse 150 ms after typing stops; `Ctrl+Enter` parses immediately.
- Warnings: underline the line, tooltip with the message, list below the editor; unknown headings get "หมายถึง …" suggestions from `suggest.ts`.
- Slider → text sync rewrites the text from the sliders, keeping the name, tags, `[หมายเหตุ]` and `[ห้ามเปลี่ยน]`. `//` comments do not survive it. Guard against loops with a change-source flag.
- The editor runs in a shadow root on purpose: outside one, CodeMirror adds a `<style>` tag, which the CSP blocks. `tests/e2e/csp.spec.ts` checks this.
- Chat bridge dialog: show the exact text that will be copied; fall back to a selectable textarea if the clipboard is refused; state plainly that no image is included.

## When a user reports "my prompt was read wrong"
1. Save their text as `tests/fixtures/sgp/<slug>.sgp.txt` + expected values JSON.
2. Decide: missing word (→ `/add-vocabulary`), ambiguous word (→ pick the dominant meaning, document it), or a grammar gap (→ spec change above).
3. Add the test first, then fix.
