import { extractPlanarFaces, type PlanarEdge } from '../../planar-faces';
import { polygonBoolean, type PolygonSet } from '../../polygon-boolean';
import type { Point } from '../../types';
import Vector from '../vector';
import PolygonUtil from './polygon_util';

export type FrontageKind =
    | 'main-road'
    | 'waterfront'
    | 'major-road'
    | 'minor-road'
    | 'park'
    | 'internal'
    | 'unknown';

export type ClassifiedRoadClass = 'main' | 'coast' | 'major' | 'minor' | 'bridge';

export interface ParcelFrontage {
    kind: FrontageKind;
    score: number;
    edge: [Vector, Vector];
    sourceId?: string;
    sourceRoadClass?: ClassifiedRoadClass;
    length: number;
}

export interface BuildableParcel {
    polygon: Vector[];
    frontages: ParcelFrontage[];
}

export interface ClassifiedPolyline {
    id: string;
    roadClass: ClassifiedRoadClass;
    points: Vector[];
}

export interface BuildableParcelizerInput {
    landPolygons: Vector[][];
    riverPolygons: Vector[][];
    blockedPolygons?: Vector[][];
    roadPolylines: Vector[][];
    classifiedRoadPolylines?: ClassifiedPolyline[];
    bridgePolylines: Vector[][];
    roadBuffer: number;
    bridgeBuffer: number;
    minParcelArea: number;
    minParcelWidth: number;
}

export interface BuildableParcelizerStats {
    landCount: number;
    riverCount: number;
    roadCount: number;
    roadMaskCount: number;
    blockedFaceCount: number;
    rawFaceCount: number;
    acceptedFaceCount: number;
    rejectedTiny: number;
    rejectedSliver: number;
    rejectedBlocked: number;
    mainFrontageCount: number;
    waterfrontFrontageCount: number;
    majorFrontageCount: number;
    minorFrontageCount: number;
    unknownFrontageCount: number;
    ms: number;
}

export interface BuildableParcelizerResult {
    parcels: Vector[][];
    buildableParcels: BuildableParcel[];
    stats: BuildableParcelizerStats;
}

export const FRONTAGE_SCORE: Record<FrontageKind, number> = {
    'main-road': 100,
    waterfront: 90,
    'major-road': 70,
    'minor-road': 45,
    park: 35,
    internal: 15,
    unknown: 5,
};

export function parcelizeBuildableLand(input: BuildableParcelizerInput): BuildableParcelizerResult {
    const start = performance.now();
    const landPolygons = input.landPolygons.filter(polygon => polygon.length >= 3);
    const blockedPolygons = [
        ...input.riverPolygons,
        ...(input.blockedPolygons ?? []),
    ].filter(polygon => polygon.length >= 3);

    let rejectedTiny = 0;
    let rejectedSliver = 0;
    let rejectedBlocked = 0;
    let rawFaceCount = 0;
    let roadEdgeCount = 0;
    const parcels: Vector[][] = [];
    const buildableParcels: BuildableParcel[] = [];
    const frontageSources = buildFrontageSources(input, landPolygons);

    for (const landPolygon of landPolygons) {
        const roadEdges = buildRoadEdges(input, landPolygon);
        roadEdgeCount += roadEdges.length;

        const faces = extractPlanarFaces(roadEdges, landPolygon.map(vectorToPoint), {
            minFaceArea: input.minParcelArea,
            snapEpsilon: Math.max(1, input.roadBuffer * 0.75),
        });
        rawFaceCount += faces.length;

        for (const face of faces) {
            const polygon = pointToVectorPolygon(face.polygon);
            const buildablePieces = clipBlockedAreas(polygon, blockedPolygons);
            if (buildablePieces.length === 0) {
                rejectedBlocked++;
                continue;
            }

            for (const piece of buildablePieces) {
                const area = PolygonUtil.calcPolygonArea(piece);
                if (area < input.minParcelArea) {
                    rejectedTiny++;
                    continue;
                }

                if (parcelMinDimension(piece.map(vectorToPoint)) < input.minParcelWidth) {
                    rejectedSliver++;
                    continue;
                }

                parcels.push(piece);
                buildableParcels.push({
                    polygon: piece,
                    frontages: findParcelFrontages(piece, frontageSources),
                });
            }
        }
    }

    const frontageCounts = countPrimaryFrontages(buildableParcels);

    return {
        parcels,
        buildableParcels,
        stats: {
            landCount: landPolygons.length,
            riverCount: input.riverPolygons.filter(p => p.length >= 3).length,
            roadCount: getClassifiedRoadPolylines(input).filter(p => p.points.length >= 2).length,
            roadMaskCount: roadEdgeCount,
            blockedFaceCount: blockedPolygons.length,
            rawFaceCount,
            acceptedFaceCount: parcels.length,
            rejectedTiny,
            rejectedSliver,
            rejectedBlocked,
            mainFrontageCount: frontageCounts.main,
            waterfrontFrontageCount: frontageCounts.waterfront,
            majorFrontageCount: frontageCounts.major,
            minorFrontageCount: frontageCounts.minor,
            unknownFrontageCount: frontageCounts.unknown,
            ms: performance.now() - start,
        },
    };
}

