import log from 'loglevel';
import 'jsts/org/locationtech/jts/monkey.js';
import {GeometryFactory, Coordinate} from 'jsts/org/locationtech/jts/geom';
import {Polygonizer} from 'jsts/org/locationtech/jts/operation/polygonize';
import {BufferParameters} from 'jsts/org/locationtech/jts/operation/buffer';
import Vector from '../vector';
import { tensorRandom } from '../rng';
import {Slice as PolyKSlice} from 'polyk';

export default class PolygonUtil {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static geometryFactory: any = new (GeometryFactory as any)();

    /**
     * Slices rectangle by line, returning smallest polygon
     */
    public static sliceRectangle(origin: Vector, worldDimensions: Vector, p1: Vector, p2: Vector): Vector[] {
        const rectangle = [
            origin.x, origin.y,
            origin.x + worldDimensions.x, origin.y,
            origin.x + worldDimensions.x, origin.y + worldDimensions.y,
            origin.x, origin.y + worldDimensions.y,
        ];
        const sliced = PolyKSlice(rectangle, p1.x, p1.y, p2.x, p2.y).map(p => PolygonUtil.polygonArrayToPolygon(p));
        const minArea = PolygonUtil.calcPolygonArea(sliced[0]);

        if (sliced.length > 1 && PolygonUtil.calcPolygonArea(sliced[1]) < minArea) {
            return sliced[1];
        }

        return sliced[0];
    }

