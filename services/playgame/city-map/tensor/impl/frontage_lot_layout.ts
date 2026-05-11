import { polygonBoolean } from '../../polygon-boolean';
import type { Point } from '../../types';
import { tensorRandom } from '../rng';
import Vector from '../vector';
import type { BuildableParcel, FrontageKind, ParcelFrontage } from './buildable_parcelizer';
import PolygonUtil from './polygon_util';

export interface FrontageLotLayoutInput {
    parcels: BuildableParcel[];
    defaultMinArea: number;
    defaultShrinkSpacing: number;
}

export interface FrontageLotLayoutStats {
    parcelCount: number;
    lotCount: number;
    usedFrontageCount: number;
    fallbackCount: number;
    rejectedSliverCount: number;
    ms: number;
}

export interface FrontageLotLayoutResult {
    lots: Vector[][];
    stats: FrontageLotLayoutStats;
}

interface FrontageLayoutTuning {
    setback: number;
    minLotWidth: number;
    maxLotWidth: number;
    rowDepth: number;
    maxRows: number;
    mergeChance: number;
    gapChance: number;
    minAreaMultiplier: number;
}

const TUNING: Record<FrontageKind, FrontageLayoutTuning> = {
    'main-road': {
        setback: 4,
        minLotWidth: 20,
        maxLotWidth: 48,
        rowDepth: 28,
        maxRows: 3,
        mergeChance: 0.18,
        gapChance: 0.03,
        minAreaMultiplier: 1.4,
    },
    waterfront: {
        setback: 7,
        minLotWidth: 24,
        maxLotWidth: 64,
        rowDepth: 34,
        maxRows: 2,
        mergeChance: 0.22,
        gapChance: 0.08,
        minAreaMultiplier: 1.8,
    },
    'major-road': {
        setback: 5,
        minLotWidth: 18,
        maxLotWidth: 42,
        rowDepth: 28,
        maxRows: 3,
        mergeChance: 0.12,
        gapChance: 0.05,
        minAreaMultiplier: 1.2,
    },
    'minor-road': {
        setback: 4,
        minLotWidth: 12,
        maxLotWidth: 30,
        rowDepth: 22,
        maxRows: 3,
        mergeChance: 0.06,
        gapChance: 0.08,
        minAreaMultiplier: 0.9,
    },
    park: {
        setback: 6,
        minLotWidth: 18,
        maxLotWidth: 44,
        rowDepth: 28,
        maxRows: 2,
        mergeChance: 0.16,
        gapChance: 0.12,
        minAreaMultiplier: 1.4,
    },
    internal: {
        setback: 4,
        minLotWidth: 16,
        maxLotWidth: 34,
        rowDepth: 24,
        maxRows: 2,
        mergeChance: 0.08,
        gapChance: 0.1,
        minAreaMultiplier: 1,
    },
    unknown: {
        setback: 4,
        minLotWidth: 16,
        maxLotWidth: 34,
        rowDepth: 24,
        maxRows: 2,
        mergeChance: 0.08,
        gapChance: 0.12,
        minAreaMultiplier: 1,
    },
};

export function generateFrontageLots(input: FrontageLotLayoutInput): FrontageLotLayoutResult {
    const start = performance.now();
    const lots: Vector[][] = [];
    let usedFrontageCount = 0;
    let fallbackCount = 0;
    let rejectedSliverCount = 0;

    for (const parcel of input.parcels) {
        const primary = parcel.frontages[0];
        const generated = primary
            ? generateLotsForFrontage(parcel, primary, input.defaultMinArea)
            : [];

        if (generated.length > 0) {
            usedFrontageCount++;
            lots.push(...generated);
            continue;
        }

        fallbackCount++;
        const fallback = fallbackLots(parcel.polygon, input.defaultMinArea, input.defaultShrinkSpacing);
        if (fallback.length === 0) rejectedSliverCount++;
        lots.push(...fallback);
    }

    return {
        lots,
        stats: {
            parcelCount: input.parcels.length,
            lotCount: lots.length,
            usedFrontageCount,
            fallbackCount,
            rejectedSliverCount,
            ms: performance.now() - start,
        },
    };
}