function buildRoadEdges(input: BuildableParcelizerInput, landPolygon: Vector[]): PlanarEdge[] {
    const edges: PlanarEdge[] = [];
    const addPolylines = (polylines: ClassifiedPolyline[], prefix: string, minLength: number) => {
        for (let i = 0; i < polylines.length; i++) {
            const classified = polylines[i];
            const polyline = classified.points;
            if (polyline.length < 2 || isClosedPolyline(polyline)) continue;

            const clipped = PolygonUtil.clipPolylineToPolygon(polyline, landPolygon);
            for (let j = 0; j < clipped.length; j++) {
                const points = cleanPolyline(clipped[j]);
                if (points.length < 2 || polylineLength(points) < minLength) continue;
                edges.push({
                    id: `${prefix}-${classified.roadClass}-${i}-${j}`,
                    roadEdgeId: classified.id,
                    points: points.map(vectorToPoint),
                });
            }
        }
    };

    addPolylines(getClassifiedRoadPolylines(input), 'road', Math.max(2, input.roadBuffer * 2));
    addPolylines(input.bridgePolylines.map((points, index) => ({
        id: `bridge-${index}`,
        roadClass: 'bridge',
        points,
    })), 'bridge', Math.max(2, input.bridgeBuffer * 2));
    return edges;
}

interface FrontageSource {
    id: string;
    kind: FrontageKind;
    score: number;
    roadClass?: ClassifiedRoadClass;
    segments: Array<[Vector, Vector]>;
}

function getClassifiedRoadPolylines(input: BuildableParcelizerInput): ClassifiedPolyline[] {
    if (input.classifiedRoadPolylines) {
        return input.classifiedRoadPolylines;
    }

    return input.roadPolylines.map((points, index) => ({
        id: `road-${index}`,
        roadClass: 'minor',
        points,
    }));
}

function buildFrontageSources(input: BuildableParcelizerInput, landPolygons: Vector[][]): FrontageSource[] {
    const roadSources = getClassifiedRoadPolylines(input).map(source => {
        const kind = frontageKindForRoadClass(source.roadClass);
        return {
            id: source.id,
            kind,
            score: FRONTAGE_SCORE[kind],
            roadClass: source.roadClass,
            segments: polylineSegments(source.points),
        };
    });

    const bridgeSources = input.bridgePolylines.map((points, index) => {
        const kind: FrontageKind = 'main-road';
        return {
            id: `bridge-${index}`,
            kind,
            score: FRONTAGE_SCORE[kind],
            roadClass: 'bridge' as ClassifiedRoadClass,
            segments: polylineSegments(points),
        };
    });

    const riverSources = input.riverPolygons.map((polygon, index) => ({
        id: `river-${index}`,
        kind: 'waterfront' as FrontageKind,
        score: FRONTAGE_SCORE.waterfront,
        segments: polygonSegments(polygon),
    }));

    const coastSources = landPolygons.map((polygon, index) => ({
        id: `coast-${index}`,
        kind: 'waterfront' as FrontageKind,
        score: FRONTAGE_SCORE.waterfront,
        segments: polygonSegments(polygon),
    }));

    return [...roadSources, ...bridgeSources, ...riverSources, ...coastSources];
}

