# 12 · การ Build และ Deploy

แอปเป็น **static site** ล้วน ไม่มีเซิร์ฟเวอร์ ไม่มีตัวแปรลับ — ตัวแปรสภาพแวดล้อมทั้งหมดเป็นการตั้งค่าสาธารณะ (ดูข้อ 6)

## 1. ความต้องการระบบสำหรับพัฒนา

- Node.js ≥ 22.12 (Vitest 5 ไม่รองรับ Node 20), pnpm ≥ 9 (โปรเจคล็อกรุ่นไว้ที่ `packageManager` ใน `package.json`)
- เบราว์เซอร์ที่รองรับ WebGL2 (Chrome/Edge/Firefox/Safari รุ่นปัจจุบัน)

## 2. คำสั่งหลัก

```bash
pnpm install
pnpm dev            # apps/web ที่ :5173
pnpm test           # unit + SGP + engine + golden + component
pnpm test:e2e       # Playwright (รวม parity และตรวจ network)
pnpm lint && pnpm typecheck
pnpm build          # apps/web/dist — คัดลอกไปโฮสต์ที่ไหนก็ได้
pnpm preview        # เปิด dist เพื่อตรวจก่อน deploy
node --test reference/sgp-reference.test.mjs   # ตัวอ่านอ้างอิง
```

## 3. ทางเลือกการโฮสต์ (ฟรีทั้งหมดสำหรับการใช้งานทั่วไป)

| ทางเลือก | วิธี | เหมาะกับ |
|---|---|---|
| A · Cloudflare Pages | เชื่อม GitHub repo, build `pnpm build`, output `apps/web/dist` | แนะนำ: เร็ว, ตั้ง CSP header ผ่าน `_headers` |
| B · GitHub Pages | Actions build แล้ว deploy `dist` | repo อยู่บน GitHub อยู่แล้ว |
| C · Netlify / Vercel (static) | ตั้ง output directory | ทีมคุ้นเคย |
| D · ไฟล์ในเครื่อง/เครือข่ายภายใน | คัดลอก `dist` ไปเซิร์ฟเวอร์ภายใน หรือเปิดผ่าน `pnpm preview` | ใช้ในหน่วยงานโดยไม่ออกอินเทอร์เน็ต |

ตั้ง `base` ใน `vite.config.ts` ให้ตรงกับ path ที่โฮสต์ (เช่น GitHub Pages ใต้ `/prompt-grader/`)

### 3.1 ตั้งค่า Cloudflare Pages

ใช้ Git integration: Workers & Pages → Create → Pages → Connect to Git แล้วกรอกค่านี้

| ช่อง | ค่า |
|---|---|
| Framework preset | None |
| Build command | `pnpm build` |
| Build output directory | `apps/web/dist` |
| Root directory | เว้นว่าง (รากของ repo เพราะ build ต้องเห็น `seed/` และ `packages/`) |
| Environment variable | `PNPM_VERSION` = รุ่นเดียวกับ `packageManager` ใน `package.json` ตอนนี้คือ `12.16.1` ทั้ง Production และ Preview |
| Environment variable (เฉพาะ Preview) | `VITE_RELEASE_CHANNEL` = `preview` |

- **`PNPM_VERSION` ขาดไม่ได้:** build image ใช้ pnpm 10 เป็นค่าเริ่มต้น และเอกสารของ Cloudflare ไม่ได้ระบุว่าอ่าน `packageManager` เปลี่ยนรุ่น pnpm เมื่อไรต้องแก้ค่านี้ด้วย
- รุ่น Node อ่านจาก `.node-version`
- ทดสอบ `_headers` ในเครื่องได้โดยไม่ต้องมีบัญชี:

```bash
pnpm build
pnpm dlx wrangler pages dev apps/web/dist --port 8788
E2E_BASE_URL=http://localhost:8788 pnpm test:e2e
```

`headers.spec.ts` ตรวจ header จริงเฉพาะเมื่อตั้ง `E2E_BASE_URL` เพราะ `pnpm preview` ไม่อ่าน `_headers` ใช้คำสั่งเดียวกันกับ URL จริงเป็น smoke test หลัง deploy ได้

## 4. CI (GitHub Actions)

```
on: [push, pull_request]
jobs:
  check:   pnpm install --frozen-lockfile → lint → typecheck → test → node --test reference/sgp-reference.test.mjs → build
  e2e:     playwright install chromium → test:e2e
deploy:    Cloudflare Pages build เองทุกครั้งที่ push จึงไม่มี job นี้ใน CI
```

## 5. Checklist ก่อน release

- [ ] CI เขียวทั้งหมด
- [ ] เปิดเว็บ production แล้ว **ปิดเครือข่าย** → รีโหลด → ใช้งานครบ (PWA)
- [ ] ทดสอบมือจริง: เปิดภาพ 24 MP, แนบไฟล์ `.sgp.txt` 1 ไฟล์, ส่งออก JPEG
- [ ] DevTools Network: ไม่มี request ออกนอก origin
- [ ] อัปเดต `CHANGELOG.md`

## 6. ตัวแปรสภาพแวดล้อม

ต้นแบบทั้งหมดอยู่ใน `.env.example` ที่รากโปรเจค (มีคำอธิบายทุกตัว) ไม่ตั้งค่าเลยก็รันได้ เพราะทุกตัวมีค่าเริ่มต้น

