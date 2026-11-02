import { z } from 'zod';
import { env } from '../config/env';
import type { PromptDb } from './db';

const SettingsSchema = z.object({
  exportFormat: z.enum(['jpeg', 'png', 'webp']),
  jpegQuality: z.number().int().min(60).max(100),
  keepExif: z.boolean(),
  stripGps: z.boolean(),
  compareMode: z.enum(['split', 'after', 'before']),
  lastPromptId: z.string(),
  lastBackupAt: z.number(),
});

export type Settings = z.infer<typeof SettingsSchema>;
type SettingKey = keyof Settings;

export const defaultSettings = (): Settings => ({
  exportFormat: env.VITE_EXPORT_FORMAT,
  jpegQuality: env.VITE_EXPORT_QUALITY,
  keepExif: env.VITE_EXPORT_KEEP_EXIF,
  stripGps: env.VITE_EXPORT_STRIP_GPS,
  compareMode: env.VITE_DEFAULT_COMPARE_MODE,
  lastPromptId: env.VITE_DEFAULT_PRESET_ID,
  lastBackupAt: 0,
});

/** Saved values override the defaults; a value that fails validation is ignored. */
export async function loadSettings(db: PromptDb): Promise<Settings> {
  const settings = defaultSettings();
  for (const { key, value } of await db.settings.toArray()) {
    const field = SettingsSchema.shape[key as SettingKey] as z.ZodType | undefined;
    if (field?.safeParse(value).success) Object.assign(settings, { [key]: value });
  }
  return settings;
}

export async function saveSetting<K extends SettingKey>(
  db: PromptDb,
  key: K,
  value: Settings[K],
): Promise<void> {
  await db.settings.put({ key, value });
}