function frontageKindForRoadClass(roadClass: ClassifiedRoadClass): FrontageKind {
    if (roadClass === 'main' || roadClass === 'coast' || roadClass === 'bridge') return 'main-road';
    if (roadClass === 'major') return 'major-road';
    if (roadClass === 'minor') return 'minor-road';
    return 'unknown';
}

function findParcelFrontages(polygon: Vector[], sources: FrontageSource[]): ParcelFrontage[] {
    const epsilon = 5;
    const frontages: ParcelFrontage[] = [];

    for (let i = 0; i < polygon.length; i++) {
        const edge: [Vector, Vector] = [polygon[i], polygon[(i + 1) % polygon.length]];
        const length = edge[0].distanceTo(edge[1]);
        if (length < 2) continue;

        let best: ParcelFrontage | null = null;
        for (const source of sources) {
            const distance = minDistanceToSource(edge, source);
            if (distance > epsilon) continue;

            const candidate: ParcelFrontage = {
                kind: source.kind,
                score: source.score,
                edge: [edge[0].clone(), edge[1].clone()],
                sourceId: source.id,
                sourceRoadClass: source.roadClass,
                length,
            };

            if (!best
                || candidate.score > best.score
                || (candidate.score === best.score && candidate.length > best.length)) {
                best = candidate;
            }
        }

        if (best) frontages.push(best);
    }

    if (frontages.length === 0 && polygon.length >= 2) {
        const edge = longestPolygonEdge(polygon);
        frontages.push({
            kind: 'unknown',
            score: FRONTAGE_SCORE.unknown,
            edge,
            length: edge[0].distanceTo(edge[1]),
        });
    }

    return frontages.sort((a, b) => (b.score - a.score) || (b.length - a.length));
}

function minDistanceToSource(edge: [Vector, Vector], source: FrontageSource): number {
    let best = Infinity;
    const edgePointA = vectorToPoint(edge[0]);
    const edgePointB = vectorToPoint(edge[1]);
    for (const segment of source.segments) {
        best = Math.min(best, segmentDistance(edgePointA, edgePointB, vectorToPoint(segment[0]), vectorToPoint(segment[1])));
        if (best <= 0.001) break;
    }
    return best;
}

function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
    if (segmentsIntersect(a, b, c, d)) return 0;
    return Math.min(
        pointSegmentDistance(a, c, d),
        pointSegmentDistance(b, c, d),
        pointSegmentDistance(c, a, b),
        pointSegmentDistance(d, a, b)
    );
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denominator = rX * sY - rY * sX;
    if (Math.abs(denominator) < 0.000001) return false;
    const cAX = c.x - a.x;
    const cAY = c.y - a.y;
    const t = (cAX * sY - cAY * sX) / denominator;
    const u = (cAX * rY - cAY * rX) / denominator;
    return t >= -0.000001 && t <= 1.000001 && u >= -0.000001 && u <= 1.000001;
}

function pointSegmentDistance(point: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 0.000001;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2));
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    return Math.hypot(point.x - x, point.y - y);
}

function longestPolygonEdge(polygon: Vector[]): [Vector, Vector] {
    let best: [Vector, Vector] = [polygon[0].clone(), polygon[1 % polygon.length].clone()];
    let bestLength = 0;
    for (let i = 0; i < polygon.length; i++) {
        const start = polygon[i];
        const end = polygon[(i + 1) % polygon.length];
        const length = start.distanceTo(end);
        if (length > bestLength) {
            bestLength = length;
            best = [start.clone(), end.clone()];
        }
    }
    return best;
}

