# GPU/CPU parity failure checklist

Work through in order; most mismatches are one of the first four.

1. **Hue wrap.** GLSL `mod(x, 360.0)` vs JS `%` with negatives. CPU uses `((h % 360) + 360) % 360`.
2. **HSV branch at max channel ties.** JS checks `mx === r`, then `mx === g`. Replicate the same priority in GLSL, not `step()`-based tricks that pick a different branch when two channels are equal.
3. **Clamp points.** CPU clamps after exposure (`min(1, …)`), after vibrance (s), after v, and Ln to [0, 1.05]. Missing one in GLSL shows up as highlight differences.
4. **Texture sampling.** Source texture must use `NEAREST` filtering and `texelFetch` for the detail pass; `LINEAR` blurs before the 3×3 kernel runs.
5. **Precision.** Fragment shader must declare `precision highp float;`. Intermediate FBO for the detail pass must be RGBA16F or RGBA32F, not RGBA8.
6. **sRGB handling.** Upload as `RGBA8` (not `SRGB8_ALPHA8`) and do not enable `FRAMEBUFFER_SRGB`; the engine math is in gamma space.
7. **Premultiplied alpha.** Set `UNPACK_PREMULTIPLY_ALPHA_WEBGL = false` and `UNPACK_COLORSPACE_CONVERSION_WEBGL = NONE`.
8. **Y orientation.** `y/H` for haze must be measured from the top of the image; flip `gl_FragCoord.y` (or upload flipped) consistently with readPixels.
9. **Gray-world gains.** Both paths must use the same `GradeContext.wbGains` computed once per image, not recomputed per tile.

Debug aid: render a single-row synthetic image (hue wheel + grey ramp) and print per-pixel CPU vs GPU values for the first differing stage by toggling stages with a debug uniform.
