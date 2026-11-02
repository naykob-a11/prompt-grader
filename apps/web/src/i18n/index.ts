import { env } from '../config/env';
import en from './en.json';
import th from './th.json';

export type MessageKey = keyof typeof th;

const catalogs: Record<'th' | 'en', Record<MessageKey, string>> = { th, en };

export const locale = env.VITE_DEFAULT_LOCALE;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    String(vars?.[name] ?? match),
  );
}
