import log from 'loglevel';
import * as dat from 'dat.gui';
import DomainController from './domain_controller';
import TensorField from '../impl/tensor_field';
import {RK4Integrator} from '../impl/integrator';
import {StreamlineParams} from '../impl/streamlines';
import {WaterParams} from '../impl/water_generator';
import Graph from '../impl/graph';
import RoadGUI from './road_gui';
import WaterGUI from './water_gui';
import Vector from '../vector';
import { tensorRandom } from '../rng';
import PolygonFinder, {PolygonParams} from '../impl/polygon_finder';
import WaterGenerator from '../impl/water_generator';
import Style, {DefaultStyle, RoughStyle} from './style';
import CanvasWrapper from './canvas_wrapper';
import Buildings, {BuildingModel} from './buildings';
import PolygonUtil from '../impl/polygon_util';
import type { MapShape } from '../types';
import GenerationProfiler from './generation_profiler';
import BridgeGenerator from '../impl/bridge_generator';
import type { BridgeRoadClass, BridgeSegment } from '../impl/bridges';

/**
 * Handles Map folder, glues together impl
 */
export default class MainGUI {
    private numBigParks: number = 2;
    private numSmallParks: number = 0;
    private clusterBigParks: boolean = false;

    private domainController = DomainController.getInstance();
    private intersections: Vector[] = [];
    private bigParks: Vector[][] = [];
    private smallParks: Vector[][] = [];
    private animate: boolean = true;
    private animationSpeed: number = 30;
    private lastParkPolygonDetail = '';
    private lastBridgeDetail = '';

    private coastline: WaterGUI;
    private mainRoads: RoadGUI;
    private majorRoads: RoadGUI;
    private minorRoads: RoadGUI;
    private buildings: Buildings;
    private bridges: BridgeSegment[] = [];
    private mapShape: MapShape = 'peninsula';

    private coastlineParams: WaterParams;
    private mainParams: StreamlineParams;
    private majorParams: StreamlineParams;
    private minorParams: StreamlineParams = {
        dsep: 20,
        dtest: 15,
        dstep: 1,
        dlookahead: 40,
        dcirclejoin: 5,
        joinangle: 0.1,
        pathIterations: 1000,
        seedTries: 300,
        simplifyTolerance: 0.5,
        collideEarly: 0,
    };

    private redraw: boolean = true;

    constructor(private guiFolder: dat.GUI, private tensorField: TensorField, private closeTensorFolder: () => void) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        guiFolder.add(this as any, 'generateEverything');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const animateController = guiFolder.add(this as any, 'animate');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        guiFolder.add(this as any, 'animationSpeed');

        this.coastlineParams = Object.assign({
            coastNoise: { noiseEnabled: true, noiseSize: 30, noiseAngle: 20 },
            riverNoise: { noiseEnabled: true, noiseSize: 30, noiseAngle: 20 },
            riverBankSize: 10,
            riverSize: 30,
        }, this.minorParams) as WaterParams;
        this.coastlineParams.pathIterations = 10000;
        this.coastlineParams.simplifyTolerance = 10;

        this.majorParams = Object.assign({}, this.minorParams);
        this.majorParams.dsep = 100;
        this.majorParams.dtest = 30;
        this.majorParams.dlookahead = 200;
        this.majorParams.collideEarly = 0;

        this.mainParams = Object.assign({}, this.minorParams);
        this.mainParams.dsep = 400;
        this.mainParams.dtest = 200;
        this.mainParams.dlookahead = 500;
        this.mainParams.collideEarly = 0;

        const integrator = new RK4Integrator(tensorField, this.minorParams);
        const redraw = () => this.redraw = true;

        this.coastline = new WaterGUI(tensorField, this.coastlineParams, integrator,
            this.guiFolder, closeTensorFolder, 'Water', redraw).initFolder();
        this.mainRoads = new RoadGUI(this.mainParams, integrator, this.guiFolder, closeTensorFolder, 'Main', redraw).initFolder();
        this.majorRoads = new RoadGUI(this.majorParams, integrator, this.guiFolder, closeTensorFolder, 'Major', redraw, this.animate).initFolder();
        this.minorRoads = new RoadGUI(this.minorParams, integrator, this.guiFolder, closeTensorFolder, 'Minor', redraw, this.animate).initFolder();

