import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

const sharedAuthoritySuites = [
  'services/playgame/client/matchClient.contract.test.ts',
  'services/playgame/runtime/__tests__/characterization/live-opening.contract.test.ts',
  'contexts/PlayProviders.test.tsx',
  'contexts/PlayUiInterleaving.test.tsx',
] as const;

describe('authority-independent test architecture', () => {
  it('has one registry consumed by the shared conformance suite', () => {
    const registry = readFileSync(resolve(
      repositoryRoot,
      'services/playgame/testing/authorityRegistry.ts',
    ), 'utf8');
    const conformance = readFileSync(resolve(
      repositoryRoot,
      'services/playgame/client/matchClient.contract.test.ts',
    ), 'utf8');

    expect(registry).toContain('MATCH_AUTHORITY_TEST_DRIVERS');
    expect(conformance).toContain('for (const driver of MATCH_AUTHORITY_TEST_DRIVERS)');
    expect(conformance).not.toContain('LocalMatchSessionAdapter');
    expect(conformance).not.toContain('MatchSession.fromBootstrap');
  });

  it('does not allow authority selection to skip a registered contract', () => {
    const conformance = readFileSync(resolve(
      repositoryRoot,
      'services/playgame/client/matchClient.contract.test.ts',
    ), 'utf8');

    expect(conformance).not.toMatch(/process\.env|import\.meta\.env|\.skip\(|\.only\(/);
  });

  it('keeps shared client and UI behavior suites free of local authority construction', () => {
    const violations = sharedAuthoritySuites.flatMap((relativePath) => {
      const source = readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
      const findings: string[] = [];
      if (!source.includes('MATCH_AUTHORITY_TEST_DRIVERS')) {
        findings.push(`${relativePath}: does not iterate the authority registry`);
      }
      if (/LocalMatchSessionAdapter|MatchSession\.fromBootstrap/.test(source)) {
        findings.push(`${relativePath}: constructs local authority`);
      }
      return findings;
    });

    expect(violations).toEqual([]);
  });
});