function generateLotsForFrontage(parcel: BuildableParcel, frontage: ParcelFrontage, defaultMinArea: number): Vector[][] {
    const tuning = TUNING[frontage.kind] ?? TUNING.unknown;
    const inset = PolygonUtil.resizeGeometry(parcel.polygon, -tuning.setback);
    const buildable = inset.length >= 3 ? inset : parcel.polygon;
    const minArea = defaultMinArea * tuning.minAreaMultiplier;
    const basis = buildBasis(frontage.edge, parcel.polygon);
    if (!basis) return [];

    const projected = buildable.map(point => project(point, basis));
    const bounds = projectedBounds(projected);
    const depth = bounds.maxV - bounds.minV;
    const width = bounds.maxU - bounds.minU;
    if (depth < 8 || width < tuning.minLotWidth * 0.6) return [];

    const rowCount = Math.max(1, Math.min(tuning.maxRows, Math.floor(depth / tuning.rowDepth)));
    const rowDepth = depth / rowCount;
    const lots: Vector[][] = [];

    for (let row = 0; row < rowCount; row++) {
        const v0 = bounds.minV + row * rowDepth;
        const v1 = row === rowCount - 1 ? bounds.maxV : bounds.minV + (row + 1) * rowDepth;
        let u = bounds.minU;

        while (u < bounds.maxU - tuning.minLotWidth * 0.45) {
            if (tensorRandom() < tuning.gapChance) {
                u += randomRange(tuning.minLotWidth * 0.5, tuning.maxLotWidth * 0.75);
                continue;
            }

            let lotWidth = randomRange(tuning.minLotWidth, tuning.maxLotWidth);
            if (tensorRandom() < tuning.mergeChance) {
                lotWidth += randomRange(tuning.minLotWidth * 0.5, tuning.maxLotWidth * 0.75);
            }

            const u1 = Math.min(bounds.maxU, u + lotWidth);
            const clipped = clipLocalRectToPolygon(
                [
                    unproject(u, v0, basis),
                    unproject(u1, v0, basis),
                    unproject(u1, v1, basis),
                    unproject(u, v1, basis),
                ],
                buildable
            );

            for (const lot of clipped) {
                if (isUsableLot(lot, minArea, tuning.minLotWidth * 0.35)) {
                    lots.push(lot);
                }
            }

            u = u1;
        }
    }

    return lots;
}

function fallbackLots(polygon: Vector[], minArea: number, shrinkSpacing: number): Vector[][] {
    const inset = PolygonUtil.resizeGeometry(polygon, -shrinkSpacing);
    const source = inset.length >= 3 ? inset : polygon;
    return PolygonUtil.subdividePolygon(source, minArea)
        .filter(lot => isUsableLot(lot, minArea, Math.sqrt(minArea) * 0.8));
}

interface Basis {
    origin: Vector;
    u: Vector;
    v: Vector;
}

function buildBasis(edge: [Vector, Vector], polygon: Vector[]): Basis | null {
    const direction = edge[1].clone().sub(edge[0]);
    const length = direction.length();
    if (length < 0.001) return null;

    const u = direction.divideScalar(length);
    const normalA = new Vector(-u.y, u.x);
    const normalB = new Vector(u.y, -u.x);
    const midpoint = edge[0].clone().add(edge[1]).divideScalar(2);
    const center = PolygonUtil.averagePoint(polygon);
    const inward = center.clone().sub(midpoint).dot(normalA) >= center.clone().sub(midpoint).dot(normalB)
        ? normalA
        : normalB;

    return {
        origin: midpoint,
        u,
        v: inward,
    };
}

function project(point: Vector, basis: Basis): { u: number; v: number } {
    const relative = point.clone().sub(basis.origin);
    return {
        u: relative.dot(basis.u),
        v: relative.dot(basis.v),
    };
}

function unproject(u: number, v: number, basis: Basis): Vector {
    return basis.origin.clone()
        .add(basis.u.clone().multiplyScalar(u))
        .add(basis.v.clone().multiplyScalar(v));
}

function projectedBounds(points: Array<{ u: number; v: number }>): { minU: number; maxU: number; minV: number; maxV: number } {
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const point of points) {
        minU = Math.min(minU, point.u);
        maxU = Math.max(maxU, point.u);
        minV = Math.min(minV, point.v);
        maxV = Math.max(maxV, point.v);
    }
    return { minU, maxU, minV, maxV };
}

function clipLocalRectToPolygon(rect: Vector[], polygon: Vector[]): Vector[][] {
    const clipped = polygonBoolean.intersection(
        [rect.map(vectorToPoint)],
        [polygon.map(vectorToPoint)]
    );
    return clipped
        .map(points => points.map(pointToVector))
        .filter(piece => piece.length >= 3);
}

function isUsableLot(polygon: Vector[], minArea: number, minDimension: number): boolean {
    if (PolygonUtil.calcPolygonArea(polygon) < minArea * 0.65) return false;
    const box = boundingBox(polygon);
    return Math.min(box.maxX - box.minX, box.maxY - box.minY) >= minDimension;
}

function boundingBox(polygon: Vector[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of polygon) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }
    return { minX, minY, maxX, maxY };
}

function randomRange(min: number, max: number): number {
    return min + tensorRandom() * (max - min);
}

function vectorToPoint(v: Vector): Point {
    return { x: v.x, y: v.y };
}

function pointToVector(point: Point): Vector {
    return new Vector(point.x, point.y);
}