        const parks = guiFolder.addFolder('Parks');
        parks.add({ Generate: () => {
            this.buildings.reset();
            this.addParks();
            this.redraw = true;
        } }, 'Generate');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parks.add(this as any, 'clusterBigParks');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parks.add(this as any, 'numBigParks');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parks.add(this as any, 'numSmallParks');

        const buildingsFolder = guiFolder.addFolder('Buildings');
        this.buildings = new Buildings(tensorField, buildingsFolder, redraw, this.minorParams.dstep, this.animate);
        this.buildings.setPreGenerateCallback(() => {
            const allStreamlines: Vector[][] = [];
            allStreamlines.push(...this.mainRoads.allStreamlines);
            allStreamlines.push(...this.majorRoads.allStreamlines);
            allStreamlines.push(...this.minorRoads.allStreamlines);
            allStreamlines.push(...this.coastline.streamlinesWithSecondaryRoad);
            allStreamlines.push(...this.bridges.map(bridge => [bridge.start, bridge.end]));
            this.buildings.setAllStreamlines(allStreamlines);
        });

        animateController.onChange((b: boolean) => {
            this.majorRoads.animate = b;
            this.minorRoads.animate = b;
            this.buildings.animate = b;
        });

        this.minorRoads.setExistingStreamlines([this.coastline, this.mainRoads, this.majorRoads]);
        this.majorRoads.setExistingStreamlines([this.coastline, this.mainRoads]);
        this.mainRoads.setExistingStreamlines([this.coastline]);

        this.coastline.setPreGenerateCallback(() => {
            this.mainRoads.clearStreamlines();
            this.majorRoads.clearStreamlines();
            this.minorRoads.clearStreamlines();
            this.bigParks = [];
            this.smallParks = [];
            this.buildings.reset();
            this.bridges = [];
            tensorField.parks = [];
            tensorField.sea = [];
            tensorField.landPolygon = [];
            tensorField.river = [];
        });

        this.mainRoads.setPreGenerateCallback(() => {
            this.majorRoads.clearStreamlines();
            this.minorRoads.clearStreamlines();
            this.bigParks = [];
            this.smallParks = [];
            this.buildings.reset();
            this.bridges = [];
            tensorField.parks = [];
            tensorField.ignoreRiver = true;
        });

        this.mainRoads.setPostGenerateCallback(() => {
            tensorField.ignoreRiver = false;
        });

        this.majorRoads.setPreGenerateCallback(() => {
            this.minorRoads.clearStreamlines();
            this.bigParks = [];
            this.smallParks = [];
            this.buildings.reset();
            this.bridges = [];
            tensorField.parks = [];
            tensorField.ignoreRiver = true;
        });

        this.majorRoads.setPostGenerateCallback(() => {
            tensorField.ignoreRiver = false;
            this.addParks();
            this.redraw = true;
        });

        this.minorRoads.setPreGenerateCallback(() => {
            this.buildings.reset();
            this.smallParks = [];
            tensorField.parks = this.bigParks;
        });

