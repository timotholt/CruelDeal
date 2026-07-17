import { describe, expect, it } from 'vitest';
import appearanceFixture from '../paint/__fixtures__/mission-v2-r0.appearance.json';
import { compileMissionTypographyV1 } from './missionTypography';

describe('Mission typography compiler', () => {
  it('lowers registry-owned typography fields to direct CSS', () => {
    const result = compileMissionTypographyV1(appearanceFixture.typography);
    if (!result.ok) throw new Error(result.issues[0]?.message ?? 'Typography must compile.');
    expect(result.css).toContain('font-family:');
    expect(result.css).toContain('font-size:');
    expect(result.css).toContain('line-height:');
    expect(result.css).toContain('letter-spacing:');
    expect(result.css).toContain('text-transform:');
    expect(result.css).toContain('text-shadow:');
  });

  it('composes opacity into the text color instead of dimming the whole element', () => {
    const authored = structuredClone(appearanceFixture.typography);
    authored.body.base.color = '#ffffff';
    authored.body.base.opacity = 0.62;
    const result = compileMissionTypographyV1(authored);
    if (!result.ok) throw new Error(result.issues[0]?.message ?? 'Typography must compile.');
    expect(result.css).toContain('color: rgb(255 255 255 / 0.62)');
    expect(result.css).not.toMatch(/(?:^|[;{]\s*)opacity:/m);
  });
});
