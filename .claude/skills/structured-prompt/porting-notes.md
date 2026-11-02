# Porting notes: reference/sgp-reference.mjs → packages/engine/src/sgp/

| Reference function | Target | Notes |
|---|---|---|
| `loadDefaults()` | n/a | In the app, import the JSON files directly (Vite JSON import); no `fs`. |
| `norm()` | `vocabulary.ts` | NFC + lowercase + U+2212/U+2013 → `-` + remove all whitespace. Thai has no word spaces, so matching is substring-based on the normalized text. |
| `buildIndex()` | `vocabulary.ts` | Build once at module load; sort every dictionary longest word first. Expose typed lookups. |
| `scan()` | `vocabulary.ts` | Longest-first, consume matched span (replace with NUL) so `มากขึ้น` is not also read as `มาก`. Keep O(words × length) — fine for ≤ 64 KB. |
| `numbers()` | `parse.ts` | Prefer the last `(...)` group, found by `lastParenGroup()` with `indexOf`, not a regex. `°`/`องศา` marks a hue. Keep every regex linear: no `\s*` at the start of an unanchored pattern, no `\([^)]*\)`. |
| `parseScalar()` | `parse.ts` | Decision order in spec §4.1 is normative. One-sided params + negative word → min + warning, with or without a number. |
| `parseTint()` | `parse.ts` | Finite degree number → hue (0..360 kept as is, outside wrapped); other number → strength; colour word fallback. A non-finite degree is ignored, so `NaN` can never reach `params`. |
| `parseBand()` | `parse.ts` | Split on `,` `،` `、`; attribute must start the part. |
| `parseSGP()` | `parse.ts` | Skip blank lines, `//` comments, and code-fence lines. `#` meta lines, `[section]` lines. Notes/preserve sections keep lines verbatim, including blanks and `//`; a leading `\` is removed and forces the line to be text. Duplicate keys: last wins + warning. |
| `serializeSGP()` | `serialize.ts` | Section order and line shapes are normative (round-trip depends on them). `v === 0` on a signed param writes `ไม่ปรับ (0)`; tint with strength 0 but non-default hue writes `<color> (<hue>°, 0)`. `notes`/`preserve` go through `textLines()`, which backslash-escapes lines starting with `[`, `#`, a code fence or `\`. |
| `clampTo()` | `parse.ts` | Round, clamp, then `+ 0` to normalize `-0`. |

Types to export:

```ts
export interface SgpWarning { line: number; message: string; suggestion?: string }
export interface SgpResult {
  params: Params; name: string; tags: string[]; notes: string; preserve: string;
  warnings: SgpWarning[]; matched: number;
}
export function parseSGP(text: string): SgpResult;
export function serializeSGP(p: { name?: string; tags?: string[]; params: Params; notes?: string; preserve?: string }): string;
export function buildTemplate(): string;               // every heading with `ไม่ปรับ`
export function buildBridgeInstruction(freeText: string): string;
```

Acceptance: copy every test from `reference/sgp-reference.test.mjs` into `test/sgp.test.ts` unchanged in meaning, then add fuzz (`fast-check`) and a 2,000-line benchmark (< 20 ms).
