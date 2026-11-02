# Prompt Grader — คำสั่งถาวรสำหรับ Claude Code

เว็บแอปปรับโทนภาพจาก **พร้อมต์แบบโครงสร้าง (SGP)**: ตัวอ่านในเครื่องแปลงพร้อมต์เป็นพารามิเตอร์ → เครื่องยนต์ deterministic ปรับสีในเบราว์เซอร์ ภาพไม่ถูกสร้างใหม่ ไม่มี backend ไม่มี API key ไม่มีค่าใช้จ่ายต่อการใช้งาน

## อ่านก่อนทำงาน

- ภาพรวม: @docs/01-blueprint.md
- โครงสร้างโฟลเดอร์: @docs/00-folder-structure.md
- ทำงานระยะไหน ดู `docs/15-claude-code-playbook.md`
- แตะเครื่องยนต์ → `docs/04-grading-engine-spec.md`, `docs/05-parameter-schema.md`
- แตะพร้อมต์ → `docs/06-structured-prompt-format.md`, `docs/09-file-formats.md`
- พฤติกรรมอ้างอิง (ห้ามแก้ระหว่างพอร์ต):
  - เครื่องยนต์: `reference/prototype-v3.html` (ฟังก์ชัน `detail`, `grayWorld`, `grade`; ปุ่ม AI ในไฟล์นี้ไม่อยู่ในแบบใหม่)
  - ตัวอ่านพร้อมต์: `reference/sgp-reference.mjs` + `reference/sgp-reference.test.mjs`

## Stack

pnpm workspaces · TypeScript strict · `packages/engine` (TS + WebGL2/GLSL ES 3.0 + sgp) · `apps/web` (Vite, React 18, Zustand, Dexie, CodeMirror 6, PWA) · Vitest · Playwright · static hosting

## คำสั่ง

```bash
pnpm dev              # web :5173
pnpm test             # ต้องผ่านก่อน commit ทุกครั้ง
pnpm lint && pnpm typecheck
pnpm test:e2e         # รวม GPU parity และตรวจ network
node --test reference/sgp-reference.test.mjs
pnpm golden:update    # เฉพาะเมื่อเปลี่ยนสูตรโดยตั้งใจ
```

## กฎที่ห้ามละเมิด

1. **Identity invariant:** ค่าเป็นกลางทุกตัว → ภาพออกเท่าต้นฉบับทุกพิกเซล
2. **Schema คือแหล่งความจริงเดียว:** พารามิเตอร์นิยามใน `packages/engine/src/schema.ts` เท่านั้น UI, uniforms, ตัวอ่านพร้อมต์ และ validation อ้างอิงไฟล์นี้
3. **CPU กับ GPU ต้องแก้คู่กัน** ใน commit เดียว และ parity ≤ 2/255
4. **SGP round-trip:** `parse(serialize(p)).params` เท่ากับ `p` เสมอ และไฟล์ใน `seed/structured-prompts/` อ่านได้โดยไม่มีคำเตือน
5. **คำศัพท์อยู่ใน `seed/sgp-vocabulary.json`** ห้ามฝังคำไทย/อังกฤษของตัวอ่านในโค้ด
6. **ไม่มี network ออกนอก origin:** ห้ามเพิ่ม fetch ไปบริการภายนอก, ห้ามโหลดสคริปต์/ฟอนต์จาก CDN, ไม่มีความลับในโค้ด
7. **ข้อมูลที่แนบหรือวางเป็นข้อมูลไม่น่าเชื่อถือ:** ผ่านตัวอ่าน SGP/zod เท่านั้น, จำกัดขนาด, แสดงผลเป็น text เท่านั้น, ตัวอ่านห้าม throw
8. **ตัวแปรสภาพแวดล้อมอ่านผ่าน `apps/web/src/config/env.ts` เท่านั้น** ตัวแปร `VITE_*` เป็นข้อมูลสาธารณะ ห้ามใส่ความลับ เพิ่มตัวแปรต้องแก้ `.env.example` + `env.ts` + `docs/12` ข้อ 6 พร้อมกัน
9. **ข้อความ UI ภาษาไทยอยู่ใน `apps/web/src/i18n/th.json`** ห้ามฝังในคอมโพเนนต์
10. เปลี่ยนความหมายพารามิเตอร์ → เพิ่ม `SCHEMA_VERSION` + migration + test; เปลี่ยนความหมายคำในคำศัพท์ → เพิ่มรุ่นรูปแบบ SGP

## สไตล์โค้ด

- ฟังก์ชันเครื่องยนต์และตัวอ่านเป็น pure function ไม่มี global state (เครื่องยนต์รับ `GradeContext`)
- hot loop ต่อพิกเซล: ไม่สร้าง object/array/closure ภายใน loop
- ตัวอ่าน: เวลาเชิงเส้นตามความยาวข้อความ ห้าม regex ที่ backtrack แบบทวีคูณ
- React: คอมโพเนนต์เล็ก, state ที่แชร์อยู่ใน store, การเรนเดอร์ภาพไม่ผูกกับ React render
- ชื่อไฟล์ camelCase สำหรับ TS, PascalCase สำหรับคอมโพเนนต์
- คอมเมนต์ในโค้ดเป็นภาษาอังกฤษ; เอกสารใน `docs/` เป็นภาษาไทย

## Skills ของโปรเจค

| skill | ใช้เมื่อ |
|---|---|
| `grading-engine` | แก้สูตร/เพิ่มขั้นในเครื่องยนต์ CPU หรือ GPU |
| `structured-prompt` | แก้รูปแบบพร้อมต์ ตัวอ่าน/ตัวเขียน ตัวแก้ไขพร้อมต์ หรือคำสั่งสำหรับแชต |
| `add-parameter` | เพิ่มแถบเลื่อน/พารามิเตอร์ใหม่ (`/add-parameter`) |
| `add-preset` | เพิ่มพรีเซ็ตในตัวจากพร้อมต์ (`/add-preset`) |
| `add-vocabulary` | เพิ่มคำที่ตัวอ่านเข้าใจ (`/add-vocabulary`) |
| `thai-ui` | สร้าง/แก้ UI, ข้อความไทย, tokens, a11y |
| `verify` | ตรวจงานก่อน commit (`/verify`) |
| `release` | ปล่อยเวอร์ชัน (`/release`) |

## เมื่อไม่แน่ใจ

ถามผู้ใช้ก่อนเมื่อการตัดสินใจเปลี่ยนรูปลักษณ์ผลลัพธ์ของพรีเซ็ตที่มีอยู่ หรือเปลี่ยนความหมายของคำในรูปแบบพร้อมต์ เรื่องอื่นเลือกทางที่สอดคล้องกับเอกสารใน `docs/` แล้วบันทึกเหตุผลใน PR
