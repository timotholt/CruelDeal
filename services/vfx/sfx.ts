/**
 * VFX sound adapter — routes the internal effect names used by the VFX
 * engine (e.g. `reveal`, `move`, `destroy`) to the project's authoritative
 * `services/audio` (Howler-based) `SfxKey` catalog.
 *
 * Usage:
 *   import { vfxSfx } from '@/services/vfx/sfx';
 *   const engine = new VFXEngine(boardEl, { sfx: vfxSfx });
 *
 * To extend: add more mappings below. Unknown names are silently ignored.
 */

import { audio } from '../audio';
import type { SfxKey } from '../../utils/assets';

/**
 * Mapping from the engine's internal semantic sound names to the game's
 * `SfxKey` catalog. A single mapping may fan out to multiple keys if the
 * effect is layered (e.g. destroy = hit + shatter).
 */
const SFX_MAP: Record<string, readonly SfxKey[]> = {
  reveal:    ['sfx_card_play'],
  on_reveal: ['sfx_card_play'],
  move:      ['sfx_teleport_short'],
  buff:      ['sfx_equip_light'],
  debuff:    ['sfx_equip_tech'],
  destroy:   ['sfx_destroy_digital', 'sfx_grenade_explode'],
  laser:     ['sfx_grenade_explode'],
  fire:      ['sfx_grenade_explode'],
  ice:       ['sfx_space_shimmer'],
  rain:      ['sfx_space_shimmer'],
  wind:      ['sfx_space_shimmer'],
  knives:    ['sfx_destroy_digital'],
};

/**
 * The sfx hook installed on `VFXEngine`. Ignores unknown names so porting
 * stays safe even if the map is incomplete.
 */
export function vfxSfx(name: string): void {
  const keys = SFX_MAP[name];
  if (!keys) return;
  for (const key of keys) audio.play(key);
}
