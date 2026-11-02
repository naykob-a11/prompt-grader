---
name: add-parameter
description: Add a new grading parameter (slider) end to end — schema, CPU, GLSL, UI label, i18n, migration, structured-prompt vocabulary, tests and docs. Use when the user asks for a new adjustment, control or slider.
when_to_use: เพิ่มแถบเลื่อน, เพิ่มพารามิเตอร์, อยากได้ปุ่มปรับ ..., add clarity, add curves control
argument-hint: "<key> — <what it does>"
disable-model-invocation: true
---

# Add a parameter: $ARGUMENTS

Follow every step; tick them off in the task list. Load the `grading-engine` skill first — its rules apply.

## 1. Design (confirm with the user before coding)
- Key (camelCase, short), Thai label, group, range, neutral value, `kind` (linear | hue | signed).
- Where it sits in the pipeline (`docs/04` order) and the exact formula.
- Proof the neutral value is a no-op.
- What existing parameter it overlaps with, and why it is still needed.

## 2. Implement
1. `packages/engine/src/schema.ts` — add the definition with `since: <new version>` and a one-line description (direction of +/−, typical range).
2. Bump `SCHEMA_VERSION`; in `migrate.ts` fill the new key with its neutral value for older versions.
3. `src/cpu/grade.ts` (or `detail.ts`) — formula, hoisted normalization.
4. `src/gl/shaders/*.frag` — same formula. Uniform is generated from the schema; verify it appears in `uniforms.ts` output.
5. `apps/web/src/i18n/th.json` (and `en.json`) — label key. Slider UI is generated from the schema; no component edits should be needed. If one is needed, the generator is missing a feature — fix the generator instead.

## 3. Test
- Extend `identity.test.ts` and `extremes.test.ts` (automatic if they iterate the schema — check).
- Add a focused unit test showing the intended effect on a synthetic pixel (e.g. +50 increases local contrast in a mid-grey edge).
- `pnpm golden:update` should change nothing for existing presets (new key is neutral). If goldens change, the neutral value is not a no-op — fix it.
- Parity test passes.

## 4. Document
- `docs/04-grading-engine-spec.md` — formula in its stage.
- `docs/05-parameter-schema.md` — table row + version history line.
- `seed/parameter-schema.json` — regenerate from `schema.ts` (`pnpm --filter engine export-schema`).
- `seed/sgp-vocabulary.json` — add a `params` entry: Thai canonical heading first, then synonyms, plus parameter-specific positive/negative words if generic ones read wrong. Place it in a serializer section (`sgp/serialize.ts`). Add a parse test and confirm the random round-trip test still passes.
- `seed/sgp-bridge-instruction.md` — add the heading to the list so chat replies can use it.

## 5. Report
Tell the user: the key, the Thai heading to use in prompts, where it is in the UI, and a before/after on a test image.
