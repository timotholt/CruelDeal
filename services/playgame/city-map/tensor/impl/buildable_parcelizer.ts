import { extractPlanarFaces, type PlanarEdge } from '../../planar-faces';
import { polygonBoolean, type PolygonSet } from '../../polygon-boolean';
import type { Point } from '../../types';
import Vector from '../vector';
import PolygonUtil from './polygon_util';

export interface BuildableParcelizerInput {
    landPolygons: Vector[][];
    riverPolygons: Vector[][];
    blockedPolygons?: Vector[][];
    roadPolylines: Vector[][];
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
    ms: number;
}

export interface BuildableParcelizerResult {
    parcels: Vector[][];
    stats: BuildableParcelizerStats;
}

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
            }
        }
    }

    return {
        parcels,
        stats: {
            landCount: landPolygons.length,
            riverCount: input.riverPolygons.filter(p => p.length >= 3).length,
            roadCount: input.roadPolylines.filter(p => p.length >= 2).length,
            roadMaskCount: roadEdgeCount,
            blockedFaceCount: blockedPolygons.length,
            rawFaceCount,
            acceptedFaceCount: parcels.length,
            rejectedTiny,
            rejectedSliver,
            rejectedBlocked,
            ms: performance.now() - start,
        },
    };
}

function buildRoadEdges(input: BuildableParcelizerInput, landPolygon: Vector[]): PlanarEdge[] {
    const edges: PlanarEdge[] = [];
    const addPolylines = (polylines: Vector[][], prefix: string, minLength: number) => {
        for (let i = 0; i < polylines.length; i++) {
            const polyline = polylines[i];
            if (polyline.length < 2 || isClosedPolyline(polyline)) continue;

            const clipped = PolygonUtil.clipPolylineToPolygon(polyline, landPolygon);
            for (let j = 0; j < clipped.length; j++) {
                const points = cleanPolyline(clipped[j]);
                if (points.length < 2 || polylineLength(points) < minLength) continue;
                edges.push({
                    id: `${prefix}-${i}-${j}`,
                    points: points.map(vectorToPoint),
                });
            }
        }
    };

    addPolylines(input.roadPolylines, 'road', Math.max(2, input.roadBuffer * 2));
    addPolylines(input.bridgePolylines, 'bridge', Math.max(2, input.bridgeBuffer * 2));
    return edges;
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
