// Golden image workflow (docs/10 section 3).
//   update  writes tests/golden/*.png with the CPU engine
//   diff    writes tests/golden/_diff/*.png as golden | current | difference x8
import { basename, resolve } from 'node:path';
import {
  GOLDEN_DIR,
  goldenCases,
  IMAGES_DIR,
  psnr,
  readPng,
  render,
  writePng,
  type Image,
} from '../packages/engine/test/support/images.ts';

function sideBySide(golden: Image, current: Uint8ClampedArray): Image {
  const { width: w, height: h } = golden;
  const data = new Uint8ClampedArray(w * 3 * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = golden.data[i + c]!;
        const b = current[i + c]!;
        data[(y * w * 3 + x) * 4 + c] = a;
        data[(y * w * 3 + w + x) * 4 + c] = b;
        data[(y * w * 3 + 2 * w + x) * 4 + c] = c === 3 ? 255 : Math.abs(a - b) * 8;
      }
    }
  }
  return { data, width: w * 3, height: h };
}

const mode = process.argv[2];
if (mode !== 'update' && mode !== 'diff') {
  console.error('usage: golden.ts update|diff');
  process.exit(1);
}

for (const { preset, imageName, file } of goldenCases()) {
  const image = readPng(resolve(IMAGES_DIR, imageName));
  const current = render(image, preset.params);
  if (mode === 'update') {
    writePng(file, { ...image, data: current });
    console.log(`wrote ${basename(file)}`);
  } else {
    const golden = readPng(file);
    writePng(resolve(GOLDEN_DIR, '_diff', basename(file)), sideBySide(golden, current));
    console.log(`${basename(file)}: ${psnr(current, golden.data).toFixed(2)} dB`);
  }
}
