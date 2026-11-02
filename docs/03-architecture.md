# 03 · สถาปัตยกรรมเชิงลึก

## 1. Monorepo

ใช้ **pnpm workspaces** แยกเป็น 2 แพ็กเกจ เพื่อให้เครื่องยนต์และตัวอ่านพร้อมต์ทดสอบได้อิสระจาก UI (และนำไปใช้ซ้ำในแอปเดสก์ท็อปหรือ CLI ได้ภายหลัง)

```
packages/engine   ← ไม่มี dependency กับ React/DOM ยกเว้นโมดูล gl/ ที่ต้องใช้ WebGL2
apps/web          ← import @prompt-grader/engine
```

ไม่มีแพ็กเกจเซิร์ฟเวอร์ แอปเป็น static site ทั้งหมด

กฎ dependency (ตรวจด้วย `no-restricted-imports` ของ ESLint ใน `eslint.config.mjs`):
- `engine/schema` ← ใช้ได้ทุกที่
- `engine/cpu`, `engine/stats` ← ห้าม import `gl/`
- `engine/gl` ← import `schema` ได้ ห้าม import `cpu/` (ใช้ร่วมกันผ่าน `types.ts`; `createRenderer.ts` เป็นจุดเดียวที่รู้จักทั้งสอง backend)
- `engine/sgp` ← import ได้เฉพาะ `schema` (ห้ามแตะ DOM, cpu, gl)
- `apps/web/features/*` ← ห้าม import ข้าม feature โดยตรง ให้ผ่าน `store/` หรือ `shared/`

## 2. packages/engine

```
src/
  schema.ts            PARAMS (as const), types, DEFAULT_PARAMS, clamp(), zod ParamsSchema
  presets.ts           BUILTIN_PRESETS (นำเข้าจาก seed/builtin-presets.json)
  sgp/
    vocabulary.ts      โหลด + ทำดัชนี seed/sgp-vocabulary.json (normalize, เรียงคำยาวก่อน)
    parse.ts           parseSGP(text) → {params, name, tags, notes, preserve, warnings, matched}
    serialize.ts       serializeSGP(preset) → text (round-trip กับ parse)
    suggest.ts         แนะนำหัวข้อที่สะกดใกล้เคียง (Levenshtein บนคำที่ normalize แล้ว)
    template.ts        แม่แบบทุกหัวข้อ, buildBridgeInstruction(template, freeText)
  migrate.ts           migrateParams(params, fromVersion) → params ปัจจุบัน
  math.ts              smoothstep, hueOffset(), hash2() — ใช้ร่วม CPU/อ้างอิงใน GLSL
  stats/
    grayWorld.ts       คำนวณ WB gains จากภาพย่อ
    histogram.ts       histogram 256 bins × 4 ช่อง
  cpu/
    detail.ts          denoise + sharpen 3×3 (แบบ strip ที่มี padding)
    grade.ts           gradePixels(orig, src, dst, w, rows, y0, params, ctx)
                       (orig = ก่อน detail ใช้กับ mix, src = หลัง detail, ขนาดภาพเต็มอยู่ใน ctx)
                       gradeImage(src, w, h, params, ctx, stripRows) รวม detail + grade ทีละแถบ
    worker.ts          Worker entry: เก็บภาพไว้ แล้วเกรดทุกครั้งที่ได้ params ใหม่
    cpuRenderer.ts     Renderer สำรอง: ส่งงานให้ worker แล้ววาดด้วย putImageData
  createRenderer.ts    เลือก backend (import ผ่าน @prompt-grader/engine/renderer)
  exportGrader.ts      เกรดภาพเต็มทีละชิ้น ทั้งแบบ GPU และ CPU
  tiles.ts             วางแผนไทล์และแถบ + ขอบซ้อน
  types.ts             GradeContext, RawImage, Renderer
  gl/
    renderer.ts        class GradeRenderer { setImage(), setParams(), render(), readPixels(), renderTiles() }
    shaders/
      fullscreen.vert
      detail.frag      pass 1
      grade.frag       pass 2 (uniform ต่อพารามิเตอร์ทั้งหมด)
    uniforms.ts        แมป params → uniform values (สร้างจาก schema อัตโนมัติ)
  index.ts
test/
  identity, extremes, tiling, bw, schema, migrate, prototype, golden .test.ts
  support/             ภาพสังเคราะห์, อ่าน/เขียน PNG, ตัวโหลดต้นแบบ (ใช้ร่วมกับ scripts/)
  (prototype.test.ts รันโค้ดจริงจาก reference/prototype-v3.html แล้วเทียบทุกพิกเซล)
  sgp.test.ts          พอร์ตทุกเคสจาก reference/sgp-reference.test.mjs + เคสเพิ่ม
```

### 2.1 สัญญาของเครื่องยนต์ (Engine contract)

```ts
type Params = Record<ParamKey, number>;            // จำนวนเต็มตาม schema
interface GradeContext {                           // ค่าที่คำนวณต่อภาพ ไม่ใช่ต่อพารามิเตอร์
  wbGains: [number, number, number];               // จาก grayWorld (ใช้กับ castFix)
  fullWidth: number; fullHeight: number;           // ใช้กับ haze/vignette ตามตำแหน่งจริง
}
interface RawImage { data: Uint8ClampedArray; width: number; height: number }  // RGBA, แถวบนก่อน
interface Renderer {
  readonly backend: 'webgl2' | 'cpu';
  setImage(image: RawImage, ctx: GradeContext): void;   // ผู้เรียกย่อภาพพรีวิวมาก่อน
  setParams(p: Params): void;                      // re-render แบบ rAF throttle
  render(): Promise<void>;                         // เสร็จเมื่อค่าปัจจุบันอยู่บน canvas แล้ว
  dispose(): void;
}
```

