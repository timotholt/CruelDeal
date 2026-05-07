import log from 'loglevel';
import Vector from '../vector';
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
 * Extends StreamlineGenerator to create coastlines and rivers
 */
export default class WaterGenerator extends StreamlineGenerator {
    private _coastline: Vector[] = [];
    private _river: Vector[] = [];
    private _seaPolygon: Vector[] = [];
    private _riverPolygon: Vector[] = [];
    private _riverSecondaryRoad: Vector[] = [];

    constructor(integrator: FieldIntegrator,
                origin: Vector,
                worldDimensions: Vector,
                private waterParams: WaterParams,
                private tensorField: TensorField) {
        super(integrator, origin, worldDimensions, waterParams);
    }

    get coastline(): Vector[] {
        return this._coastline;
    }

    get river(): Vector[] {
        return this._river;
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

    /**
     * Creates a coastline from a single streamline
     */
    createCoast(): void {
        this.clearStreamlines();
        this._coastline = [];
        this._seaPolygon = [];

        const cn = this.waterParams.coastNoise;
        if (cn.noiseEnabled) {
            this.tensorField.enableGlobalNoise(cn.noiseAngle, cn.noiseSize);
        }

        const streamline = this._sampleCoastlineStreamline();
        if (streamline.length < 2) return;

        this._coastline = streamline;
        this.allStreamlines.push(streamline);
        this.allStreamlinesSimple.push(this.simplifyStreamline(streamline));
        this.grid(true).addPolyline(streamline);

        this._seaPolygon = PolygonUtil.lineRectanglePolygonIntersection(
            this.origin, this.worldDimensions, streamline);
        this.tensorField.sea = this._seaPolygon;

        if (cn.noiseEnabled) {
            this.tensorField.disableGlobalNoise();
        }
    }

    /**
     * Creates a river
     */
    createRiver(): void {
        this._river = [];
        this._riverPolygon = [];
        this._riverSecondaryRoad = [];

        const rn = this.waterParams.riverNoise;
        if (rn.noiseEnabled) {
            this.tensorField.enableGlobalNoise(rn.noiseAngle, rn.noiseSize);
        }

        const streamline = this._sampleRiverStreamline();
        if (streamline.length < 2) {
            if (rn.noiseEnabled) this.tensorField.disableGlobalNoise();
            return;
        }

        this._river = streamline;
        this.allStreamlines.push(streamline);
        this.allStreamlinesSimple.push(this.simplifyStreamline(streamline));
        this.grid(true).addPolyline(streamline);

        const expandedRiver = PolygonUtil.resizeGeometry(streamline, this.waterParams.riverBankSize, false);
        if (expandedRiver.length > 0) {
            this._riverPolygon = expandedRiver;
            this.tensorField.river = this._riverPolygon;
        }

        this._riverSecondaryRoad = streamline;

        if (rn.noiseEnabled) {
            this.tensorField.disableGlobalNoise();
        }
    }

    private _sampleCoastlineStreamline(): Vector[] {
        // Sample from a point near an edge
        const seed = this._getCoastSeed();
        if (!seed) return [];
        return this._integrateFromSeed(seed);
    }

    private _sampleRiverStreamline(): Vector[] {
        const seed = this._getRiverSeed();
        if (!seed) return [];
        return this._integrateFromSeed(seed);
    }

    private _getCoastSeed(): Vector | null {
        for (let i = 0; i < this.params.seedTries; i++) {
            const p = new Vector(
                Math.random() * this.worldDimensions.x + this.origin.x,
                this.origin.y + 1
            );
            if (this.integrator.onLand(p)) return p;
        }
        return null;
    }

    private _getRiverSeed(): Vector | null {
        for (let i = 0; i < this.params.seedTries; i++) {
            const p = new Vector(
                Math.random() * this.worldDimensions.x + this.origin.x,
                Math.random() * this.worldDimensions.y * 0.3 + this.origin.y
            );
            if (this.integrator.onLand(p)) return p;
        }
        return null;
    }

    private _integrateFromSeed(seed: Vector): Vector[] {
        const out: Vector[] = [];
        let current = seed.clone();
        const direction = this.integrator.integrate(current, true);
        if (direction.lengthSq() < 0.001) return [];

        for (let i = 0; i < this.params.pathIterations; i++) {
            out.push(current.clone());
            const d = this.integrator.integrate(current, true);
            if (d.lengthSq() < 0.001) break;
            if (d.dot(direction) < 0) d.negate();
            current.add(d);
            if (!this.pointInBounds(current)) break;
        }

        return out;
    }
}