| กลุ่ม | ตัวแปร | ใช้ทำอะไร |
|---|---|---|
| build/โฮสต์ | `VITE_BASE_PATH`, `VITE_APP_NAME`, `VITE_APP_SHORT_NAME`, `VITE_RELEASE_CHANNEL` | path ที่โฮสต์, ชื่อแอป/PWA, ป้ายช่องทาง |
| ค่าเริ่มต้น | `VITE_DEFAULT_LOCALE`, `VITE_DEFAULT_THEME`, `VITE_DEFAULT_PRESET_ID`, `VITE_DEFAULT_COMPARE_MODE`, `VITE_SHOW_SAMPLE_IMAGE` | ค่าตอนเปิดครั้งแรก (ผู้ใช้เปลี่ยนเองได้) |
| ส่งออก | `VITE_EXPORT_FORMAT`, `VITE_EXPORT_QUALITY`, `VITE_EXPORT_KEEP_EXIF`, `VITE_EXPORT_STRIP_GPS` | ค่าเริ่มต้นของหน้าต่างส่งออก |
| ขีดจำกัด | `VITE_MAX_PROMPT_BYTES`, `VITE_MAX_PROMPT_LINES`, `VITE_MAX_LIBRARY_BYTES`, `VITE_MAX_LIBRARY_ITEMS`, `VITE_MAX_IMAGE_MEGAPIXELS` | ป้องกันไฟล์ใหญ่ผิดปกติ (`11-security-privacy.md`) |
| ประสิทธิภาพ | `VITE_PREVIEW_MAX_SIDE`, `VITE_EXPORT_TILE_SIZE`, `VITE_PARSE_DEBOUNCE_MS`, `VITE_UNDO_LIMIT`, `VITE_FORCE_CPU_ENGINE` | ปรับตามสเปกเครื่อง |
| ฟีเจอร์ | `VITE_FEATURE_CHAT_BRIDGE`, `VITE_FEATURE_PWA`, `VITE_FEATURE_HISTOGRAM`, `VITE_BACKUP_REMINDER_DAYS` | เปิด/ปิดฟีเจอร์ |
| ดีบัก | `VITE_DEBUG_PANEL`, `VITE_DEBUG_SGP` | false เสมอใน production |
| เครื่องมือ (ไม่ฝังในเว็บ) | `DEV_PORT`, `PREVIEW_PORT`, `E2E_BASE_URL`, `E2E_SWIFTSHADER`, `GOLDEN_MIN_PSNR`, `PARITY_MAX_DIFF` | dev server, Playwright, เกณฑ์ test |

### 6.1 กติกา

- ตัวแปร `VITE_*` ถูกฝังในไฟล์ JavaScript ที่ผู้ใช้ดาวน์โหลด → **ห้ามใส่ความลับ** (โปรเจคนี้ไม่มีความลับให้ใส่)
- `vite.config.ts` ตั้ง `envDir` เป็นรากโปรเจค เพื่อให้ `.env*` อยู่ที่เดียวกับ `pnpm-workspace.yaml`
- โค้ดอ่านค่าผ่าน `apps/web/src/config/env.ts` เท่านั้น **ห้ามใช้ `import.meta.env` ตรง ๆ ในคอมโพเนนต์**
- schema อยู่ใน `config/envSchema.ts` (ไม่แตะ `import.meta.env` จึงให้ `vite.config.ts` ใช้ได้ด้วย) ตรวจค่าด้วย zod: แปลง `"true"/"false"` เป็น boolean และสตริงเป็นตัวเลข, ใส่ค่าเริ่มต้น, ผิดรูปแบบ → throw พร้อมชื่อตัวแปร (`pnpm build` ล้มเหลวทันที)
- เพิ่มตัวแปรใหม่ต้องแก้ 3 ที่พร้อมกัน: `.env.example` (มีคำอธิบาย), schema ใน `env.ts`, ตารางนี้
- `.env.production` ต้องมี `VITE_DEBUG_PANEL=false` และ `VITE_DEBUG_SGP=false` — test ใน CI ตรวจซ้ำ

### 6.2 รูปแบบ `apps/web/src/config/envSchema.ts` และ `env.ts`

```ts
import { z } from 'zod';

// envSchema.ts (zod 4: .default() รับค่าหลังแปลงแล้ว)
const bool = (fallback: boolean) =>
  z.enum(['true', 'false']).transform((v) => v === 'true').default(fallback);
const int = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const EnvSchema = z.object({
  VITE_BASE_PATH: z.string().regex(/^\/(.*\/)?$/).default('/'),
  VITE_DEFAULT_LOCALE: z.enum(['th', 'en']).default('th'),
  VITE_EXPORT_QUALITY: int(60, 100, 95),
  VITE_FEATURE_CHAT_BRIDGE: bool(true),
  // ... ทุกตัวแปร VITE_* ใน .env.example
});

// env.ts: ที่เดียวที่อ่าน import.meta.env (ESLint บังคับ)
export const env = parseEnv(import.meta.env);          // อ่านครั้งเดียว ใช้ทั้งแอป
```

### 6.3 ตั้งค่าบนโฮสต์

| โฮสต์ | วิธี |
|---|---|
| Cloudflare Pages | Settings → Environment variables (แยก Production/Preview) หรือ commit `.env.production` |
| GitHub Pages | ใส่ใน `env:` ของ workflow ก่อนขั้น `pnpm build` เช่น `VITE_BASE_PATH: /prompt-grader/` |
| เครื่องภายใน | สร้าง `.env.production.local` แล้ว `pnpm build` |
