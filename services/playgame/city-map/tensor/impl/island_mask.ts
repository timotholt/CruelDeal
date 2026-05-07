import Vector from '../vector';

export function generateIslandMask(
    origin: Vector,
    worldDimensions: Vector,
    rxRatio: number,
    ryRatio: number,
    noiseAmplitude: number,
    rng: () => number,
    steps = 72
): Vector[] {
    const cx = origin.x + worldDimensions.x / 2;
    const cy = origin.y + worldDimensions.y / 2;
    const rx = worldDimensions.x * rxRatio;
    const ry = worldDimensions.y * ryRatio;
    const points: Vector[] = [];

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

export function smoothClosedPolygon(points: Vector[], iterations: number): Vector[] {
    let smoothed = points.map(point => point.clone());

    for (let iteration = 0; iteration < iterations; iteration++) {
        const next: Vector[] = [];
        for (let i = 0; i < smoothed.length; i++) {
            const current = smoothed[i];
            const following = smoothed[(i + 1) % smoothed.length];
            next.push(new Vector(
                current.x * 0.75 + following.x * 0.25,
                current.y * 0.75 + following.y * 0.25
            ));
            next.push(new Vector(
                current.x * 0.25 + following.x * 0.75,
                current.y * 0.25 + following.y * 0.75
            ));
        }
        smoothed = next;
    }

    return smoothed;
}

export function worldBoundsPolygon(origin: Vector, worldDimensions: Vector): Vector[] {
    return [
        origin.clone(),
        new Vector(origin.x + worldDimensions.x, origin.y),
        new Vector(origin.x + worldDimensions.x, origin.y + worldDimensions.y),
        new Vector(origin.x, origin.y + worldDimensions.y),
    ];
}
