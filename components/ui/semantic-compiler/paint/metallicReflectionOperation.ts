import type { AuthoringPaintSlot } from '../controls/authoringControlRegistry';
import type { MetallicMaterialId } from '../../shiny/engine/reflectionFilm';

export type MetallicReflectionTarget = 'text' | 'surface';

export interface MetallicReflectionOperationSource {
  material: MetallicMaterialId;
  target: MetallicReflectionTarget;
}

export interface CompiledMetallicReflectionOperation {
  operation: 'metallicReflection';
  material: MetallicMaterialId;
  target: MetallicReflectionTarget;
  className: string;
  slot: AuthoringPaintSlot;
  helperCount: 0;
  cost: 1;
}

const classByTarget: Record<
  MetallicReflectionTarget,
  Record<MetallicMaterialId, string>
> = {
  text: {
    gold: 'metal-gold',
    silver: 'metal-silver',
    bronze: 'metal-bronze',
  },
  surface: {
    gold: 'metal-surface-gold',
    silver: 'metal-surface-silver',
    bronze: 'metal-surface-bronze',
  },
};

export const metallicReflectionClass = (
  source: MetallicReflectionOperationSource,
) => classByTarget[source.target][source.material];

export const compileMetallicReflectionOperation = (
  source: MetallicReflectionOperationSource,
): CompiledMetallicReflectionOperation => ({
  operation: 'metallicReflection',
  material: source.material,
  target: source.target,
  className: metallicReflectionClass(source),
  slot: source.target === 'text' ? 'C' : 'H',
  helperCount: 0,
  cost: 1,
});
