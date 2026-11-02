import { parseEnv } from './envSchema';

export const env = parseEnv(import.meta.env);
