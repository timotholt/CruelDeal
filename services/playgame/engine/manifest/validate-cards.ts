import { getActiveCardModules, validateCardModule } from './card-set-loader';

let failures = 0;
const fail = (message: string): void => {
  failures++;
  console.error(`FAIL: ${message}`);
};

const modules = getActiveCardModules(['core-v1']);
const seen = new Set<string>();

for (const module of modules) {
  const issues = validateCardModule(module);
  for (const issue of issues) {
    fail(`${issue.cardId}: ${issue.message}`);
  }

  if (seen.has(module.card.defId)) {
    fail(`${module.card.defId}: duplicate defId`);
  }
  seen.add(module.card.defId);
}

if (failures > 0) {
  console.error(`\n${failures} card validation failure(s).`);
  process.exit(1);
}

console.log(`PASS: ${modules.length} active core-v1 cards validated.`);
