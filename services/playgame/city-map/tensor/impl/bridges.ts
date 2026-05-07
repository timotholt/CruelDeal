import Vector from '../vector';

export type BridgeRoadClass = 'main' | 'major' | 'minor';
export type BridgeBarrierKind = 'river' | 'canal';

export interface WaterBarrier {
    id: string;
    kind: BridgeBarrierKind;
    polygon: Vector[];
    centerline?: Vector[];
}

export interface BridgeSegment {
    id: string;
    roadClass: BridgeRoadClass;
    barrierId: string;
    barrierKind: BridgeBarrierKind;
    start: Vector;
    end: Vector;
    center: Vector;
    width: number;
}
