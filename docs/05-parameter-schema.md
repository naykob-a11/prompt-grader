# 05 · Parameter Schema

> แหล่งความจริงเดียวของพารามิเตอร์ทั้งหมด ไฟล์ข้อมูลตั้งต้นอยู่ที่ `seed/parameter-schema.json` เมื่อเขียนโค้ด ให้สร้าง `packages/engine/src/schema.ts` จากไฟล์นี้ แล้วให้ทุกส่วนอ่านจาก `schema.ts` เท่านั้น

## 1. รูปแบบนิยามพารามิเตอร์

```ts
export const PARAMS = [
  { key: 'exposure', group: 'light', label: { th: 'ความสว่าง (EV)', en: 'Exposure' },
    min: -100, max: 100, default: 0, step: 1, kind: 'linear',
    desc: 'brightness, ±100 = ±1 stop', since: 2 },
  // ...
] as const satisfies readonly ParamDef[];

export type ParamKey = typeof PARAMS[number]['key'];
export type Params = Record<ParamKey, number>;
export const SCHEMA_VERSION = 3;   // เพิ่มเมื่อเพิ่ม/เปลี่ยนความหมายพารามิเตอร์
```

- `kind`: `'linear'` (แถบเลื่อนปกติ), `'hue'` (แถบสีรุ้ง 0..360 วนรอบ), `'signed'` (แสดง + นำหน้าค่าบวก)
- `since`: schemaVersion ที่เพิ่มพารามิเตอร์นี้ ใช้ใน migration
- `desc`: คำอธิบายสั้นภาษาอังกฤษ (ทิศทาง +/−, ค่าทั่วไป) ใช้ใน tooltip และคำสั่งสำหรับแชต
- หัวข้อภาษาไทยที่ใช้ในพร้อมต์แบบโครงสร้างอยู่ใน `seed/sgp-vocabulary.json` (ไม่ใช่ใน schema) — test ตรวจว่าทุก key มีหัวข้อ
- ค่าทั้งหมดเป็น **จำนวนเต็ม** `clamp()` ปัดเศษและบีบเข้าช่วงเสมอ

## 2. ตารางพารามิเตอร์ (schemaVersion 3, 45 ตัว)

### ความเข้มรวม

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `amount` | ความเข้มรวม | 0..100 | 100 | overall strength of the whole grade |

### แสงและสีรวม — ทั้งภาพ

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `exposure` | ความสว่าง (EV) | -100..100 | 0 | brightness, ±100 = ±1 stop |
| `contrast` | คอนทราสต์ | -100..100 | 0 | midtone contrast S-curve |
| `highlights` | ไฮไลต์ | -100..100 | 0 | brighten (+) or recover (−) highlights |
| `shadows` | เงา (ลบ = ลึกขึ้น) | -100..100 | 0 | lift (+) or deepen (−) shadows |
| `saturation` | ความอิ่มสี | -100..100 | 0 | global saturation, −100 = black and white |
| `vibrance` | Vibrance | -100..100 | 0 | saturation that protects already-saturated colors |
| `temp` | อุณหภูมิสี (เย็น ↔ อุ่น) | -100..100 | 0 | white balance: − cooler, + warmer |
| `tint` | Tint (เขียว ↔ ม่วงแดง) | -100..100 | 0 | − greener, + magenta |

### แก้สีและรายละเอียด — สีเพี้ยน ความมัว ความคม จุดรบกวน

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `castFix` | แก้สีเพี้ยนอัตโนมัติ | 0..100 | 0 | automatic gray-world correction of existing color cast |
| `dehaze` | ลดความมัว | 0..100 | 0 | remove mild haze/veiling |
| `sharpen` | ความคมชัด | 0..100 | 0 | edge-aware sharpening (typical 20–45) |
| `denoise` | ลดจุดรบกวน (คงผิว) | 0..100 | 0 | edge-aware noise reduction keeping texture (typical 15–35) |

### ใบไม้และทุ่งหญ้า — เฉพาะโทนเขียว

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `teal` | ดึงเขียวไปทาง teal | 0..100 | 0 | rotate green foliage toward teal in shadows/mids |
| `forest` | ความลึกของเขียวป่า | 0..100 | 0 | deepen green foliage |
| `sun` | olive/ทองอ่อนในจุดโดนแดด | 0..100 | 0 | warm olive/golden-green only in sunlit greens |

### Split toning — สีในเงาและไฮไลต์

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `shHue` | สีของเงา | 0..360 (องศา) | 200 | hue (°) added to shadows |
| `shSat` | ความเข้มสีในเงา | 0..100 | 0 | strength of shadow tint |
| `hiHue` | สีของไฮไลต์ | 0..360 (องศา) | 40 | hue (°) added to highlights |
| `hiSat` | ความเข้มสีในไฮไลต์ | 0..100 | 0 | strength of highlight tint |
| `guard` | คุมไม่ให้ภาพเหลือง/อำพัน | 0..100 | 0 | suppress yellow/orange/amber casts |

