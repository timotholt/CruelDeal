import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PROTOCOL_SCHEMA } from '../../protocol/schema-source';

const CHECK_FLAG = '--check';
const outputPath = path.resolve(
  process.cwd(),
  'protocol/schema/cruel-deal-protocol-v1.schema.json',
);
const rendered = `${JSON.stringify(PROTOCOL_SCHEMA, null, 2)}\n`;

if (process.argv.includes(CHECK_FLAG)) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== rendered) {
    throw new Error(
      'Protocol schema is stale. Run npm run protocol:schema:generate.',
    );
  }
  console.log('PASS: protocol schema artifact is current');
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered, 'utf8');
  console.log(`Wrote ${outputPath}`);
}
