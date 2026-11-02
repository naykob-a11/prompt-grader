// Writes seed/parameter-schema.json from schema.ts.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toSeedSchema } from '../src';
import { ROOT } from '../test/support/images';

const file = resolve(ROOT, 'seed/parameter-schema.json');
writeFileSync(file, `${JSON.stringify(toSeedSchema(), null, 2)}\n`);
console.log(`wrote ${file}`);
