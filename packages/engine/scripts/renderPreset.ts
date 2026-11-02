// Renders a preset on every test image into tests/golden/_preview, for looking at the result.
import { resolve } from 'node:path';
import { BUILTIN_PRESETS } from '../src';
import {
  fixtureImages,
  GOLDEN_DIR,
  goldenName,
  IMAGES_DIR,
  readPng,
  render,
  shortId,
  writePng,
} from '../test/support/images';

const id = process.argv.slice(2).find((arg) => arg !== '--');
const preset = BUILTIN_PRESETS.find((p) => shortId(p.id) === id || p.id === id);
if (!preset) {
  const known = BUILTIN_PRESETS.map((p) => shortId(p.id)).join(', ');
  console.error(`usage: render-preset <id>, one of: ${known}`);
  process.exit(1);
}

for (const imageName of fixtureImages()) {
  const image = readPng(resolve(IMAGES_DIR, imageName));
  const file = resolve(GOLDEN_DIR, '_preview', goldenName(preset.id, imageName));
  writePng(file, { ...image, data: render(image, preset.params) });
  console.log(`wrote ${file}`);
}
