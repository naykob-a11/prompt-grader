---
name: thai-ui
description: Conventions for building or changing the web UI in apps/web — Thai-first copy via i18n, design tokens, schema-generated controls, responsive layout, light/dark themes and accessibility. Use for any React component, CSS or user-facing text change.
when_to_use: แก้หน้าจอ, เพิ่มปุ่ม, ข้อความภาษาไทย, ธีมมืด, มือถือแสดงผลไม่ดี, new component in apps/web/src/features
---

# Thai-first UI

Spec: `docs/08-ui-ux-spec.md`. Tokens: `apps/web/src/theme/tokens.css`.

## Copy
- Every user-facing string lives in `src/i18n/th.json` (and `en.json`). Components use `t('key')`. No Thai or English literals in JSX.
- Write Thai the way a helpful colleague talks: short sentences, polite but not stiff. Buttons say exactly what happens ("บันทึกเป็นพร้อมต์ใหม่", not "ตกลง"). Errors say what went wrong and how to fix it; no apologies.
- Use the user's words for things: "พร้อมต์", "คลังพร้อมต์", "ค่าปรับ", "ภาพย่อ". Keep established photography terms in English when Thai users know them that way (Vibrance, Tint, HSL, Split toning).
- Thai text needs line-height ≥ 1.5 and must not be truncated mid-character: use `overflow-wrap: anywhere` and `line-clamp`, never fixed-width truncation.

## Visual system
- Colors only through tokens; both themes defined at the token level (`:root`, `prefers-color-scheme: dark`, `[data-theme]`). No literal colors in components.
- Fonts: Anuphan (headings), IBM Plex Sans Thai (body), IBM Plex Mono (numbers), self-hosted through `@fontsource` packages imported in `main.tsx`, which Vite bundles into the site.
- The image stage stays neutral grey — never tint or put accent color around the photo; it biases color judgment.
- Accent teal only for primary actions, selection and slider thumbs.

## Controls
- Sliders, groups and labels are generated from `schema.ts`. If a design needs something the generator cannot do, extend the generator (with a `kind` or option in the schema), not a one-off component.
- Each slider: `<label for>`, numeric output in mono, `aria-valuetext`, double-click label resets to neutral, a tick at the neutral position.

## Layout
- Breakpoints 1200 / 820 px as in docs/08. At < 820 px the stage is sticky (≤ 45vh) and panels become tabs.
- No horizontal page scroll at 360 px. Use grid/flex with `gap`, `min-width: 0` on text-holding children.

## Before finishing a UI change
Screenshot the changed screen in light and dark at 360 px and 1440 px (Playwright `tests/e2e/screens.spec.ts`), check keyboard focus order, and confirm no string was added outside i18n (`pnpm lint` has a rule for JSX literals).
