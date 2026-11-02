# 10 · กลยุทธ์การทดสอบ

## 1. ชั้นการทดสอบ

| ชั้น | เครื่องมือ | ครอบคลุม | รันเมื่อ |
|---|---|---|---|
| Unit | Vitest | schema, clamp, migrate, math, gray-world, histogram, libraryFile, promptFiles | ทุก commit |
| SGP | Vitest | ทุกเคสจาก `reference/sgp-reference.test.mjs`, round-trip ทุกพรีเซ็ต, ไฟล์ใน `seed/structured-prompts/`, fuzz (ข้อความสุ่ม/ไบนารี ต้องไม่ throw และค่าอยู่ในช่วงเสมอ), benchmark 2,000 บรรทัด < 20 ms | ทุก commit |
| Engine invariants | Vitest | I1–I4, I7 จาก `04-grading-engine-spec.md` บนภาพสังเคราะห์ | ทุก commit |
| Golden images | Vitest + `pngjs` | พรีเซ็ตในตัว × ภาพทดสอบ → เทียบ PSNR ≥ 45 dB | ทุก commit |
| GPU parity | Playwright (Chromium, `--use-angle=swiftshader`) | I5 (พรีเซ็ต, ค่าสุดขั้ว, ค่าสุ่ม), ไทล์, ทิศภาพบน canvas, CPU fallback, context lost | ทุก PR |
| GPU จริง | Playwright, `E2E_SWIFTSHADER=false pnpm test:e2e -- parity benchmark` | I5 บนฮาร์ดแวร์จริง และ NFR-01 พรีวิว 2048 px ≥ 30 fps (บน swiftshader แค่รายงานตัวเลข) CI ไม่มี GPU จึงต้องรันบนเครื่องจริง เคยจับบั๊กการปัดเศษที่ swiftshader ไม่แสดง | ก่อน release |
| Component | Vitest + Testing Library | ParamSlider, PromptItem, ImportExport, PromptEditor (คำเตือน, ซิงก์กับแถบเลื่อน), ChatBridgeDialog | ทุก commit |
| ออฟไลน์ | Playwright (`offline.spec.ts`) | ปิดเครือข่ายแล้วเปิดภาพ ปรับ ใช้พร้อมต์ บันทึก ส่งออก ครบทุกขั้น และตรวจ manifest | ทุก PR |
| การเข้าถึง | Playwright + axe-core (`a11y.spec.ts`) | WCAG 2.1 AA ทุกแผงและหน้าต่าง ทั้งสองธีมที่ 360/1440 px, ลำดับคีย์บอร์ด, focus | ทุก PR |
| Lighthouse | `lighthouse --port` ต่อกับ browser ของ Playwright บน `pnpm preview` | accessibility ≥ 95 (ล่าสุด 100 ทั้งมือถือและ desktop) | ก่อน release |
| E2E | Playwright | เปิดภาพ → เลือกพรีเซ็ต → ปรับ → บันทึกพร้อมต์ → ส่งออก; แนบ `.sgp.txt` → พรีวิวเปลี่ยน; วางคำตอบจากแชต (มีรั้วโค้ด); มือถือ 360 px; ตรวจว่าไม่มี request ออกนอก origin | ทุก PR |

## 2. ภาพทดสอบ (`tests/fixtures/images/`)

ใช้ภาพที่มีสิทธิ์ใช้งาน (ถ่ายเองหรือ CC0) ขนาดย่อ 1024 px:

| ไฟล์ | เนื้อหา | ใช้ทดสอบ |
|---|---|---|
| `landscape-01.jpg` | ทุ่งนา ภูเขา ท้องฟ้า | ใบไม้, หมอก, split tone |
| `portrait-01.jpg` | ภาพบุคคลแสงในอาคาร โทนเขียว/เหลือง | castFix, skin, sharpen |
| `night-01.jpg` | ภาพกลางคืน มีจุดรบกวน | denoise, shadows |
| `synthetic-ramps.png` | สร้างด้วยสคริปต์: ramp สีเทา, วงล้อสี, ช่องสีตัด | identity, hue bands, extremes |

`pnpm fixtures:synthetic` สร้าง `synthetic-ramps.png` ใหม่ได้ทุกเมื่อ (deterministic)

ตอนนี้ golden อ่านเฉพาะไฟล์ `.png` เมื่อเพิ่มภาพถ่าย `.jpg` ต้องเพิ่มตัวถอดรหัส JPEG ใน `test/support/images.ts` ด้วย

## 3. Golden workflow

```
pnpm golden:update   # สร้างภาพอ้างอิงใหม่ใน tests/golden/ (ใช้ CPU engine)
pnpm golden:diff     # สร้าง tests/golden/_diff/*.png (ก่อน|หลัง|ส่วนต่าง×8) สำหรับแนบ PR
```

อัปเดต golden ได้เฉพาะเมื่อเปลี่ยนสูตรโดยตั้งใจ และ PR ต้องแนบภาพ diff

## 4. ชุดทดสอบ SGP

- **แหล่งเคส:** `reference/sgp-reference.test.mjs` คือเกณฑ์ยอมรับของ port — คัดลอกทุกเคสเป็น `packages/engine/test/sgp.test.ts` แล้วต้องผ่านโดยไม่แก้ค่าที่คาดหวัง
- **round-trip:** `parse(serialize(p))` เท่ากับ `p` สำหรับพรีเซ็ตในตัวทุกตัว และสำหรับ params สุ่ม 1,000 ชุด (property-based ด้วย `fast-check`)
- **คำศัพท์:** test ตรวจว่าไม่มีคำซ้ำข้ามหมวดที่ทำให้ความหมายกำกวม (เช่นคำเดียวกันเป็นทั้งทิศบวกและทิศลบของพารามิเตอร์เดียว) และทุก key ใน schema มีหัวข้อใน vocabulary
- **ตัวอย่างจากผู้ใช้:** เมื่อผู้ใช้รายงานว่าพร้อมต์อ่านผิด ให้เพิ่มข้อความนั้นเป็นเคสใน `tests/fixtures/sgp/` พร้อมค่าที่คาดหวังก่อนแก้

## 5. ความหมายของ "เสร็จ" (Definition of Done)

- [ ] `pnpm lint && pnpm typecheck && pnpm test` ผ่าน
- [ ] ถ้าแตะเครื่องยนต์: golden + parity ผ่าน, เอกสาร 04/05 อัปเดต
- [ ] ถ้าแตะ UI: ตรวจภาพหน้าจอธีมสว่าง/มืด และความกว้าง 360 px
- [ ] ถ้าแตะ `sgp/` หรือ `sgp-vocabulary.json`: SGP tests + round-trip ผ่าน และ `06-structured-prompt-format.md` อัปเดต
- [ ] ไม่มีข้อความ UI ภาษาไทยฝังในโค้ด (ใช้ i18n key)
