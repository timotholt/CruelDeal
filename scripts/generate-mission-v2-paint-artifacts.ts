import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  compileMissionPaintV1,
  serializePaintArtifact,
} from '../components/ui/semantic-compiler/paint/paintCompiler';

const fixtureDirectory = fileURLToPath(new URL(
  '../components/ui/semantic-compiler/paint/__fixtures__/',
  import.meta.url,
));
const appearancePath = `${fixtureDirectory}mission-v2-r0.appearance.json`;
const source = JSON.parse(readFileSync(appearancePath, 'utf8')) as unknown;
const result = compileMissionPaintV1(source);
if (!result.ok) {
  throw new Error(`Mission V2 paint fixture did not compile: ${JSON.stringify(result.issues)}`);
}

writeFileSync(`${fixtureDirectory}mission-v2-r0.paint-ir.json`, serializePaintArtifact(result.paintIr));
writeFileSync(`${fixtureDirectory}mission-v2-r0.chromium-150.allocation.json`, serializePaintArtifact(result.allocation));
writeFileSync(`${fixtureDirectory}mission-v2-r0.appearance.css`, result.css);
