# 03 · สถาปัตยกรรมเชิงลึก

## 1. Monorepo

ใช้ **pnpm workspaces** แยกเป็น 2 แพ็กเกจ เพื่อให้เครื่องยนต์และตัวอ่านพร้อมต์ทดสอบได้อิสระจาก UI (และนำไปใช้ซ้ำในแอปเดสก์ท็อปหรือ CLI ได้ภายหลัง)

```
packages/engine   ← ไม่มี dependency กับ React/DOM ยกเว้นโมดูล gl/ ที่ต้องใช้ WebGL2
apps/web          ← import @prompt-grader/engine
```

ไม่มีแพ็กเกจเซิร์ฟเวอร์ แอปเป็น static site ทั้งหมด

กฎ dependency (ตรวจด้วย `eslint-plugin-boundaries` หรือ `dependency-cruiser`):
- `engine/schema` ← ใช้ได้ทุกที่
- `engine/cpu`, `engine/stats` ← ห้าม import `gl/`
- `engine/gl` ← import `schema` ได้
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
    template.ts        แม่แบบทุกหัวข้อ, buildBridgeInstruction(freeText)
  migrate.ts           migrateParams(params, fromVersion) → params ปัจจุบัน
  math.ts              smoothstep, hueOffset(), hash2() — ใช้ร่วม CPU/อ้างอิงใน GLSL
  stats/
    grayWorld.ts       คำนวณ WB gains จากภาพย่อ
    histogram.ts       histogram 256 bins × 4 ช่อง
  cpu/
    detail.ts          denoise + sharpen 3×3 (แบบ strip ที่มี padding)
    grade.ts           gradePixels(orig, src, dst, w, rows, y0, W, H, params, ctx)
                       (orig = ก่อน detail ใช้กับ mix, src = หลัง detail)
    worker.ts          Worker entry: รับ ImageData strip → คืนผล
  gl/
    renderer.ts        class GradeRenderer { setImage(), setParams(), render(), exportTiles() }
    shaders/
      fullscreen.vert
      detail.frag      pass 1
      grade.frag       pass 2 (uniform ต่อพารามิเตอร์ทั้งหมด)
    uniforms.ts        แมป params → uniform values (สร้างจาก schema อัตโนมัติ)
    tiles.ts           วางแผนไทล์ + ขอบซ้อน
  index.ts
test/
  identity, extremes, tiling, bw, clamp, migrate, golden .test.ts
  sgp.test.ts          พอร์ตทุกเคสจาก reference/sgp-reference.test.mjs + เคสเพิ่ม
```

### 2.1 สัญญาของเครื่องยนต์ (Engine contract)

```ts
type Params = Record<ParamKey, number>;            // จำนวนเต็มตาม schema
interface GradeContext {                           // ค่าที่คำนวณต่อภาพ ไม่ใช่ต่อพารามิเตอร์
  wbGains: [number, number, number];               // จาก grayWorld (ใช้กับ castFix)
  fullWidth: number; fullHeight: number;           // ใช้กับ haze/vignette ตามตำแหน่งจริง
}
interface Renderer {
  setImage(bitmap: ImageBitmap, ctx: GradeContext): void;
  setParams(p: Params): void;                      // re-render แบบ rAF throttle
  readPreview(): ImageBitmap;
  exportFull(opts: {type: 'image/jpeg'|'image/png'|'image/webp'; quality?: number;
                    onProgress?: (0..1) => void; signal?: AbortSignal}): Promise<Blob>;
}
```

### 2.2 กลยุทธ์ GPU

- Texture ต้นฉบับ: RGBA8 sRGB → คำนวณใน float32 ใน shader
- Pass 1 `detail.frag` → FBO RGBA16F (ข้ามเมื่อ sharpen = denoise = 0)
- Pass 2 `grade.frag` → canvas หรือ FBO สำหรับไทล์ (อ่านผล pass 1 และ texture ต้นฉบับสำหรับขั้น mix)
- พรีวิว: ย่อภาพเป็น ≤ 2048 px ตอน `setImage`
- ส่งออก: ไทล์ขนาด min(MAX_TEXTURE_SIZE, 4096) ขอบซ้อน 2 px, `readPixels` ทีละไทล์ลง `OffscreenCanvas` ขนาดจริง
- ตรวจ `WEBGL_lose_context` / context lost → สลับไป CPU worker

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
    imageIO.ts                    ← decode, encode, EXIF copy
    promptFiles.ts                ← อ่าน/เขียน .sgp.txt, ตรวจ UTF-8 และขนาด
    clipboard.ts                  ← คัดลอกคำสั่งสำหรับแชต, คัดลอกพร้อมต์
  features/
    stage/  (Canvas, CompareSlider, ZoomPan, Histogram)
    controls/ (ParamGroup, ParamSlider, HueSlider — สร้างจาก schema)
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
- **การซิงก์ข้อความ ↔ แถบเลื่อน:** store เก็บ `params` เป็นความจริง; แก้ข้อความ → parse → `params`; แก้แถบเลื่อน → `params` → serialize แทนที่ส่วนการตั้งค่าของข้อความ (คงบรรทัดข้อมูลกำกับ, `[หมายเหตุ]`, `[ห้ามเปลี่ยน]`) ป้องกันวนซ้ำด้วย flag แหล่งที่มาของการเปลี่ยนแปลง

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
