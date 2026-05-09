import Vector from './vector';

export const VIEWPORT_DIMENSIONS = new Vector(900, 1600);
export const WORLD_ORIGIN = Vector.zeroVector();
export const WORLD_DIMENSIONS = new Vector(1800, 3200);

export type TensorMapSize = 'small' | 'medium' | 'large';

export const MAP_SIZE_DIMENSIONS: Record<TensorMapSize, Vector> = {
    small: new Vector(1200, 2133),
    medium: new Vector(1500, 2667),
    large: new Vector(1800, 3200),
};

export const MAP_SIZES: TensorMapSize[] = ['small', 'medium', 'large'];

export function setWorldDimensions(size: TensorMapSize): void {
    WORLD_DIMENSIONS.copy(MAP_SIZE_DIMENSIONS[size]);
}
