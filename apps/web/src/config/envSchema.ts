import { z } from 'zod';

// Otherwise zod probes `new Function` for speed, which the CSP reports as a violation.
z.config({ jitless: true });

const bool = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(fallback);
const int = (min: number, max: number, fallback: number) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

// Every VITE_* variable in .env.example, with the same defaults. Docs: docs/12 section 6.
export const EnvSchema = z.object({
  VITE_BASE_PATH: z
    .string()
    .regex(/^\/(.*\/)?$/)
    .default('/'),
  VITE_APP_NAME: z.string().min(1).default('เกรดสีจากพร้อมต์'),
  VITE_APP_SHORT_NAME: z.string().min(1).default('Prompt Grader'),
  VITE_RELEASE_CHANNEL: z.enum(['development', 'preview', 'production']).default('development'),

  VITE_DEFAULT_LOCALE: z.enum(['th', 'en']).default('th'),
  VITE_DEFAULT_THEME: z.enum(['system', 'light', 'dark']).default('system'),
  VITE_DEFAULT_PRESET_ID: z.string().min(1).default('builtin:b1'),
  VITE_DEFAULT_COMPARE_MODE: z.enum(['split', 'after', 'before']).default('split'),
  VITE_SHOW_SAMPLE_IMAGE: bool(true),

  VITE_EXPORT_FORMAT: z.enum(['jpeg', 'png', 'webp']).default('jpeg'),
  VITE_EXPORT_QUALITY: int(60, 100, 95),
  VITE_EXPORT_KEEP_EXIF: bool(true),
  VITE_EXPORT_STRIP_GPS: bool(true),

  VITE_MAX_PROMPT_BYTES: int(1024, 1_048_576, 65_536),
  VITE_MAX_PROMPT_LINES: int(1, 100_000, 2000),
  VITE_MAX_LIBRARY_BYTES: int(1024, 104_857_600, 5_242_880),
  VITE_MAX_LIBRARY_ITEMS: int(1, 100_000, 1000),
  VITE_MAX_IMAGE_MEGAPIXELS: int(1, 400, 60),

  VITE_PREVIEW_MAX_SIDE: int(256, 8192, 2048),
  VITE_EXPORT_TILE_SIZE: int(256, 16_384, 4096),
  VITE_PARSE_DEBOUNCE_MS: int(0, 5000, 150),
  VITE_UNDO_LIMIT: int(1, 1000, 50),
  VITE_FORCE_CPU_ENGINE: bool(false),

  VITE_FEATURE_CHAT_BRIDGE: bool(true),
  VITE_FEATURE_PWA: bool(true),
  VITE_FEATURE_HISTOGRAM: bool(true),
  VITE_BACKUP_REMINDER_DAYS: int(0, 3650, 30),

  VITE_DEBUG_PANEL: bool(false),
  VITE_DEBUG_SGP: bool(false),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  throw new Error(`Invalid environment variables\n${problems.join('\n')}`);
}
