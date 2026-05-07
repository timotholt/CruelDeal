/**
 * Stub: ModelGenerator is not used in Phase 1 (STL/3D export not needed).
 * This file stubs out the class to satisfy imports from main_gui.ts.
 */
import Vector from './vector';
import { BuildingModel } from './ui/buildings';

export default class ModelGenerator {
    constructor(
        _tensorField: unknown,
        _seaPolygon: Vector[],
        _lots: Vector[][],
        _buildingModels: BuildingModel[],
        _mainRoads: Vector[][],
        _majorRoads: Vector[][],
        _minorRoads: Vector[][],
        _coastline: Vector[],
        _river: Vector[],
        _seaBuffer: number,
        _buildingHeight: number,
    ) {}

    downloadZip(_dstep: number): void {
        console.warn('ModelGenerator.downloadZip: STL export not available in Phase 1');
    }
}
