import seed from '../../../seed/builtin-presets.json';
import { migrateParams } from './migrate';
import type { Params } from './schema';

export interface BuiltinPreset {
  id: string;
  name: string;
  prompt: string;
  params: Params;
  tags: string[];
}

export const BUILTIN_PRESETS: readonly BuiltinPreset[] = seed.presets.map((p) => ({
  id: `builtin:${p.id}`,
  name: p.name,
  prompt: p.prompt,
  params: migrateParams(p.params, seed.schemaVersion),
  tags: p.tags,
}));
