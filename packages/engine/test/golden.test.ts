import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { goldenCases, IMAGES_DIR, psnr, readPng, render } from './support/images';

const minPsnr = Number(process.env.GOLDEN_MIN_PSNR || 45);

test.each(goldenCases().map((c) => [c.preset.id, c.imageName, c] as const))(
  'I6: %s on %s matches its golden image',
  (_id, imageName, c) => {
    const image = readPng(resolve(IMAGES_DIR, imageName));
    const golden = readPng(c.file);
    expect(psnr(render(image, c.preset.params), golden.data)).toBeGreaterThanOrEqual(minPsnr);
  },
);
