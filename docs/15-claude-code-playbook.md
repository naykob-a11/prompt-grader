# 15 · Playbook สั่ง Claude Code สร้างโปรเจคทีละระยะ

> วิธีใช้: เปิดโฟลเดอร์โปรเจคในเทอร์มินัล รัน `claude` แล้วคัดลอกคำสั่งของแต่ละระยะไปวางทีละข้อ รอให้ระยะก่อนหน้าผ่านเกณฑ์ก่อนเริ่มระยะถัดไป ทุกคำสั่งอ้างเอกสารใน `docs/` เพื่อให้ Claude Code อ่านสเปกก่อนลงมือ

## เคล็ดลับทั่วไป

- เริ่มแต่ละระยะด้วย **Plan mode** (กด `Shift+Tab` จนขึ้น plan mode) ให้ Claude วางแผนก่อน ตรวจแผนแล้วจึงอนุมัติ
- หลังจบแต่ละระยะ สั่ง `/verify` (skill ตรวจงาน) แล้ว commit
- ถ้าบทสนทนายาวมาก ใช้ `/clear` ระหว่างระยะ — ความรู้ของโปรเจคอยู่ใน `CLAUDE.md` และ `docs/` อยู่แล้ว
- เก็บ `reference/prototype-v3.html` ไว้ตลอด เป็นสเปกพฤติกรรมของเครื่องยนต์

---

## P0 · ตั้งต้น monorepo

```text
อ่าน CLAUDE.md, docs/01-blueprint.md, docs/00-folder-structure.md และ docs/03-architecture.md
แล้วสร้างโครง monorepo ตาม 00-folder-structure.md:
- pnpm workspace: packages/engine, apps/web (Vite + React 18 + TS) — ไม่มี backend
- TypeScript strict, ESLint + Prettier, Vitest ทุกแพ็กเกจ, Playwright ที่ root
- สคริปต์ root: dev, build, preview, test, test:e2e, lint, typecheck, golden:update, golden:diff, fixtures:synthetic
- GitHub Actions ตาม docs/12-deployment.md (job check รวม node --test reference/sgp-reference.test.mjs และ job e2e)
- apps/web/src/config/env.ts ตาม docs/12 ข้อ 6.2 ครอบคลุมทุกตัวแปรใน .env.example, vite.config.ts ตั้ง envDir เป็นราก,
  .env.production ที่ปิดดีบัก และ test ตรวจว่าทุก VITE_* ใน .env.example มีใน schema ของ env.ts
ยังไม่ต้องเขียนฟีเจอร์ ให้แต่ละแพ็กเกจมี test ตัวอย่าง 1 ตัวที่ผ่าน
เกณฑ์ผ่าน: pnpm install && pnpm lint && pnpm typecheck && pnpm test ผ่านทั้งหมด
```

## P1 · เครื่องยนต์ CPU

```text
ใช้ skill grading-engine
1) สร้าง packages/engine/src/schema.ts จาก seed/parameter-schema.json ตาม docs/05-parameter-schema.md
   (PARAMS as const, ParamKey, Params, DEFAULT_PARAMS, SCHEMA_VERSION=3, clamp, zod ParamsSchema)
2) พอร์ตฟังก์ชัน detail(), grayWorld(), grade() จาก reference/prototype-v3.html
   ไปเป็น src/cpu/detail.ts, src/stats/grayWorld.ts, src/cpu/grade.ts ให้ตรงกับ docs/04-grading-engine-spec.md ทุกขั้น
   ห้ามใช้ตัวแปร global (WBG) ให้รับ GradeContext แทน
3) presets.ts โหลด seed/builtin-presets.json, migrate.ts ตาม docs/07 ข้อ 4
4) tests: identity, extremes, tiling, bw, migrate และ golden (ภาพสังเคราะห์ก่อน)
5) สคริปต์ของแพ็กเกจ engine: export-schema (เขียน seed/parameter-schema.json จาก schema.ts)
   และ render-preset <id> (เรนเดอร์พรีเซ็ตกับภาพใน tests/fixtures/images ลง tests/golden/_preview)
เกณฑ์ผ่าน: invariants I1–I4, I7 ผ่าน และผลของ grade() เท่ากับต้นแบบบนภาพสังเคราะห์ทุกพิกเซล
เมื่อ amount=100 หรือ sharpen=denoise=0 (ขั้น mix ต่างจากต้นแบบโดยตั้งใจ ดู docs/04 ข้อ 2.10)
```

## P2 · เครื่องยนต์ GPU (WebGL2)

```text
ใช้ skill grading-engine
สร้าง packages/engine/src/gl/ ตาม docs/03 ข้อ 2.2: renderer.ts, shaders/detail.frag, shaders/grade.frag, uniforms.ts, tiles.ts
- uniform สร้างจาก schema อัตโนมัติ
- fallback ไป CPU worker เมื่อไม่มี WebGL2 หรือ context lost
- parity test ด้วย Playwright (Chromium swiftshader): max diff ≤ 2/255 เมื่อ grain=0 ทุกพรีเซ็ตในตัว
- benchmark พรีวิว 2048 px
- ตรวจ EXT_color_buffer_float ก่อนใช้ FBO RGBA16F ถ้าไม่มีให้ fallback ไป CPU worker
เกณฑ์ผ่าน: parity ผ่าน และพรีวิว ≥ 30 fps บนเครื่องพัฒนา
```

## P3 · ตัวแก้ไขภาพ (UI)