function countPrimaryFrontages(parcels: BuildableParcel[]): {
    main: number;
    waterfront: number;
    major: number;
    minor: number;
    unknown: number;
} {
    const counts = { main: 0, waterfront: 0, major: 0, minor: 0, unknown: 0 };
    for (const parcel of parcels) {
        const primary = parcel.frontages[0]?.kind ?? 'unknown';
        if (primary === 'main-road') counts.main++;
        else if (primary === 'waterfront') counts.waterfront++;
        else if (primary === 'major-road') counts.major++;
        else if (primary === 'minor-road') counts.minor++;
        else counts.unknown++;
    }
    return counts;
}

function polylineSegments(polyline: Vector[]): Array<[Vector, Vector]> {
    const segments: Array<[Vector, Vector]> = [];
    for (let i = 0; i + 1 < polyline.length; i++) {
        segments.push([polyline[i], polyline[i + 1]]);
    }
    return segments;
}

function polygonSegments(polygon: Vector[]): Array<[Vector, Vector]> {
    const segments: Array<[Vector, Vector]> = [];
    for (let i = 0; i < polygon.length; i++) {
        segments.push([polygon[i], polygon[(i + 1) % polygon.length]]);
    }
    return segments;
}

function cleanPolyline(polyline: Vector[]): Vector[] {
    const out: Vector[] = [];
    for (const point of polyline) {
        const prev = out[out.length - 1];
        if (!prev || prev.distanceToSquared(point) > 0.01) {
            out.push(point);
        }
    }
    return out;
}

function isClosedPolyline(polyline: Vector[]): boolean {
    if (polyline.length < 3) return false;
    return polyline[0].distanceToSquared(polyline[polyline.length - 1]) < 0.0001;
}

function polylineLength(polyline: Vector[]): number {
    let length = 0;
    for (let i = 1; i < polyline.length; i++) {
        length += polyline[i - 1].distanceTo(polyline[i]);
    }
    return length;
}

function isBlocked(polygon: Vector[], blockedPolygons: Vector[][]): boolean {
    const center = PolygonUtil.averagePoint(polygon);
    for (const blocked of blockedPolygons) {
        if (PolygonUtil.insidePolygon(center, blocked) || PolygonUtil.polygonsIntersect(polygon, blocked)) {
            return true;
        }
    }
    return false;
}

function clipBlockedAreas(polygon: Vector[], blockedPolygons: Vector[][]): Vector[][] {
    const relevantBlocked = blockedPolygons.filter(blocked => PolygonUtil.polygonsIntersect(polygon, blocked));
    if (relevantBlocked.length === 0) return [polygon];

    const clipped = polygonBoolean.difference([polygon.map(vectorToPoint)], toPolygonSet(relevantBlocked));
    const pieces = clipped
        .map(pointToVectorPolygon)
        .filter(piece => piece.length >= 3);

    const originalArea = PolygonUtil.calcPolygonArea(polygon);
    if (pieces.length === 1 && Math.abs(PolygonUtil.calcPolygonArea(pieces[0]) - originalArea) < 0.01) {
        return [];
    }

    return pieces.filter(piece => !centerInBlockedArea(piece, relevantBlocked));
}

function toPolygonSet(polygons: Vector[][]): PolygonSet {
    return polygons
        .filter(polygon => polygon.length >= 3)
        .map(polygon => polygon.map(vectorToPoint));
}

function centerInBlockedArea(polygon: Vector[], blockedPolygons: Vector[][]): boolean {
    const center = PolygonUtil.averagePoint(polygon);
    return blockedPolygons.some(blocked => PolygonUtil.insidePolygon(center, blocked));
}

function vectorToPoint(v: Vector): Point {
    return { x: v.x, y: v.y };
}

function pointToVectorPolygon(points: Point[]): Vector[] {
    return points.map(p => new Vector(p.x, p.y));
}

function parcelMinDimension(polygon: Point[]): number {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of polygon) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    return Math.min(maxX - minX, maxY - minY);
}
