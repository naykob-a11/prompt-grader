# 00 · โครงสร้างโฟลเดอร์โปรเจค

สัญลักษณ์: ✅ = มีในชุดเริ่มต้นนี้แล้ว · 🔨 = Claude Code สร้างตาม playbook (`15-claude-code-playbook.md`)

```
prompt-grader/
├── CLAUDE.md                          ✅ คำสั่งถาวรสำหรับ Claude Code (อ่านทุก session)
├── README.md                          ✅ ภาพรวมและวิธีเริ่ม
├── CHANGELOG.md                       🔨
├── .env.example                       ✅ ตัวแปรสภาพแวดล้อมทั้งหมดพร้อมคำอธิบาย (ไม่มีความลับ)
├── .gitignore                         ✅
├── package.json                       🔨 สคริปต์ root (dev, build, preview, test, golden:*)
├── pnpm-workspace.yaml                🔨
├── tsconfig.base.json                 🔨
├── playwright.config.ts               🔨
├── eslint.config.mjs, .prettierrc.json 🔨
│
├── .claude/                           ✅ การตั้งค่า Claude Code ของโปรเจค
│   ├── settings.json                  ✅ สิทธิ์คำสั่งที่อนุญาต/ห้าม
│   └── skills/
│       ├── grading-engine/            ✅ กติกาแก้เครื่องยนต์ (CPU+GPU+test+docs)
│       │   ├── SKILL.md
│       │   └── parity-checklist.md
│       ├── add-parameter/SKILL.md     ✅ /add-parameter — เพิ่มแถบเลื่อนครบทุกชั้น
│       ├── add-preset/                ✅ /add-preset — แปลงพร้อมต์เป็นพรีเซ็ตในตัว + ไฟล์ .sgp.txt
│       │   ├── SKILL.md
│       │   └── calibration-examples.md
│       ├── structured-prompt/         ✅ ดูแลรูปแบบพร้อมต์ ตัวอ่าน/ตัวเขียน คำศัพท์ คำสั่งแชต
│       │   ├── SKILL.md
│       │   └── porting-notes.md
│       ├── add-vocabulary/SKILL.md    ✅ /add-vocabulary — เพิ่มคำที่ตัวอ่านเข้าใจ
│       ├── thai-ui/SKILL.md           ✅ มาตรฐาน UI ภาษาไทย, tokens, a11y
│       ├── verify/SKILL.md            ✅ /verify — ตรวจงานก่อน commit
│       └── release/SKILL.md           ✅ /release — ขั้นตอนปล่อยเวอร์ชัน
│
├── docs/                              ✅ เอกสารสเปกทั้งหมด (00–15 + adr/)
│   └── adr/0001…0005-*.md             ✅
│
├── seed/                              ✅ ข้อมูลตั้งต้นที่สกัดจากต้นแบบ
│   ├── parameter-schema.json          ✅ 45 พารามิเตอร์, schemaVersion 3 (พร้อม since ทุกตัว)
│   ├── builtin-presets.json           ✅ พรีเซ็ตในตัว 6 แบบ (พร้อมต์ต้นฉบับ + ค่า)
│   ├── sgp-vocabulary.json            ✅ คำศัพท์ของพร้อมต์แบบโครงสร้าง (หัวข้อ ระดับ ทิศ สี)
│   ├── sgp-bridge-instruction.md      ✅ คำสั่งที่ปุ่ม "คัดลอกคำสั่งสำหรับแชต Claude" ใช้
│   └── structured-prompts/*.sgp.txt   ✅ พรีเซ็ตทั้ง 6 ในรูปแบบโครงสร้าง (แนบในแอปได้)
│
├── reference/
│   ├── prototype-v3.html              ✅ ต้นแบบเครื่องยนต์ที่ทำงานได้จริง (ปุ่ม AI ในต้นแบบไม่อยู่ในแบบใหม่)
│   ├── sgp-reference.mjs              ✅ ตัวอ่าน/ตัวเขียนพร้อมต์อ้างอิง (Node ≥ 20)
│   └── sgp-reference.test.mjs         ✅ 18 เคส = เกณฑ์ยอมรับของ port (`node --test reference/sgp-reference.test.mjs`)
│
├── packages/
│   └── engine/                        🔨 @prompt-grader/engine
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── schema.ts              แหล่งความจริงเดียวของพารามิเตอร์
│       │   ├── presets.ts             โหลด seed/builtin-presets.json
│       │   ├── migrate.ts
│       │   ├── sgp/{vocabulary,parse,serialize,suggest,template}.ts
│       │   ├── math.ts                smoothstep, hueOffset, hash2
│       │   ├── stats/{grayWorld,histogram,imageStats}.ts
│       │   ├── match/{toneMatch,worker,matchInWorker}.ts  จับคู่โทนจากภาพอ้างอิง
│       │   ├── types.ts, createRenderer.ts
│       │   ├── cpu/{grade,detail,worker,cpuRenderer}.ts
│       │   └── gl/{renderer,uniforms,tiles}.ts + shaders/{fullscreen.vert,detail.frag,grade.frag}
│       └── test/{identity,extremes,tiling,bw,schema,migrate,prototype,golden,sgp}.test.ts, test/support/, scripts/{exportSchema,renderPreset}.ts
│
├── apps/
│   └── web/                           🔨 Vite + React 18 + TypeScript (static, ไม่มี backend)
│       ├── index.html
│       ├── vite.config.ts             PWA plugin, base path
│       ├── public/_headers            CSP และ cache สำหรับ Cloudflare Pages (test เทียบกับ docs/11)
│       ├── public/{favicon.svg,icons/} ไอคอนแอป
│       ├── public/boot.js             แจ้งสาเหตุเมื่อ bundle โหลดหรืออ่านไม่ได้
│       └── src/
│           ├── main.tsx, App.tsx
│           ├── config/env.ts          ที่เดียวที่ใช้ import.meta.env
│           ├── config/envSchema.ts    ตรวจตัวแปร VITE_* ด้วย zod (ใช้ร่วมกับ vite.config.ts)
│           ├── i18n/{th,en}.json
│           ├── theme/tokens.css
│           ├── store/{editorStore,libraryStore,promptStore,exportStore}.ts
│           ├── storage/{db,settings,libraryFile}.ts
│           ├── services/{imageIO,openImage,sampleImage,exportImage,exif,prompts,promptSync,promptFiles,referenceTone,builtinText,clipboard,download}.ts
│           ├── features/
│           │   ├── stage/             Stage (canvas, ซูม/เลื่อน), CompareSlider, Histogram, useRenderer
│           │   ├── controls/          Controls, ParamGroup, ParamSlider (รวมแถบสี kind: 'hue')
│           │   ├── library/           LibraryPanel, PromptItem, SaveBar, ImportExport
│           │   ├── reference/         ReferenceWindow, DraftEditor, useDraftPreview
│           │   ├── prompt-editor/     PromptPanel, PromptEditor, sgpLanguage, WarningList,
│           │   │                      ChatBridgeDialog, NotesPanel
│           │   └── export/            ExportDialog
│           └── shared/                Button, Dialog, Toast, useHotkeys
│
├── tests/                             🔨 ทรัพยากรทดสอบร่วม
│   ├── fixtures/images/               ภาพทดสอบ (CC0/ถ่ายเอง)
│   ├── fixtures/library/              ไฟล์คลังตัวอย่างสำหรับทดสอบนำเข้า
│   ├── fixtures/sgp/                  พร้อมต์ที่ผู้ใช้รายงานว่าอ่านผิด + ค่าที่คาดหวัง
│   ├── golden/                        ภาพอ้างอิง (สร้างด้วย golden:update)
│   └── e2e/                           Playwright: *.spec.ts + harness/ (หน้าทดสอบเครื่องยนต์ในเบราว์เซอร์ ไม่ถูก deploy)
│
├── scripts/                           🔨 make-synthetic-fixture.ts, golden.ts, make-icons.ts
└── .github/workflows/ci.yml           🔨
```