```text
ใช้ skill thai-ui
สร้าง apps/web ตาม docs/08-ui-ux-spec.md:
- layout 3 คอลัมน์ responsive, design tokens, ฟอนต์ self-host (Anuphan, IBM Plex Sans Thai, IBM Plex Mono)
- features/stage: Canvas + CompareSlider + ZoomPan + Histogram
- features/controls: ParamGroup/ParamSlider/HueSlider สร้างจาก schema
- store/editorStore.ts (Zustand) พร้อม undo/redo 50 ขั้น
- เปิดภาพ (ปุ่ม, ลากวาง, วาง), ภาพตัวอย่างตอนเปิดครั้งแรก, ทางลัดคีย์บอร์ด
- i18n th.json ทุกข้อความ
เกณฑ์ผ่าน: e2e "เปิดภาพ → เลือกพรีเซ็ต → ปรับแถบ → เห็นผล" ผ่านทั้ง desktop และ 360 px
```

## P4 · คลังพร้อมต์

```text
ทำ docs/07-data-model-storage.md ทั้งหมด:
- storage/db.ts (Dexie), libraryStore.ts, features/library
- CRUD + ทำสำเนา + ลบแบบยืนยันในแถว + ค้นหา/แท็ก
- นำเข้า/ส่งออก JSON รวมรูปแบบต้นแบบ "kreadsi-prompts"
- เตือนเมื่อมีค่าที่ยังไม่บันทึก
เกณฑ์ผ่าน: unit test libraryFile + e2e สร้าง-รีโหลด-ยังอยู่ + นำเข้าไฟล์ตัวอย่างใน tests/fixtures/library/
```

## P5 · พร้อมต์แบบโครงสร้าง (SGP)

```text
ใช้ skill structured-prompt
อ่าน docs/06-structured-prompt-format.md และ docs/09-file-formats.md
1) พอร์ต reference/sgp-reference.mjs เป็น packages/engine/src/sgp/ (vocabulary.ts, parse.ts, serialize.ts,
   suggest.ts, template.ts) เป็น TypeScript strict โดยคำศัพท์โหลดจาก seed/sgp-vocabulary.json
2) packages/engine/test/sgp.test.ts: พอร์ตทุกเคสจาก reference/sgp-reference.test.mjs โดยไม่แก้ค่าที่คาดหวัง
   + fuzz (fast-check) + benchmark 2,000 บรรทัด < 20 ms
3) apps/web/features/prompt-editor: PromptEditor (CodeMirror 6, ไฮไลต์ไวยากรณ์, คำเตือนรายบรรทัด,
   autocomplete), WarningList, AttachButton, TemplateButton, ChatBridgeDialog (ใช้ seed/sgp-bridge-instruction.md), NotesPanel
4) ซิงก์ข้อความ ↔ แถบเลื่อน ตาม docs/03 ข้อ 3
5) services/promptFiles.ts: แนบ/ส่งออก .sgp.txt, ลากวางหลายไฟล์เข้าคลัง
6) ตรวจว่า CodeMirror แสดงผลถูกต้องภายใต้ CSP ใน docs/11 (style-src 'self') ถ้าถูกบล็อกให้รายงานก่อนแก้ CSP
เกณฑ์ผ่าน: sgp.test.ts ผ่านทั้งหมด, แนบไฟล์ทั้ง 6 ใน seed/structured-prompts/ ได้ค่าตรงกับ builtin-presets.json,
e2e วางคำตอบที่มีรั้วโค้ดแล้วพรีวิวเปลี่ยน, ไม่มี network request ออกนอก origin
```

## P6 · ส่งออกความละเอียดเต็ม

```text
features/export + services/imageIO.ts:
- GPU tiled export, fallback CPU worker แบบ strip ที่มี padding 1 แถวสำหรับ detail
- JPEG/PNG/WebP, คุณภาพ, คัดลอก EXIF (ตัด orientation, ตัด GPS ตามตัวเลือก)
- ความคืบหน้า + ยกเลิก
เกณฑ์ผ่าน: ภาพ 48 MP ส่งออกได้ไม่ crash, ขนาดเท่าต้นฉบับ, tiling test ผ่าน
```

## P7 · PWA และขัดเกลา

```text
- vite-plugin-pwa: ใช้งานออฟไลน์ได้ทุกฟีเจอร์ (ปิดเครือข่ายแล้วทดสอบครบทุกขั้น)
- ตรวจ a11y ตาม docs/08 ข้อ 6, Lighthouse ≥ 95
- ตรวจภาพหน้าจอธีมสว่าง/มืด, 360/820/1440 px
เกณฑ์ผ่าน: /verify ผ่านทุกข้อ
```

## P8 · Deploy

```text
ใช้ skill release
ตั้งค่าโฮสต์ static ตาม docs/12 ทางเลือก A (Cloudflare Pages) หรือ B (GitHub Pages) พร้อม CSP header แล้วทำ checklist ก่อน release
```

---

## คำสั่งที่ใช้บ่อยหลังโปรเจคเสร็จ

| ต้องการ | พิมพ์ใน Claude Code |
|---|---|
| เพิ่มพรีเซ็ตจากพร้อมต์ใหม่ | `/add-preset <วางพร้อมต์อิสระหรือแบบโครงสร้าง>` |
| เพิ่มคำศัพท์ให้ตัวอ่าน (เช่นคำที่ผู้ใช้ชอบเขียน) | `/add-vocabulary "ฉ่ำ" = ความอิ่มสี บวก ชัด` |
| เพิ่มแถบเลื่อนใหม่ | `/add-parameter clarity — ความคมระดับกลาง รัศมีใหญ่` |
| ตรวจงานก่อน commit | `/verify` |
| ปล่อยเวอร์ชันใหม่ | `/release` |
