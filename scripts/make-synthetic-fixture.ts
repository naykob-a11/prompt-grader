// Writes tests/fixtures/images/synthetic-ramps.png (docs/10 section 2). Deterministic.
import { resolve } from 'node:path';
import {
  IMAGES_DIR,
  SYNTHETIC_NAME,
  syntheticRamps,
  writePng,
} from '../packages/engine/test/support/images.ts';

const file = resolve(IMAGES_DIR, SYNTHETIC_NAME);
writePng(file, syntheticRamps());
console.log(`wrote ${file}`);
