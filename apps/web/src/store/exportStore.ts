import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { db } from '../storage/db';
import { defaultSettings, saveSetting, type Settings } from '../storage/settings';

export type ExportSettings = Pick<
  Settings,
  'exportFormat' | 'jpegQuality' | 'keepExif' | 'stripGps'
>;

const { exportFormat, jpegQuality, keepExif, stripGps } = defaultSettings();

export const exportStore = createStore<ExportSettings>()(() => ({
  exportFormat,
  jpegQuality,
  keepExif,
  stripGps,
}));

export const useExportSettings = <T>(selector: (state: ExportSettings) => T): T =>
  useStore(exportStore, selector);

export function setExportSetting<K extends keyof ExportSettings>(
  key: K,
  value: ExportSettings[K],
): void {
  exportStore.setState({ [key]: value });
  // Only a remembered preference: the export works whether or not this is stored.
  saveSetting(db, key, value as Settings[K]).catch(() => undefined);
}
