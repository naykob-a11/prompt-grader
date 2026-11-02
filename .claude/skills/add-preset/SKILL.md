---
name: add-preset
description: Turn a user's color-grading prompt (free text or structured) into a new built-in preset — choose calibrated parameter values, write its .sgp.txt structured prompt, add it to seed/builtin-presets.json, the catalog doc and golden tests. Use when the user pastes a new prompt and wants it shipped as a built-in example.
when_to_use: เพิ่มพรีเซ็ต, ทำพร้อมต์นี้เป็นตัวอย่างในตัว, add this prompt as a preset, user pastes a long grading prompt
argument-hint: "<prompt text>"
---

# Add a built-in preset

Prompt from the user:

$ARGUMENTS

If the text is already a structured prompt (lines like `เงา: ยก ปานกลาง`), parse it with the SGP parser, review the warnings with the user, and skip to step 3.

## 1. Read the prompt like a colorist
Split it into three lists and show them to the user:
- **Global adjustments the engine can do** (exposure, WB, contrast, saturation, split tone, HSL bands, haze, grain, vignette, cast fix, dehaze, sharpen, denoise).
- **Requests the engine cannot do** (local/masked edits, relighting, object or face changes, crop). These go under `[หมายเหตุ]`.
- **Preservation rules** ("do not change the face", "keep composition") — already guaranteed by the engine; summarize under `[ห้ามเปลี่ยน]`.

## 2. Choose values
- Start from neutral (`DEFAULT_PARAMS`), not from another preset.
- Use the parameter table in `docs/05-parameter-schema.md` and the calibrated examples in `calibration-examples.md`.
- Be restrained: most values within ±10..60. Words like "very subtle", "slight", "gentle" → 10–25; "deep", "rich", "strong" → 45–70.
- Contradictions are common ("deep shadows" + "low-contrast film"): satisfy both with different controls (e.g. `shadows` negative for depth, `fade` small for film lift), and say so in the note.
- Avoid stacking the same effect twice (e.g. `temp` warm + `hiSat` orange + `sun` all high → yellow cast). If the prompt says "not yellow", set `guard` ≥ 50.

## 3. Verify on real images
- Render the preset with the CPU engine on every image in `tests/fixtures/images/` (`pnpm --filter engine render-preset -- <id>`), write outputs to `tests/golden/_preview/`, and look at them.
- Check: no clipped highlights unless requested, no unwanted color cast, skin not orange/green (portraits), sky not cyan unless requested.
- Adjust once based on what you see; show the user the before/after set and the values.

## 4. Add it
1. `seed/builtin-presets.json`: `{id: "b<next>", name: <Thai name>, prompt: <full original prompt>, params: <ALL keys>, tags: [...]}` with `schemaVersion` unchanged.
2. `seed/structured-prompts/<slug>.sgp.txt`: generate with `serializeSGP()` (name, tags, params, notes, preserve). Parse it back: identical params, zero warnings.
3. `docs/14-presets-catalog.md`: new section with the original prompt and the structured prompt.
4. `pnpm golden:update` — only the new preset's goldens should be created; existing ones must not change.

## 5. Report
Preset name, the three lists from step 1, the structured prompt text, and key values with one-line reasons.
