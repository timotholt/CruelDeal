import Vector from '../vector';

export function generateIslandMask(
    origin: Vector,
    worldDimensions: Vector,
    rxRatio: number,
    ryRatio: number,
    noiseAmplitude: number,
    rng: () => number
): Vector[] {
    const cx = origin.x + worldDimensions.x / 2;
    const cy = origin.y + worldDimensions.y / 2;
    const rx = worldDimensions.x * rxRatio;
    const ry = worldDimensions.y * ryRatio;
    const points: Vector[] = [];
    const steps = 72;

    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const noise = 1 + (rng() - 0.5) * noiseAmplitude;
        points.push(new Vector(
            cx + Math.cos(angle) * rx * noise,
            cy + Math.sin(angle) * ry * noise
        ));
    }

    return points;
}

export function worldBoundsPolygon(origin: Vector, worldDimensions: Vector): Vector[] {
    return [
        origin.clone(),
        new Vector(origin.x + worldDimensions.x, origin.y),
        new Vector(origin.x + worldDimensions.x, origin.y + worldDimensions.y),
        new Vector(origin.x, origin.y + worldDimensions.y),
    ];
}
