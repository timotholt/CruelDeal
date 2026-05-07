import log from 'loglevel';
import Vector from '../vector';
import { tensorRandom } from '../rng';
import TensorField from './tensor_field';
import StreamlineGenerator, {StreamlineParams} from './streamlines';
import FieldIntegrator from './integrator';
import PolygonUtil from './polygon_util';

export interface NoiseParams {
    noiseEnabled: boolean;
    noiseSize: number;
    noiseAngle: number;
}

export interface WaterParams extends StreamlineParams {
    coastNoise: NoiseParams;
    riverNoise: NoiseParams;
    riverBankSize: number;
    riverSize: number;
}

/**
 * Integrates polylines to create coastline and river, with controllable noise.
 * Faithful port of the original MapGenerator-master WaterGenerator.
 */
export default class WaterGenerator extends StreamlineGenerator {
    private readonly TRIES = 100;
    private coastlineMajor = true;
    private _coastline: Vector[] = [];
    private _seaPolygon: Vector[] = [];
    private _riverPolygon: Vector[] = [];
    private _riverSecondaryRoad: Vector[] = [];

    constructor(integrator: FieldIntegrator,
                origin: Vector,
                worldDimensions: Vector,
                protected params: WaterParams,
                private tensorField: TensorField) {
        super(integrator, origin, worldDimensions, params);
    }

    get coastline(): Vector[] {
        return this._coastline;
    }

    get seaPolygon(): Vector[] {
        return this._seaPolygon;
    }

    get riverPolygon(): Vector[] {
        return this._riverPolygon;
    }

    get riverSecondaryRoad(): Vector[] {
        return this._riverSecondaryRoad;
    }

    createCoast(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let coastStreamline: Vector[] = [];
        let major = true;

        if (this.params.coastNoise.noiseEnabled) {
            this.tensorField.enableGlobalNoise(this.params.coastNoise.noiseAngle, this.params.coastNoise.noiseSize);
        }

        for (let i = 0; i < this.TRIES; i++) {
            major = tensorRandom() < 0.5;
            const seed = this.getSeed(major);
            if (!seed) continue;
            coastStreamline = this.extendStreamline(this.integrateStreamline(seed, major));
            if (this.reachesEdges(coastStreamline)) break;
        }

        this.tensorField.disableGlobalNoise();

        this._coastline = coastStreamline;
        this.coastlineMajor = major;

        const road = this.simplifyStreamline(coastStreamline);
        this._seaPolygon = this.getSeaPolygon(road);
        this.allStreamlinesSimple.push(road);
        this.tensorField.sea = this._seaPolygon;

        const complex = this.complexifyStreamline(road);
        this.grid(major).addPolyline(complex);
        this.streamlines(major).push(complex);
        this.allStreamlines.push(complex);
    }

    createRiver(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let riverStreamline: Vector[] = [];

        const oldSea = this.tensorField.sea;
        this.tensorField.sea = [];

        if (this.params.riverNoise.noiseEnabled) {
            this.tensorField.enableGlobalNoise(this.params.riverNoise.noiseAngle, this.params.riverNoise.noiseSize);
        }

        for (let i = 0; i < this.TRIES; i++) {
            const seed = this.getSeed(!this.coastlineMajor);
            if (!seed) continue;
            riverStreamline = this.extendStreamline(this.integrateStreamline(seed, !this.coastlineMajor));
            if (this.reachesEdges(riverStreamline)) break;
            if (i === this.TRIES - 1) log.error('Failed to find river reaching edge');
        }

        this.tensorField.sea = oldSea;
        this.tensorField.disableGlobalNoise();

        const expandedNoisy = this.complexifyStreamline(
            PolygonUtil.resizeGeometry(riverStreamline, this.params.riverSize, false));
        this._riverPolygon = PolygonUtil.resizeGeometry(
            riverStreamline, this.params.riverSize - this.params.riverBankSize, false);

        const firstOffScreen = expandedNoisy.findIndex(v => this.vectorOffScreen(v));
        for (let i = 0; i < firstOffScreen; i++) {
            expandedNoisy.push(expandedNoisy.shift()!);
        }

        const riverSplitPoly = this.getSeaPolygon(riverStreamline);
        const road1 = expandedNoisy.filter(v =>
            !PolygonUtil.insidePolygon(v, this._seaPolygon)
            && !this.vectorOffScreen(v)
            && PolygonUtil.insidePolygon(v, riverSplitPoly));
        const road1Simple = this.simplifyStreamline(road1);
        const road2 = expandedNoisy.filter(v =>
            !PolygonUtil.insidePolygon(v, this._seaPolygon)
            && !this.vectorOffScreen(v)
            && !PolygonUtil.insidePolygon(v, riverSplitPoly));
        const road2Simple = this.simplifyStreamline(road2);

        if (road1.length === 0 || road2.length === 0) return;

        if (road1[0].distanceToSquared(road2[0]) < road1[0].distanceToSquared(road2[road2.length - 1])) {
            road2Simple.reverse();
        }

        this.tensorField.river = road1Simple.concat(road2Simple);

        this.allStreamlinesSimple.push(road1Simple);
        this._riverSecondaryRoad = road2Simple;

        this.grid(!this.coastlineMajor).addPolyline(road1);
        this.grid(!this.coastlineMajor).addPolyline(road2);
        this.streamlines(!this.coastlineMajor).push(road1);
        this.streamlines(!this.coastlineMajor).push(road2);
        this.allStreamlines.push(road1);
        this.allStreamlines.push(road2);
    }

    private getSeaPolygon(polyline: Vector[]): Vector[] {
        return PolygonUtil.lineRectanglePolygonIntersection(this.origin, this.worldDimensions, polyline);
    }

    /**
     * Extends streamline past both world edges so the line exits the bounding rectangle.
     * Required for lineRectanglePolygonIntersection to correctly split the rectangle.
     */
    private extendStreamline(streamline: Vector[]): Vector[] {
        if (streamline.length < 2) return streamline;
        streamline.unshift(streamline[0].clone().add(
            streamline[0].clone().sub(streamline[1]).setLength(this.params.dstep * 5)));
        streamline.push(streamline[streamline.length - 1].clone().add(
            streamline[streamline.length - 1].clone().sub(streamline[streamline.length - 2]).setLength(this.params.dstep * 5)));
        return streamline;
    }

    private reachesEdges(streamline: Vector[]): boolean {
        return streamline.length > 0
            && this.vectorOffScreen(streamline[0])
            && this.vectorOffScreen(streamline[streamline.length - 1]);
    }

    private vectorOffScreen(v: Vector): boolean {
        const toOrigin = v.clone().sub(this.origin);
        return toOrigin.x <= 0 || toOrigin.y <= 0
            || toOrigin.x >= this.worldDimensions.x || toOrigin.y >= this.worldDimensions.y;
    }

    private complexifyStreamline(s: Vector[]): Vector[] {
        const out: Vector[] = [];
        for (let i = 0; i < s.length - 1; i++) {
            out.push(...this.complexifyStreamlineRecursive(s[i], s[i + 1]));
        }
        return out;
    }

    private complexifyStreamlineRecursive(v1: Vector, v2: Vector): Vector[] {
        if (v1.distanceToSquared(v2) <= this.paramsSq.dstep) {
            return [v1, v2];
        }
        const d = v2.clone().sub(v1);
        const halfway = v1.clone().add(d.multiplyScalar(0.5));
        const complex = this.complexifyStreamlineRecursive(v1, halfway);
        complex.push(...this.complexifyStreamlineRecursive(halfway, v2));
        return complex;
    }
}
