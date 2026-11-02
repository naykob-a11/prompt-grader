---
name: grading-engine
description: Rules and workflow for changing the color-grading engine in packages/engine (CPU reference in cpu/, WebGL2 shaders in gl/). Use whenever editing grade/detail/stats formulas, adding a pipeline stage, touching shaders or uniforms, or debugging a GPU/CPU mismatch.
when_to_use: แก้สูตรเกรดสี, เพิ่มขั้นในเครื่องยนต์, shader ไม่ตรงกับ CPU, ภาพออกมาไม่เหมือนต้นแบบ, golden test fails, parity test fails
---

# Grading engine

The engine is the product's core promise: it changes only pixel colors and never regenerates the photo. Treat every change as a change to a spec, not just code.

## Sources of truth (read before editing)

1. `docs/04-grading-engine-spec.md` — formulas, stage order, invariants I1–I7
2. `docs/05-parameter-schema.md` + `packages/engine/src/schema.ts` — parameters
3. `reference/prototype-v3.html` — functions `detail`, `grayWorld`, `grade` are the behavioral reference the user approved. Do not edit it. One approved deviation: the final mix uses the pixel from before the detail pass (spec §2.10), so `amount=0` returns the original.

If the spec and the prototype disagree, stop and report the difference to the user rather than picking one.

## Workflow for any formula change

1. **Spec first.** Edit the relevant section of `docs/04-grading-engine-spec.md` so it states the new math exactly.
2. **CPU.** Implement in `src/cpu/grade.ts` (or `detail.ts`, `stats/*`). Keep the hot loop allocation-free: no objects, arrays or closures per pixel; hoist parameter normalization (`p.x/100`) outside the loop.
3. **GPU.** Mirror the change in `src/gl/shaders/grade.frag` (or `detail.frag`). Uniforms come from `src/gl/uniforms.ts`, which is generated from the schema — never hand-add a uniform name.
4. **Invariants.** The neutral value of any new control must make the stage a no-op (I1). Run `pnpm --filter engine test`.
5. **Parity.** Run `pnpm test:e2e -- parity`. Max abs diff must be ≤ 2/255 with grain = 0. See `parity-checklist.md` when it fails.
6. **Golden.** If output changes intentionally: `pnpm golden:update` then `pnpm golden:diff`, and show the diff images to the user before committing. Never update goldens to make a failing test pass without that review.
7. **Version.** If the meaning of an existing parameter value changed, bump `SCHEMA_VERSION` and add a case to `migrate.ts` + `migrate.test.ts` so saved presets keep their look.

## Pipeline order (do not reorder without updating the spec)

detail(3×3) → exposure/WB/castFix → dehaze → HSV (bands, foliage, sat, vibrance) → global saturation (luma-preserving) → tone on luminance → split toning → yellow guard → haze (y-dependent) → fade → vignette → grain → mix by amount

## Spatial stages and tiling

`detail` reads neighbours; `haze`, `vignette`, `grain` depend on absolute (x, y) in the full image. Every tile/strip call must receive full-image `W, H` and its own `y0` (and `x0` for tiles), and detail tiles need 1 px padding (2 px on GPU tiles). `tiling.test.ts` must stay green.

## Numerical conventions

- Work in float 0..1 sRGB (no linearization — matches the prototype).
- Luminance weights 0.2126/0.7152/0.0722 everywhere.
- Final write: CPU uses `Uint8ClampedArray` rounding; GPU writes to RGBA8 — do not add dithering.
- GPU grain uses a float hash; it is checked statistically, not per-pixel.
