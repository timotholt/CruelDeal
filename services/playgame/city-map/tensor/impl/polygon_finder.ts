import log from 'loglevel';
import Vector from '../vector';
import {Node} from './graph';
import TensorField from './tensor_field';
import PolygonUtil from './polygon_util';

export default class PolygonFinder {
    public polygons: Vector[][] = [];
    private _shrunkPolygons: Vector[][] = [];
    private _dividedPolygons: Vector[][] = [];

    constructor(private nodes: Node[],
                private polygonParams: PolygonParams,
                private tensorField: TensorField) {}

    get shrunkPolygons(): Vector[][] {
        return this._shrunkPolygons;
    }

    get dividedPolygons(): Vector[][] {
        return this._dividedPolygons;
    }

    reset(): void {
        this.polygons = [];
        this._shrunkPolygons = [];
        this._dividedPolygons = [];
    }

    findPolygons(): void {
        this._findPolygons();
    }

    update(): boolean {
        return false;
    }

    /**
     * Shrink polygons to prevent roads overlapping with buildings.
     * Returns a Promise for API compatibility with animated mode.
     */
    async shrink(_animate = false): Promise<void> {
        this._shrunkPolygons = [];
        for (const p of this.polygons) {
            if (p.length < 3) continue;
            if (PolygonUtil.calcPolygonArea(p) < this.polygonParams.minArea) continue;
            const resized = PolygonUtil.resizeGeometry(p, -this.polygonParams.shrinkSpacing, true);
            if (resized.length > 2) {
                this._shrunkPolygons.push(resized);
            }
        }
    }

    /**
     * Divide polygons.
     * Returns a Promise for API compatibility with animated mode.
     */
    async divide(_animate = false): Promise<void> {
        this._dividedPolygons = [];
        for (const p of this._shrunkPolygons) {
            this._dividedPolygons.push(...PolygonUtil.subdividePolygon(p, this.polygonParams.minArea));
        }
        // Swap polygons to divided result for subsequent queries
        this.polygons = this._dividedPolygons;
    }

    private _findPolygons(): void {
        this.polygons = [];
        const visited = new Set<Node>();

        for (const node of this.nodes) {
            if (!visited.has(node)) {
                visited.add(node);
                for (const startNeighbor of node.adj) {
                    const polygon = this._tracePolygon(node, startNeighbor, visited);
                    if (polygon !== null && polygon.length > 2) {
                        if (this.tensorField.onLand(PolygonUtil.averagePoint(polygon)) ||
                            this.tensorField.inParks(PolygonUtil.averagePoint(polygon))) {
                            this.polygons.push(polygon);
                        }
                    }
                }
            }
        }
    }

    /**
     * Finds a polygon starting from a directed edge (node, next)
     */
    private _tracePolygon(start: Node, next: Node, visited: Set<Node>): Vector[] | null {
        const polygon: Vector[] = [start.value];
        const maxLen = this.nodes.length + 1;
        let current = start;
        let previous = start;

        let i = 0;
        while (next !== start && i < maxLen) {
            polygon.push(next.value);
            if (visited.has(next) && next !== start) {
                return null;
            }
            visited.add(next);

            const nextNext = this._getNextNode(previous, current, next);
            if (nextNext === null) return null;

            previous = current;
            current = next;
            next = nextNext;
            i++;
        }

        if (i >= maxLen) return null;
        return polygon;
    }

    /**
     * Returns the most clockwise next node from current, coming from previous.
     */
    private _getNextNode(previous: Node, current: Node, next: Node): Node | null {
        // Direction we are currently facing
        const directionIn = next.value.clone().sub(current.value);

        let mostClockwise: Node = null;
        let mostClockwiseAngle = Infinity;

        for (const neighbor of next.adj) {
            if (neighbor === current) continue;

            const directionOut = neighbor.value.clone().sub(next.value);
            let angle = Vector.angleBetween(directionIn, directionOut);

            // Normalise to range (0, 2*PI] — clockwise from incoming direction
            if (angle <= 0) angle += 2 * Math.PI;

            if (angle < mostClockwiseAngle) {
                mostClockwiseAngle = angle;
                mostClockwise = neighbor;
            }
        }

        if (mostClockwise === null && next.adj.length > 0) {
            // Dead-end: go back
            return current;
        }

        return mostClockwise;
    }
}

export interface PolygonParams {
    maxLength: number;
    minArea: number;
    shrinkSpacing: number;
    chanceNoDivide: number;
}