### บรรยากาศและฟิล์ม — หมอก เกรน ขอบมืด

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `haze` | หมอกฉากหลัง | 0..100 | 0 | atmospheric haze, strongest at top of frame |
| `reach` | ระยะหมอกจากขอบบน | 0..100 | 45 | how far down the haze extends |
| `hazeTemp` | โทนหมอก (เย็น ↔ อุ่น) | -100..100 | -30 | haze color: − cool, + warm |
| `fade` | ฟิล์มจาง (ยกเงาดำ) | 0..100 | 0 | lifted blacks, low-contrast film |
| `grain` | เกรนฟิล์ม | 0..100 | 0 | film grain |
| `vignette` | ขอบมืด | 0..100 | 0 | darken edges |

### ปรับรายสี (HSL) — แดง เหลือง เขียว ฟ้า น้ำเงิน ม่วง

| key | ป้าย UI | ช่วง | ค่าเป็นกลาง | คำอธิบาย (`desc`) |
|---|---|---|---|---|
| `hR` | แดง · Hue | -100..100 | 0 | hue shift of reds |
| `sR` | แดง · Sat | -100..100 | 0 | saturation of reds |
| `lR` | แดง · Lum | -100..100 | 0 | luminance of reds |
| `hY` | เหลือง/ส้ม · Hue | -100..100 | 0 | hue shift of yellows/oranges |
| `sY` | เหลือง/ส้ม · Sat | -100..100 | 0 | saturation of yellows/oranges |
| `lY` | เหลือง/ส้ม · Lum | -100..100 | 0 | luminance of yellows/oranges |
| `hG` | เขียว · Hue | -100..100 | 0 | hue shift of greens |
| `sG` | เขียว · Sat | -100..100 | 0 | saturation of greens |
| `lG` | เขียว · Lum | -100..100 | 0 | luminance of greens |
| `hA` | ฟ้าอมเขียว · Hue | -100..100 | 0 | hue shift of aquas/cyans |
| `sA` | ฟ้าอมเขียว · Sat | -100..100 | 0 | saturation of aquas/cyans |
| `lA` | ฟ้าอมเขียว · Lum | -100..100 | 0 | luminance of aquas/cyans |
| `hB` | น้ำเงิน/ท้องฟ้า · Hue | -100..100 | 0 | hue shift of blues/sky |
| `sB` | น้ำเงิน/ท้องฟ้า · Sat | -100..100 | 0 | saturation of blues/sky |
| `lB` | น้ำเงิน/ท้องฟ้า · Lum | -100..100 | 0 | luminance of blues/sky |
| `hP` | ม่วง/ลาเวนเดอร์ · Hue | -100..100 | 0 | hue shift of purples/lavender |
| `sP` | ม่วง/ลาเวนเดอร์ · Sat | -100..100 | 0 | saturation of purples/lavender |
| `lP` | ม่วง/ลาเวนเดอร์ · Lum | -100..100 | 0 | luminance of purples/lavender |

## 3. ประวัติเวอร์ชัน

| version | การเปลี่ยนแปลง |
|---|---|
| 1 | ต้นแบบแรก: teal, forest, sun, cream, guard, shadowTeal, depth, haze, reach, grain, fade, vignette — คีย์ `cream`, `shadowTeal`, `depth` เลิกใช้แล้ว (แปลงใน migration) |
| 2 | ปรับเป็นชุดทั่วไป: ความเข้มรวม, แสงรวม, split toning (hue+sat), HSL 5 แถบ, hazeTemp |
| 3 | เพิ่ม castFix, dehaze, sharpen, denoise และแถบสีม่วง hP/sP/lP |

พรีเซ็ตที่บันทึกด้วยเวอร์ชันเก่ากว่า → `migrateParams()` เติมพารามิเตอร์ใหม่ด้วยค่าเป็นกลาง (พรีเซ็ตเดิมให้ผลเหมือนเดิม)

## 4. กติกาการเพิ่มหรือแก้พารามิเตอร์

1. ค่าเป็นกลางต้องทำให้ขั้นนั้น "ไม่มีผล" (รักษา identity invariant)
2. เพิ่มใน `schema.ts` → สูตร CPU → GLSL + uniform → หัวข้อใน `sgp-vocabulary.json` + ส่วนใน serializer → test (รวม round-trip) → เอกสาร `04`, `05`, `06` → รายการหัวข้อใน `seed/sgp-bridge-instruction.md`
3. เพิ่ม `SCHEMA_VERSION` และกรณีใน `migrate.ts`
4. ใช้ skill `/add-parameter` ซึ่งมี checklist ครบ
