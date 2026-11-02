# Calibration examples (values approved by the user in the prototype)

Values are only the non-neutral ones. Full prompts are in `seed/builtin-presets.json`; structured versions in `seed/structured-prompts/`. These numbers also anchor the wording levels in `seed/sgp-bridge-instruction.md`.

| Intent in the prompt | Values used | Why |
|---|---|---|
| "deep cinematic teal-green fields" | teal 60, forest 45 | teal rotates green hue toward ~150°, forest darkens greens in shadows |
| "very slight warm olive only in sunlit patches" | sun 30 | `sun` only affects bright greens; stays subtle |
| "faint delicate warm cream highlights" | hiHue 40, hiSat 30 | cream ≈ 35–45°, low strength |
| "deep shadows with subtle cool dark-teal undertone" | shadows −35, shHue 188, shSat 45 | depth via tone, color via split tone |
| "avoid heavy yellow/orange/amber casts" | guard 65 | explicit negative request → strong guard |
| "gentle haze, neutral slightly cool" in background | haze 35, reach 45, hazeTemp −30 | engine haze comes from the top of the frame |
| "low-contrast organic film texture" + "gentle vignette" | fade 25, grain 30, vignette 40 | |
| "correct underexposure, lift shadows gently, avoid blown highlights" | exposure 22, shadows 30, highlights −15 | lift + protect |
| "correct green or yellow cast" | castFix 70, tint 6, sG −25, sY −15 | auto cast fix plus targeted reduction |
| "enhance lavender and purple tones, realistic fabric" | sP 25, lP 10, hP −5 | moderate; purples clip quickly |
| "improve clarity, reduce mild haze" | dehaze 20, sharpen 35 | |
| "subtle noise reduction, keep skin texture" | denoise 25 | above 40 starts to smear skin |
| "high-contrast black and white, darker sky" | saturation −100, contrast 45, lB −45 | band luminance acts like a colour filter in B&W |
