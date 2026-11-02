---
name: add-vocabulary
description: Teach the structured-prompt parser a new word or heading — a synonym for a parameter, an intensity word, a direction word, a colour name or a band name — by editing seed/sgp-vocabulary.json and adding tests. Use when a user's wording is not understood.
when_to_use: ตัวอ่านไม่รู้จักคำ, เพิ่มคำศัพท์, เพิ่มคำพ้อง, ไม่รู้จักหัวข้อ warning, add synonym
argument-hint: "\"<word>\" = <meaning>"
disable-model-invocation: true
---

# Add vocabulary: $ARGUMENTS

1. **Classify the word.** Heading alias (which parameter/tint/band)? Intensity (which level)? Direction (positive or negative, generic or for one parameter)? Special value? Colour (which hue)?
2. **Check for collisions** in `seed/sgp-vocabulary.json` after normalization (lowercase, no spaces):
   - the same word with a different meaning anywhere → stop and ask the user which meaning wins;
   - the new word contained inside an existing longer word, or containing one, is fine (longest match wins) but add a test proving both still read correctly.
3. **Edit the JSON.** Append to the right list; never reorder the first alias of an entry (it is the canonical label the serializer writes — changing it changes every saved file's text).
4. **Tests.** Add a case to `packages/engine/test/sgp.test.ts` (and `reference/sgp-reference.test.mjs` while the reference is maintained) using the word in a realistic line; run the full SGP suite and the round-trip test.
5. **Chat instruction.** If the word is a new heading or level, consider adding it to `seed/sgp-bridge-instruction.md`; usually not needed for synonyms.
6. **Docs.** Regenerate the vocabulary tables in `docs/06-structured-prompt-format.md` §5.
7. Report the word, its meaning, and the test line.