### 2.2 กลยุทธ์ GPU

- Texture ต้นฉบับ: RGBA8 ค่าดิบ ไม่แปลง sRGB → คำนวณใน float32 ใน shader
- Pass 1 `detail.frag` → FBO RGBA8 (ข้ามเมื่อ sharpen = denoise = 0) ตั้งใจให้เป็น 8 บิตเหมือนฝั่ง CPU จึงไม่ต้องใช้ `EXT_color_buffer_float`
- Pass 2 `grade.frag` → canvas หรือ FBO สำหรับไทล์ (อ่านผล pass 1 และ texture ต้นฉบับสำหรับขั้น mix)
- พรีวิว: ผู้เรียกย่อภาพเป็น ≤ 2048 px ก่อนส่งเข้า `setImage` เพราะต้องใช้พิกเซลชุดนี้คำนวณ gray-world อยู่แล้ว
- ส่งออก (`exportGrader.ts`): ไทล์ขนาด min(MAX_TEXTURE_SIZE, 4096) ขอบซ้อน 2 px ผ่าน `gradeTile()` อ่านภาพจาก `ImageBitmap` ทีละไทล์เพื่อไม่ถือภาพเต็มสองชุด แล้วเขียนลง `OffscreenCanvas` ขนาดจริง ถ้าไม่มี GPU หรือ GPU หายกลางทาง ใช้แถบ 256 แถวใน Worker แทน
- ไม่มี WebGL2 → `createRenderer` คืน CPU renderer
- context lost → เรียก `onContextLost` ผู้เรียกต้องสร้าง canvas ใหม่ แล้วเรียก `createRenderer` ด้วย `forceCpu` เพราะ canvas ที่เคยมี WebGL context ใช้ 2D ไม่ได้

## 3. apps/web

```
src/
  main.tsx, App.tsx
  i18n/th.json, en.json
  theme/tokens.css                ← design tokens (ดู 08-ui-ux-spec.md)
  store/
    editorStore.ts                ← image, params, history(undo/redo), compareMode, dirty
    libraryStore.ts               ← prompts, selection, search
  storage/
    db.ts                         ← Dexie: prompts, settings
    libraryFile.ts                ← export/import JSON + validation
  services/
    imageIO.ts                    ← decode, ย่อภาพพรีวิว
    exportImage.ts, exif.ts       ← ส่งออกความละเอียดเต็ม, คัดลอก EXIF
    promptFiles.ts                ← อ่าน/เขียน .sgp.txt, ตรวจ UTF-8 และขนาด
    clipboard.ts                  ← คัดลอกคำสั่งสำหรับแชต, คัดลอกพร้อมต์
  features/
    stage/  (Stage, CompareSlider, Histogram, useRenderer)
    controls/ (Controls, ParamGroup, ParamSlider — สร้างจาก schema, แถบสีใช้ kind: 'hue')
    library/ (LibraryPanel, PromptItem, ImportExport)
    prompt-editor/ (PromptEditor: CodeMirror 6 + ไฮไลต์ไวยากรณ์ SGP + คำเตือนรายบรรทัด,
                    AttachButton, TemplateButton, ChatBridgeDialog, NotesPanel)
    export/ (ExportDialog, Progress)
  shared/ (Button, Dialog, Toast, useHotkeys)
```

หลักการ:
- UI แถบเลื่อน **สร้างจาก schema** ห้ามเขียนแถบเลื่อนด้วยมือทีละตัว
- state ของ params เป็น object เดียว เปลี่ยนแบบ immutable เพื่อทำ undo ได้ง่าย
- การเรนเดอร์ไม่ผูกกับ React render cycle: store subscribe → renderer.setParams()
- **การซิงก์ข้อความ ↔ แถบเลื่อน (`services/promptSync.ts`):** store เก็บ `params` เป็นความจริง; แก้ข้อความ → parse → `params`; แก้แถบเลื่อน → `params` → serialize เขียนข้อความใหม่ทั้งหมด โดยคงชื่อ, แท็ก, `[หมายเหตุ]`, `[ห้ามเปลี่ยน]` ส่วนคอมเมนต์ `//` และลำดับบรรทัดที่ผู้ใช้จัดเองจะหายไป ป้องกันวนซ้ำด้วย flag แหล่งที่มาของการเปลี่ยนแปลง

## 4. ไม่มี backend

การแปลงพร้อมต์ทำในเครื่องด้วย `engine/sgp` ทั้งหมด ไม่มีความลับ ไม่มีค่าใช้จ่ายต่อการใช้งาน หากอนาคตต้องการแปลงพร้อมต์อิสระอัตโนมัติ ให้เพิ่มเป็นโมดูลเสริมตาม roadmap R0 โดยต้องให้ผลลัพธ์เป็น **ข้อความ SGP** แล้วผ่านตัวอ่านเดียวกัน

## 5. การตัดสินใจสำคัญ (ดู `adr/`)

| ADR | การตัดสินใจ |
|---|---|
| 0001 | ใช้เครื่องยนต์ deterministic แทนโมเดลสร้างภาพ |
| 0002 | WebGL2 เป็นหลัก, CPU เป็นอ้างอิงและ fallback |
| 0003 | ~~Claude ผ่าน API ฝั่งเซิร์ฟเวอร์~~ — ถูกแทนที่โดย 0005 |
| 0004 | local-first ด้วย IndexedDB, ซิงก์คลาวด์เป็นงานต่อยอด |
| 0005 | พร้อมต์แบบโครงสร้าง (SGP) อ่านในเครื่องแทนการเรียก API |
