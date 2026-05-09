import Vector from '../vector';
import PolygonUtil from './polygon_util';
import type { BridgeRoadClass, BridgeSegment, WaterBarrier } from './bridges';

export interface BridgeGenerationInput {
    roads: Record<BridgeRoadClass, Vector[][]>;
    barriers: WaterBarrier[];
}

export interface BridgeGenerationResult {
    roads: Record<BridgeRoadClass, Vector[][]>;
    bridges: BridgeSegment[];
    candidates: number;
}

const ROAD_CLASS_PRIORITY: BridgeRoadClass[] = ['main', 'coast', 'major', 'minor'];
const ROAD_WIDTH: Record<BridgeRoadClass, number> = {
    main: 10,
    coast: 10,
    major: 8,
    minor: 5,
};

const BRIDGE_SPACING = 150;
const MIN_BRIDGE_LENGTH = 12;
const MAX_BRIDGE_LENGTH = 220;

interface BridgeCandidate extends BridgeSegment {
    length: number;
    priority: number;
}

export default class BridgeGenerator {
    generate(input: BridgeGenerationInput): BridgeGenerationResult {
        const candidates: BridgeCandidate[] = [];
        const roads: Record<BridgeRoadClass, Vector[][]> = {
            main: input.roads.main.map(road => road.map(point => point.clone())),
            major: input.roads.major.map(road => road.map(point => point.clone())),
            minor: input.roads.minor.map(road => road.map(point => point.clone())),
        };

        for (const barrier of input.barriers) {
            if (barrier.polygon.length < 3) continue;
            for (const roadClass of ROAD_CLASS_PRIORITY) {
                roads[roadClass] = this.collectCandidatesAndCutRoads(
                    roads[roadClass],
                    roadClass,
                    barrier,
                    candidates
                );
            }
        }

        const bridges = this.selectBridges(candidates).map(candidate => ({
            id: candidate.id,
            roadClass: candidate.roadClass,
            barrierId: candidate.barrierId,
            barrierKind: candidate.barrierKind,
            start: candidate.start,
            end: candidate.end,
            center: candidate.center,
            width: candidate.width,
        }));

        return { roads, bridges, candidates: candidates.length };
    }

    private collectCandidatesAndCutRoads(
        roads: Vector[][],
        roadClass: BridgeRoadClass,
        barrier: WaterBarrier,
        candidates: BridgeCandidate[]
    ): Vector[][] {
        const cutRoads: Vector[][] = [];
        for (const road of roads) {
            for (const insideSegment of PolygonUtil.getPolylineInsidePolygon(road, barrier.polygon)) {
                const candidate = this.toCandidate(insideSegment, roadClass, barrier, candidates.length);
                if (candidate) candidates.push(candidate);
            }
            cutRoads.push(...PolygonUtil.cutPolylineFromPolygon(road, barrier.polygon));
        }
        return cutRoads;
    }

    private toCandidate(
        segment: Vector[],
        roadClass: BridgeRoadClass,
        barrier: WaterBarrier,
        index: number
    ): BridgeCandidate | null {
        if (segment.length < 2) return null;
        const start = segment[0].clone();
        const end = segment[segment.length - 1].clone();
        const length = start.distanceTo(end);
        if (length < MIN_BRIDGE_LENGTH || length > MAX_BRIDGE_LENGTH) return null;

        return {
            id: `${barrier.id}-${roadClass}-${index}`,
            roadClass,
            barrierId: barrier.id,
            barrierKind: barrier.kind,
            start,
            end,
            center: start.clone().add(end).divideScalar(2),
            width: ROAD_WIDTH[roadClass],
            length,
            priority: ROAD_CLASS_PRIORITY.indexOf(roadClass),
        };
    }

    private selectBridges(candidates: BridgeCandidate[]): BridgeCandidate[] {
        const selected: BridgeCandidate[] = [];
        const sorted = candidates.slice().sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return b.length - a.length;
        });

        for (const candidate of sorted) {
            const tooClose = selected.some(bridge =>
                bridge.barrierId === candidate.barrierId
                && bridge.center.distanceTo(candidate.center) < BRIDGE_SPACING
            );
            if (!tooClose) selected.push(candidate);
        }

        return selected;
    }
}
