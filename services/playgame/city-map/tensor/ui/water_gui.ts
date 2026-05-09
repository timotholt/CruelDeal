import log from 'loglevel';
import * as dat from 'dat.gui';
import DomainController from './domain_controller';
import FieldIntegrator from '../impl/integrator';
import {StreamlineParams} from '../impl/streamlines';
import WaterGenerator, {WaterParams} from '../impl/water_generator';
import Vector from '../vector';
import RoadGUI from './road_gui';
import TensorField from '../impl/tensor_field';
import type { MapShape } from '../types';
import { WORLD_ORIGIN, WORLD_DIMENSIONS } from '../world';
import type { WaterBarrier } from '../impl/bridges';

export default class WaterGUI extends RoadGUI {
    protected streamlines: WaterGenerator;
    private mapShape: MapShape = 'peninsula';

    constructor(private tensorField: TensorField,
                protected params: WaterParams,
                integrator: FieldIntegrator,
                guiFolder: dat.GUI,
                closeTensorFolder: () => void,
                folderName: string,
                redraw: () => void) {
        super(params, integrator, guiFolder, closeTensorFolder, folderName, redraw);
        this.streamlines = new WaterGenerator(
            this.integrator, WORLD_ORIGIN,
            WORLD_DIMENSIONS,
            Object.assign({}, this.params), this.tensorField);
    }

    initFolder(): WaterGUI {
        const folder = this.guiFolder.addFolder(this.folderName);
        folder.add({ Generate: () => this.generateRoads() }, 'Generate');

        const coastParamsFolder = folder.addFolder('CoastParams');
        coastParamsFolder.add(this.params.coastNoise, 'noiseEnabled');
        coastParamsFolder.add(this.params.coastNoise, 'noiseSize');
        coastParamsFolder.add(this.params.coastNoise, 'noiseAngle');
        const riverParamsFolder = folder.addFolder('RiverParams');
        riverParamsFolder.add(this.params.riverNoise, 'noiseEnabled');
        riverParamsFolder.add(this.params.riverNoise, 'noiseSize');
        riverParamsFolder.add(this.params.riverNoise, 'noiseAngle');

        folder.add(this.params, 'simplifyTolerance');
        const devParamsFolder = folder.addFolder('Dev');
        this.addDevParamsToFolder(this.params, devParamsFolder);
        return this;
    }

    generateRoads(): Promise<void> {
        this.preGenerateCallback();

        this.streamlines = new WaterGenerator(
            this.integrator, WORLD_ORIGIN,
            WORLD_DIMENSIONS,
            Object.assign({}, this.params), this.tensorField);

        this.streamlines.createMapShape(this.mapShape);

        this.closeTensorFolder();
        this.redraw();
        this.postGenerateCallback();
        return Promise.resolve();
    }

    setMapShape(mapShape: MapShape): void {
        this.mapShape = mapShape;
    }

    get streamlinesWithSecondaryRoad(): Vector[][] {
        const withSecondary = this.streamlines.allStreamlinesSimple.slice();
        withSecondary.push(this.streamlines.riverSecondaryRoad);
        return withSecondary;
    }

    get river(): Vector[] {
        return this.streamlines.riverPolygon.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get secondaryRiver(): Vector[] {
        return this.streamlines.riverSecondaryRoad.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get coastline(): Vector[] {
        return this.streamlines.coastline.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get seaPolygon(): Vector[] {
        return this.streamlines.seaPolygon.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get landPolygon(): Vector[] {
        return this.streamlines.landPolygon.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get landPolygonWorld(): Vector[] {
        return this.streamlines.landPolygon.map(v => v.clone());
    }

    get coastlineRoadWorld(): Vector[] {
        return this.streamlines.allStreamlinesSimple[0] ?? [];
    }

    replaceCoastlineRoad(segments: Vector[][]): void {
        const rest = this.streamlines.allStreamlinesSimple.slice(1);
        const updated = [...segments, ...rest];
        this.streamlines.allStreamlinesSimple = updated;
        this.streamlines.allStreamlines = updated;
    }

    get riverPolygonWorld(): Vector[] {
        return this.streamlines.riverPolygon.map(v => v.clone());
    }

    get waterBarriersWorld(): WaterBarrier[] {
        const river = this.riverPolygonWorld;
        if (river.length < 3) return [];
        return [{
            id: 'river-0',
            kind: 'river',
            polygon: river,
        }];
    }

    protected addDevParamsToFolder(params: StreamlineParams, folder: dat.GUI): void {
        folder.add(params, 'dsep');
        folder.add(params, 'dtest');
        folder.add(params, 'pathIterations');
        folder.add(params, 'seedTries');
        folder.add(params, 'dstep');
        folder.add(params, 'dlookahead');
        folder.add(params, 'dcirclejoin');
        folder.add(params, 'joinangle');
    }
}