## เหตุผลของการแบ่งโครงสร้าง

| การตัดสินใจ | เหตุผล |
|---|---|
| แยก `packages/engine` | ทดสอบสูตรและตัวอ่านพร้อมต์ได้โดยไม่ต้องมี UI; ต่อยอดเป็นแอปเดสก์ท็อปหรือ CLI ได้ |
| ไม่มี `apps/api` | อ่านพร้อมต์ในเครื่อง → ไม่มีเซิร์ฟเวอร์ ไม่มีความลับ ไม่มีค่าใช้จ่าย โฮสต์ฟรีแบบ static |
| `seed/` แยกจากโค้ด | ข้อมูลตั้งต้นและคำศัพท์แก้ได้โดยไม่แตะโค้ด, ใช้ร่วมกับ test และเอกสาร |
| `reference/` เก็บต้นแบบ | เมื่อสงสัยพฤติกรรมเครื่องยนต์หรือตัวอ่านพร้อมต์ ให้เทียบกับต้นแบบที่ทดสอบแล้ว |
| `features/` แยกตามหน้าที่ | ไฟล์ที่แก้ด้วยกันอยู่ด้วยกัน, Claude Code โฟกัสทีละฟีเจอร์ได้ |
| skills ใน `.claude/skills/` | งานที่ทำซ้ำ (เพิ่มพรีเซ็ต, เพิ่มพารามิเตอร์, ตรวจงาน) ได้ขั้นตอนเดียวกันทุกครั้ง |