    /**
     * Used to create sea polygon
     */
    public static lineRectanglePolygonIntersection(origin: Vector, worldDimensions: Vector, line: Vector[]): Vector[] {
        const jstsLine = PolygonUtil.lineToJts(line);
        const bounds = [
            origin,
            new Vector(origin.x + worldDimensions.x, origin.y),
            new Vector(origin.x + worldDimensions.x, origin.y + worldDimensions.y),
            new Vector(origin.x, origin.y + worldDimensions.y),
        ];
        const boundingPoly = PolygonUtil.polygonToJts(bounds);
        const union = boundingPoly.getExteriorRing().union(jstsLine);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const polygonizer = new (Polygonizer as any)();
        polygonizer.add(union);
        const polygons = polygonizer.getPolygons();

        let smallestArea = Infinity;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let smallestPoly: any;
        for (let i = polygons.iterator(); i.hasNext();) {
            const polygon = i.next();
            const area = polygon.getArea();
            if (area < smallestArea) {
                smallestArea = area;
                smallestPoly = polygon;
            }
        }

        if (!smallestPoly) return [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return smallestPoly.getCoordinates().map((c: any) => new Vector(c.x, c.y));
    }

    public static calcPolygonArea(polygon: Vector[]): number {
        let total = 0;

        for (let i = 0; i < polygon.length; i++) {
            const addX = polygon[i].x;
            const addY = polygon[i == polygon.length - 1 ? 0 : i + 1].y;
            const subX = polygon[i == polygon.length - 1 ? 0 : i + 1].x;
            const subY = polygon[i].y;

            total += (addX * addY * 0.5);
            total -= (subX * subY * 0.5);
        }

        return Math.abs(total);
    }

    /**
     * Recursively divide a polygon by its longest side until the minArea stopping condition is met
     */
    public static subdividePolygon(p: Vector[], minArea: number, depth = 0): Vector[][] {
        const area = PolygonUtil.calcPolygonArea(p);
        if (area < 0.5 * minArea) {
            return [];
        }
        const divided: Vector[][] = [];

        let longestSideLength = 0;
        let longestSide = [p[0], p[1]];

        let perimeter = 0;

        for (let i = 0; i < p.length; i++) {
            const sideLength = p[i].clone().sub(p[(i+1) % p.length]).length();
            perimeter += sideLength;
            if (sideLength > longestSideLength) {
                longestSideLength = sideLength;
                longestSide = [p[i], p[(i+1) % p.length]];
            }
        }

        const box = PolygonUtil.boundingBox(p);
        const minDimension = Math.min(box.maxX - box.minX, box.maxY - box.minY);
        const maxDimension = Math.max(box.maxX - box.minX, box.maxY - box.minY);
        if (minDimension < Math.sqrt(minArea)) {
            return [];
        }

        const aspectRatio = maxDimension / Math.max(minDimension, 0.000001);
        const targetArea = aspectRatio > 4
            ? Math.max(minArea, Math.min(700, minDimension * 18))
            : minArea;

        if (area < 2 * targetArea || depth >= 32) {
            return [p];
        }

        // Between 0.4 and 0.6
        const deviation = (tensorRandom() * 0.2) + 0.4;

        const averagePoint = longestSide[0].clone().add(longestSide[1].clone().sub(longestSide[0]).multiplyScalar(deviation));
        const differenceVector = longestSide[0].clone().sub(longestSide[1]);
        const diagonal = Math.hypot(box.maxX - box.minX, box.maxY - box.minY);
        const perpVector = (new Vector(differenceVector.y, -1 * differenceVector.x))
            .normalize()
            .multiplyScalar(Math.max(longestSideLength * 2, diagonal * 2, 1));

        const bisect = [averagePoint.clone().add(perpVector), averagePoint.clone().sub(perpVector)];

        try {
            const sliced = PolyKSlice(PolygonUtil.polygonToPolygonArray(p), bisect[0].x, bisect[0].y, bisect[1].x, bisect[1].y);
            if (sliced.length < 2) {
                return [p];
            }

            for (const s of sliced) {
                const polygon = PolygonUtil.polygonArrayToPolygon(s);
                const childArea = PolygonUtil.calcPolygonArea(polygon);
                if (childArea >= area * 0.995) {
                    return [p];
                }

                divided.push(...PolygonUtil.subdividePolygon(polygon, targetArea, depth + 1));
            }

            return divided;
        } catch (error) {
            log.error(error);
            return [];
        }
    }

    /**
     * Shrink or expand polygon
     */
    public static resizeGeometry(geometry: Vector[], spacing: number, isPolygon=true): Vector[] {
        try {
            const jstsGeometry = isPolygon ? PolygonUtil.polygonToJts(geometry) : PolygonUtil.lineToJts(geometry);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resized = jstsGeometry.buffer(spacing, undefined, (BufferParameters as any).CAP_FLAT);
            if (!resized.isSimple()) {
                return [];
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return resized.getCoordinates().map((c: any) => new Vector(c.x, c.y));
        } catch (error) {
            log.error(error);
            return [];
        }
    }

    public static clipPolylineToPolygon(polyline: Vector[], polygon: Vector[]): Vector[][] {
        return PolygonUtil.splitPolylineByPolygon(polyline, polygon, true);
    }

    public static cutPolylineFromPolygon(polyline: Vector[], polygon: Vector[]): Vector[][] {
        return PolygonUtil.splitPolylineByPolygon(polyline, polygon, false);
    }

    public static getPolylineInsidePolygon(polyline: Vector[], polygon: Vector[]): Vector[][] {
        return PolygonUtil.splitPolylineByPolygon(polyline, polygon, true);
    }

    private static splitPolylineByPolygon(polyline: Vector[], polygon: Vector[], keepInside: boolean): Vector[][] {
        if (polyline.length < 2 || polygon.length < 3) return [];

        const clipped: Vector[][] = [];
        let current: Vector[] = [];

        const flushCurrent = () => {
            if (current.length >= 2) {
                clipped.push(current);
            }
            current = [];
        };

        for (let i = 0; i < polyline.length - 1; i++) {
            const segments = PolygonUtil.splitSegmentByPolygon(polyline[i], polyline[i + 1], polygon, keepInside);
            for (const segment of segments) {
                if (current.length === 0) {
                    current.push(segment[0], segment[1]);
                } else if (current[current.length - 1].distanceToSquared(segment[0]) < 0.0001) {
                    current.push(segment[1]);
                } else {
                    flushCurrent();
                    current.push(segment[0], segment[1]);
                }
            }

            if (segments.length === 0) {
                flushCurrent();
            }
        }

        flushCurrent();
        return clipped;
    }

    public static averagePoint(polygon: Vector[]): Vector {
        if (polygon.length === 0) return Vector.zeroVector();
        const sum = Vector.zeroVector();
        for (const v of polygon) {
            sum.add(v);
        }
        return sum.divideScalar(polygon.length);
    }

    public static insidePolygon(point: Vector, polygon: Vector[]): boolean {
        if (polygon.length === 0) {
            return false;
        }

        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            const intersect = ((yi > point.y) != (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside;
    }

    public static polygonsIntersect(a: Vector[], b: Vector[]): boolean {
        if (a.length < 2 || b.length < 2) return false;
        if (!PolygonUtil.boundingBoxesOverlap(a, b)) return false;

        for (const point of a) {
            if (PolygonUtil.insidePolygon(point, b)) return true;
        }

        for (const point of b) {
            if (PolygonUtil.insidePolygon(point, a)) return true;
        }

        for (let i = 0; i < a.length; i++) {
            const aStart = a[i];
            const aEnd = a[(i + 1) % a.length];
            for (let j = 0; j < b.length; j++) {
                const bStart = b[j];
                const bEnd = b[(j + 1) % b.length];
                if (PolygonUtil.segmentIntersectionT(aStart, aEnd, bStart, bEnd) !== null) {
                    return true;
                }
            }
        }

        return false;
    }

    public static boundingBoxesOverlap(a: Vector[], b: Vector[]): boolean {
        const boxA = PolygonUtil.boundingBox(a);
        const boxB = PolygonUtil.boundingBox(b);
        return boxA.minX <= boxB.maxX
            && boxA.maxX >= boxB.minX
            && boxA.minY <= boxB.maxY
            && boxA.maxY >= boxB.minY;
    }

    public static pointInRectangle(point: Vector, origin: Vector, dimensions: Vector): boolean {
        return point.x >= origin.x && point.y >= origin.y && point.x <= dimensions.x && point.y <= dimensions.y;
    }

    private static splitSegmentByPolygon(start: Vector, end: Vector, polygon: Vector[], keepInside: boolean): Vector[][] {
        const tValues = [0, 1];

        for (let i = 0; i < polygon.length; i++) {
            const edgeStart = polygon[i];
            const edgeEnd = polygon[(i + 1) % polygon.length];
            const t = PolygonUtil.segmentIntersectionT(start, end, edgeStart, edgeEnd);
            if (t !== null) tValues.push(t);
        }

        const uniqueT = Array.from(new Set(tValues
            .filter(t => t >= 0 && t <= 1)
            .map(t => Math.round(t * 1000000) / 1000000)))
            .sort((a, b) => a - b);

        const out: Vector[][] = [];
        for (let i = 0; i < uniqueT.length - 1; i++) {
            const t0 = uniqueT[i];
            const t1 = uniqueT[i + 1];
            if (t1 - t0 < 0.000001) continue;

            const mid = PolygonUtil.interpolateSegment(start, end, (t0 + t1) / 2);
            if (PolygonUtil.insidePolygon(mid, polygon) === keepInside) {
                out.push([
                    PolygonUtil.interpolateSegment(start, end, t0),
                    PolygonUtil.interpolateSegment(start, end, t1),
                ]);
            }
        }

        return out;
    }

    private static segmentIntersectionT(a: Vector, b: Vector, c: Vector, d: Vector): number | null {
        const r = b.clone().sub(a);
        const s = d.clone().sub(c);
        const denominator = r.cross(s);
        if (Math.abs(denominator) < 0.000001) return null;

        const cMinusA = c.clone().sub(a);
        const t = cMinusA.cross(s) / denominator;
        const u = cMinusA.cross(r) / denominator;
        if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) {
            return null;
        }

        return Math.max(0, Math.min(1, t));
    }

    private static interpolateSegment(start: Vector, end: Vector, t: number): Vector {
        return new Vector(
            start.x + (end.x - start.x) * t,
            start.y + (end.y - start.y) * t
        );
    }

    private static boundingBox(polygon: Vector[]): { minX: number; minY: number; maxX: number; maxY: number } {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static lineToJts(line: Vector[]): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coords = line.map(v => new (Coordinate as any)(v.x, v.y));
        return PolygonUtil.geometryFactory.createLineString(coords);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static polygonToJts(polygon: Vector[]): any {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoInput = polygon.map(v => new (Coordinate as any)(v.x, v.y));
        geoInput.push(geoInput[0]);  // Create loop
        return PolygonUtil.geometryFactory.createPolygon(PolygonUtil.geometryFactory.createLinearRing(geoInput), []);
    }

    private static polygonToPolygonArray(p: Vector[]): number[] {
        const outP: number[] = [];
        for (const v of p) {
            outP.push(v.x);
            outP.push(v.y);
        }
        return outP;
    }

    private static polygonArrayToPolygon(p: number[]): Vector[] {
        const outP = [];
        for (let i = 0; i < p.length / 2; i++) {
            outP.push(new Vector(p[2*i], p[2*i + 1]));
        }
        return outP;
    }
}
