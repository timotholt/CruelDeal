import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AUTHORITY_PROTOCOL_SCHEMA } from '../../protocol/schema-source';
import { PLAYER_WIRE_PROTOCOL_SCHEMA } from '../../protocol/player-wire-schema-source';

const CHECK_FLAG = '--check';
const outputs = [
  {
    outputPath: path.resolve(
      process.cwd(),
      'protocol/schema/cruel-deal-authority-record-v2.schema.json',
    ),
    schema: AUTHORITY_PROTOCOL_SCHEMA,
  },
  {
    outputPath: path.resolve(
      process.cwd(),
      'protocol/schema/cruel-deal-player-wire-v2.schema.json',
    ),
    schema: PLAYER_WIRE_PROTOCOL_SCHEMA,
  },
] as const;

if (process.argv.includes(CHECK_FLAG)) {
  for (const { outputPath, schema } of outputs) {
    const rendered = `${JSON.stringify(schema, null, 2)}\n`;
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== rendered) {
      throw new Error(
        `Protocol schema is stale: ${outputPath}. `
        + 'Run npm run protocol:schema:generate.',
      );
    }
  }
  console.log('PASS: protocol schema artifacts are current');
} else {
  for (const { outputPath, schema } of outputs) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${outputPath}`);
  }
}
