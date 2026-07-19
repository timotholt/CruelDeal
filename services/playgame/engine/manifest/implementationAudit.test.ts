import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_MANIFEST } from './bootstrap';
import { auditManifestImplementations } from './implementationAudit';

describe('complete active-manifest implementation audit', () => {
  it('has evaluator/projection support for every authored card and location ability', () => {
    const report = auditManifestImplementations(BOOTSTRAP_MANIFEST);

    expect(report.issues).toEqual([]);
    expect(report.issueCardIds).toEqual([]);
    expect(report.issueLocationIds).toEqual([]);
    expect(report.implementedCardIds).toHaveLength(
      Object.keys(BOOTSTRAP_MANIFEST.cards).length,
    );
    expect(report.implementedLocationIds).toHaveLength(
      Object.keys(BOOTSTRAP_MANIFEST.locations).length,
    );
  });

  it('identifies intentional vanilla cards separately from broken abilities', () => {
    const report = auditManifestImplementations(BOOTSTRAP_MANIFEST);

    expect(report.vanillaCardIds).toEqual([
      'armored-van',
      'drone',
      'gang-banger-token',
      'guard',
      'junk-card',
      'loaded-suit',
      'riff-raff-token',
      'street-kid',
      'street-samurai',
    ]);
  });
});
