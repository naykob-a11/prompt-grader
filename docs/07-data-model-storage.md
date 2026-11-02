# 07 · โมเดลข้อมูลและการจัดเก็บ

## 1. แนวทาง: local-first

ข้อมูลทั้งหมดอยู่ใน IndexedDB ของเบราว์เซอร์ผ่าน Dexie ใช้งานได้ออฟไลน์ ไม่ต้องมีบัญชี การแบ่งปันใช้ไฟล์ JSON ระยะต่อยอดจึงเพิ่มการซิงก์บนคลาวด์ (ดู `13-roadmap.md`)

## 2. ตาราง (Dexie stores)

```ts
db.version(1).stores({
  prompts:  'id, name, source, updatedAt, *tags',
  settings: 'key',
});
```

### 2.1 `prompts`

```ts
interface PromptRecord {
  id: string;                 // ulid() — เรียงตามเวลาได้
  name: string;               // ≤ 80 ตัวอักษร
  prompt: string;             // ข้อความ SGP ≤ 64 KB — สร้างด้วย serializeSGP() ทุกครั้งที่บันทึก
  freeText?: string;          // พร้อมต์อิสระต้นฉบับ (ถ้ามี) ใช้กับปุ่มคำสั่งสำหรับแชต
  params: Params;             // ครบทุก key ของ schemaVersion ที่บันทึก — เป็นความจริงหลัก
  schemaVersion: number;
  notes?: string;             // จากส่วน [หมายเหตุ]
  preserve?: string;          // จากส่วน [ห้ามเปลี่ยน]
  tags: string[];             // เช่น ['ทิวทัศน์', 'พอร์ตเทรต']
  source: 'user' | 'import';
  createdAt: number; updatedAt: number;
}
```

พรีเซ็ตในตัว **ไม่เก็บใน DB** โหลดจาก `@prompt-grader/engine/presets` (id ขึ้นต้น `builtin:`) แก้ทับไม่ได้ ผู้ใช้ "ทำสำเนา" เพื่อแก้

### 2.2 `settings`

| key | ค่า | ค่าเริ่มต้น |
|---|---|---|
| `exportFormat` | `'jpeg'|'png'|'webp'` | `'jpeg'` |
| `jpegQuality` | 60..100 | 95 |
| `keepExif` | boolean | true |
| `stripGps` | boolean | true |
| `compareMode` | `'split'|'after'|'before'` | `'split'` |
| `lastPromptId` | string | `builtin:b1` |
| `lastBackupAt` | เวลา (ms) ที่ส่งออกคลังล่าสุด ใช้กับการเตือนสำรองตาม `VITE_BACKUP_REMINDER_DAYS` | 0 |

ค่าใน `settings` ที่ไม่ผ่านการตรวจถูกข้ามและใช้ค่าเริ่มต้นแทน ถ้าเบราว์เซอร์บล็อกการเก็บข้อมูล แอปยังทำงานต่อในหน่วยความจำพร้อมแจ้งผู้ใช้

## 3. รูปแบบไฟล์นำเข้า/ส่งออก

```json
{
  "format": "prompt-grader/library",
  "version": 1,
  "exportedAt": "2026-11-02T07:00:00Z",
  "schemaVersion": 3,
  "prompts": [
    { "name": "…", "prompt": "# ชื่อ: …\nเงา: ยก ปานกลาง (+30)\n…", "params": { "…": 0 },
      "notes": "…", "preserve": "…", "freeText": "…", "tags": [] }
  ]
}
```

กติกานำเข้า:
- ตรวจด้วย zod; รายการที่ผิดรูปแบบข้ามไปและนับรายงาน
- **รองรับรูปแบบต้นแบบ** `{"format":"kreadsi-prompts","version":1,"prompts":[{name,text,params,note}]}` (`text` → `freeText`, `note` → `notes`)
- มี `params` → ผ่าน `migrateParams()` แล้ว `clamp()`; ไม่มี `params` แต่มี `prompt` → `parseSGP(prompt)`
- `prompt` ถูกสร้างใหม่ด้วย `serializeSGP()` เสมอเพื่อให้ตรงกับ `params` แถวเก่าที่ `prompt` ว่างได้ข้อความตอนโหลด
- สร้าง id ใหม่เสมอ, `source: 'import'`; ชื่อซ้ำเติม " (2)"
- จำกัด 5 MB ต่อไฟล์ (เกินแล้วปฏิเสธทั้งไฟล์) และ 1,000 รายการ (ส่วนเกินนับเป็นรายการที่ข้าม)

## 4. Migration

```ts
export function migrateParams(p: Partial<Params>, from: number): Params {
  // v1 → v2: แปลงคีย์ต้นแบบรุ่นแรก
  //   cream → hiHue=40, hiSat=cream; shadowTeal → shHue=188, shSat=shadowTeal;
  //   depth → shadows = −depth·0.8 (ปัดเศษ)
  // v2 → v3: ไม่มีคีย์เปลี่ยนความหมาย เติม castFix/dehaze/sharpen/denoise/hP/sP/lP = 0
  // สุดท้าย: เติมคีย์ที่ขาดด้วย DEFAULT_PARAMS แล้ว clamp
}
```

ทุกการเพิ่ม `SCHEMA_VERSION` ต้องมี test ใน `migrate.test.ts` ที่แสดงว่าพรีเซ็ตเวอร์ชันเก่าให้ภาพเหมือนเดิม

## 5. สถานะในหน่วยความจำ (ไม่บันทึก)

- ภาพที่เปิด, พรีวิว, สถิติภาพ
- ประวัติ undo/redo (ล้างเมื่อเปิดภาพใหม่ ส่วนการเลือกพร้อมต์เป็นหนึ่งขั้นใน history จึงย้อนกลับได้)