        this.minorRoads.setPostGenerateCallback(() => {
            this.addParks();
        });
    }

    addParks(): void {
        const g = new Graph(this.majorRoads.allStreamlines
            .concat(this.mainRoads.allStreamlines)
            .concat(this.minorRoads.allStreamlines), this.minorParams.dstep);
        this.intersections = g.intersections;

        const p = new PolygonFinder(g.nodes, {
            maxLength: 20,
            minArea: 80,
            shrinkSpacing: 4,
            chanceNoDivide: 1,
            preciseWaterCheck: this.usesIslandClip(),
        }, this.tensorField);
        p.findPolygons();
        this.lastParkPolygonDetail = this.formatPolygonStats(p.lastStats);
        const polygons = p.polygons;

        if (this.minorRoads.allStreamlines.length === 0) {
            this.bigParks = [];
            this.smallParks = [];
            if (polygons.length > this.numBigParks) {
                if (this.clusterBigParks) {
                    const parkIndex = Math.floor(tensorRandom() * (polygons.length - this.numBigParks));
                    for (let i = parkIndex; i < parkIndex + this.numBigParks; i++) {
                        this.bigParks.push(polygons[i]);
                    }
                } else {
                    for (let i = 0; i < this.numBigParks; i++) {
                        const parkIndex = Math.floor(tensorRandom() * polygons.length);
                        this.bigParks.push(polygons[parkIndex]);
                    }
                }
            } else {
                this.bigParks.push(...polygons);
            }
        } else {
            this.smallParks = [];
            for (let i = 0; i < this.numSmallParks; i++) {
                const parkIndex = Math.floor(tensorRandom() * polygons.length);
                this.smallParks.push(polygons[parkIndex]);
            }
        }

        this.tensorField.parks = [];
        this.tensorField.parks.push(...this.bigParks);
        this.tensorField.parks.push(...this.smallParks);
    }

    async generateEverything(animate?: boolean): Promise<void> {
        const anim = animate ?? this.animate;
        const profiler = new GenerationProfiler(`${this.mapShape}${anim ? ' animated' : ' instant'}`);

        try {
            this.bridges = [];

            if (this.usesIslandClip()) {
                this.buildings.setPreciseWaterCheck(true);
                await this.generateIslandRoads(anim, profiler);
            } else {
                this.buildings.setPreciseWaterCheck(false);
                profiler.time('coastline', () => this.coastline.generateRoads());
                await profiler.timeAsync('main roads', () => this.mainRoads.generateRoads());
                await profiler.timeAsync('major roads', () => this.majorRoads.generateRoads(anim));
                await profiler.timeAsync('minor roads', () => this.minorRoads.generateRoads(anim));
            }

            profiler.time('bridges', () => this.applyBridgeLayer(), () => this.lastBridgeDetail);
            profiler.time('trim stubs', () => this.trimRiverStubs(this.coastline.riverPolygonWorld));

            if (this.usesIslandClip()) {
                this.bigParks = [];
                this.smallParks = [];
                profiler.time('parks', () => this.addParks(), () => this.lastParkPolygonDetail);
            }

            this.redraw = true;
            await profiler.timeAsync('buildings', () => this.buildings.generate(anim), () => this.formatPolygonStats(this.buildings.lastPolygonStats));
        } finally {
            profiler.finish();
        }
    }

    setMapShape(mapShape: MapShape): void {
        this.mapShape = mapShape;
        this.coastline.setMapShape(mapShape);
    }

    private async generateIslandRoads(anim: boolean, profiler: GenerationProfiler): Promise<void> {
        profiler.time('island water', () => this.coastline.generateRoads());

        const landPolygon = this.coastline.landPolygonWorld;
        const riverPolygon = this.coastline.riverPolygonWorld;

        this.tensorField.landPolygon = [];
        this.tensorField.river = riverPolygon;
        this.tensorField.parks = [];

        await profiler.timeAsync('main roads open world', () => this.mainRoads.generateRoads());
        await profiler.timeAsync('major roads open world', () => this.majorRoads.generateRoads(anim));
        await profiler.timeAsync('minor roads open world', () => this.minorRoads.generateRoads(anim));

        profiler.time('clip roads to island', () => {
            this.mainRoads.replaceStreamlines(this.clipRoadSetToLand(this.mainRoads.allStreamlines, landPolygon));
            this.majorRoads.replaceStreamlines(this.clipRoadSetToLand(this.majorRoads.allStreamlines, landPolygon));
            this.minorRoads.replaceStreamlines(this.clipRoadSetToLand(this.minorRoads.allStreamlines, landPolygon));
        });

        this.tensorField.landPolygon = landPolygon;
        this.tensorField.river = riverPolygon;
    }

    private clipRoadSetToLand(roads: Vector[][], landPolygon: Vector[]): Vector[][] {
        const minLength = this.minorParams.dstep * 4;
        const clipped: Vector[][] = [];
        for (const road of roads) {
            for (const segment of PolygonUtil.clipPolylineToPolygon(road, landPolygon)) {
                if (this.streamlineLength(segment) >= minLength) {
                    clipped.push(segment);
                }
            }
        }
        return clipped;
    }

    private trimRiverStubs(riverPolygon: Vector[]): void {
        if (riverPolygon.length < 3) return;
        const trimDistance = this.coastlineParams.riverBankSize;
        const probeDistance = this.minorParams.dstep * 2;
        const minLength = this.minorParams.dstep * 4;

        const trim = (roads: Vector[][]): Vector[][] =>
            roads
                .map(road => this.trimRoadStubEnds(road, riverPolygon, trimDistance, probeDistance))
                .filter(road => road.length >= 2 && this.streamlineLength(road) >= minLength);

        this.mainRoads.replaceStreamlines(trim(this.mainRoads.allStreamlines));
        this.majorRoads.replaceStreamlines(trim(this.majorRoads.allStreamlines));
        this.minorRoads.replaceStreamlines(trim(this.minorRoads.allStreamlines));
    }

    private trimRoadStubEnds(road: Vector[], riverPolygon: Vector[], trimDistance: number, probeDistance: number): Vector[] {
        const checkAndTrimEnd = (poly: Vector[]): Vector[] => {
            if (poly.length < 2) return poly;
            const last = poly[poly.length - 1];
            const prev = poly[poly.length - 2];
            if (last.distanceTo(prev) < 1e-6) return poly;
            const dir = last.clone().sub(prev);
            const probe = last.clone().add(dir.setLength(probeDistance));
            if (!PolygonUtil.insidePolygon(probe, riverPolygon)) return poly;
            if (this.isBridgeEndpoint(last)) return poly;
            return this.trimFromEnd(poly, trimDistance);
        };

        let result = checkAndTrimEnd(road.slice());

        if (result.length >= 2) {
            result.reverse();
            result = checkAndTrimEnd(result);
            result.reverse();
        }

        return result;
    }

    private isBridgeEndpoint(point: Vector): boolean {
        const threshold = this.minorParams.dsep;
        return this.bridges.some(b =>
            b.start.distanceTo(point) < threshold ||
            b.end.distanceTo(point) < threshold
        );
    }

    private trimFromEnd(polyline: Vector[], trimDistance: number): Vector[] {
        const result = polyline.slice();
        let accumulated = 0;
        while (result.length >= 2) {
            const last = result[result.length - 1];
            const prev = result[result.length - 2];
            const segLen = last.distanceTo(prev);
            if (accumulated + segLen >= trimDistance) {
                const remaining = trimDistance - accumulated;
                result[result.length - 1] = last.clone().add(prev.clone().sub(last).setLength(remaining));
                break;
            }
            accumulated += segLen;
            result.pop();
        }
        return result.length >= 2 ? result : [];
    }

    private applyBridgeLayer(): void {
        const barriers = this.coastline.waterBarriersWorld;
        this.bridges = [];
        this.lastBridgeDetail = '0/0 bridges accepted';
        if (barriers.length === 0) return;

        const coastlineRoad = this.coastline.coastlineRoadWorld;

        const generator = new BridgeGenerator();
        const result = generator.generate({
            roads: {
                main: this.mainRoads.allStreamlines,
                coast: coastlineRoad.length >= 2 ? [coastlineRoad] : [],
                major: this.majorRoads.allStreamlines,
                minor: this.minorRoads.allStreamlines,
            },
            barriers,
        });

        this.mainRoads.replaceStreamlines(this.filterRoads(result.roads.main, 'main'));
        this.coastline.replaceCoastlineRoad(this.filterRoads(result.roads.coast, 'main'));
        this.majorRoads.replaceStreamlines(this.filterRoads(result.roads.major, 'major'));
        this.minorRoads.replaceStreamlines(this.filterRoads(result.roads.minor, 'minor'));
        this.bridges = result.bridges;
        this.lastBridgeDetail = `${result.bridges.length}/${result.candidates} bridges accepted`;
    }

    private filterRoads(roads: Vector[][], roadClass: BridgeRoadClass): Vector[][] {
        const minLength = roadClass === 'minor' ? this.minorParams.dstep * 4 : this.minorParams.dstep * 8;
        return roads.filter(road => this.streamlineLength(road) >= minLength);
    }

    private usesIslandClip(): boolean {
        return this.mapShape === 'island-jagged' || this.mapShape === 'island-smooth';
    }

    private formatPolygonStats(stats: { candidates: number; accepted: number; filterMs: number; preciseWaterChecks: number } | null): string {
        if (!stats) return '';
        return `${stats.accepted}/${stats.candidates} accepted, ${stats.preciseWaterChecks} precise checks, filter ${stats.filterMs.toFixed(1)}ms`;
    }

    private streamlineLength(streamline: Vector[]): number {
        let length = 0;
        for (let i = 1; i < streamline.length; i++) {
            length += streamline[i - 1].distanceTo(streamline[i]);
        }
        return length;
    }

    update(): void {
        let continueUpdate = true;
        const start = performance.now();
        while (continueUpdate && performance.now() - start < this.animationSpeed) {
            const minorChanged = this.minorRoads.update();
            const majorChanged = this.majorRoads.update();
            const mainChanged = this.mainRoads.update();
            const buildingsChanged = this.buildings.update();
            continueUpdate = minorChanged || majorChanged || mainChanged || buildingsChanged;
        }
        this.redraw = this.redraw || continueUpdate;
    }

    draw(style: Style, forceDraw = false, customCanvas?: CanvasWrapper): void {
        if (!style.needsUpdate && !forceDraw && !this.redraw && !this.domainController.moved) {
            return;
        }

        style.needsUpdate = false;
        this.domainController.moved = false;
        this.redraw = false;

        style.seaPolygon = this.coastline.seaPolygon;
        style.landPolygon = this.coastline.landPolygon;
        style.coastline = this.coastline.coastline;
        style.river = this.coastline.river;
        style.bridges = this.bridges.map(bridge => ({
            ...bridge,
            start: this.domainController.worldToScreen(bridge.start.clone()),
            end: this.domainController.worldToScreen(bridge.end.clone()),
            center: this.domainController.worldToScreen(bridge.center.clone()),
        }));
        style.lots = this.buildings.lots;

        if ((style instanceof DefaultStyle && style.showBuildingModels) || style instanceof RoughStyle) {
            style.buildingModels = this.buildings.models;
        }

        style.parks = [];
        style.parks.push(...this.bigParks.map(p => p.map(v => this.domainController.worldToScreen(v.clone()))));
        style.parks.push(...this.smallParks.map(p => p.map(v => this.domainController.worldToScreen(v.clone()))));
        style.minorRoads = this.minorRoads.roads;
        style.majorRoads = this.majorRoads.roads;
        style.mainRoads = this.mainRoads.roads;
        style.coastlineRoads = this.coastline.roads;
        style.secondaryRiver = this.coastline.secondaryRiver;
        style.draw(customCanvas);
    }

    roadsEmpty(): boolean {
        return this.majorRoads.roadsEmpty()
            && this.minorRoads.roadsEmpty()
            && this.mainRoads.roadsEmpty()
            && this.coastline.roadsEmpty();
    }

    public get seaPolygon(): Vector[] {
        return this.coastline.seaPolygon;
    }

    public get riverPolygon(): Vector[] {
        return this.coastline.river;
    }

    public get buildingModels(): BuildingModel[] {
        return this.buildings.models;
    }

    public getBlocks(): Promise<Vector[][]> {
        return this.buildings.getBlocks();
    }

    public get minorRoadPolygons(): Vector[][] {
        return this.minorRoads.roads.map(r => PolygonUtil.resizeGeometry(r, 1 * this.domainController.zoom, false));
    }

    public get majorRoadPolygons(): Vector[][] {
        return this.majorRoads.roads.concat([this.coastline.secondaryRiver]).map(r => PolygonUtil.resizeGeometry(r, 2 * this.domainController.zoom, false));
    }

    public get mainRoadPolygons(): Vector[][] {
        return this.mainRoads.roads.concat(this.coastline.roads).map(r => PolygonUtil.resizeGeometry(r, 2.5 * this.domainController.zoom, false));
    }

    public get coastlinePolygon(): Vector[] {
        return PolygonUtil.resizeGeometry(this.coastline.coastline, 15 * this.domainController.zoom, false);
    }
}
