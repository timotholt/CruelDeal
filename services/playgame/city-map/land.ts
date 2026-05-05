import { VIEW_H, VIEW_W } from "./config";
import { pointInPolygon, pointToSegmentDist, polygonBBox, polygonCentroid } from "./geometry";
import { polygonToPath, rectPolygon } from "./paths";

type Rng = () => number;

export interface TerrainPoint {
  x: number;
  y: number;
  edgeKind?: string;
}

export interface DockPlan {
  path: string;
  polygon: TerrainPoint[];
}

export function generateLandPolygon(rng: Rng): TerrainPoint[] {
  const modeRoll = rng();
  const exposedMode = modeRoll < 0.35;
  const fjordMode = !exposedMode && modeRoll < 0.6;

  const N = 40;
  const phaseA = rng() * Math.PI * 2;
  const phaseB = rng() * Math.PI * 2;
  const phaseC = rng() * Math.PI * 2;
  const phaseD = rng() * Math.PI * 2;

  const biteCount = 2 + Math.floor(rng() * 3);
  const biteAngles = [];
  for (let b = 0; b < biteCount; b++) biteAngles.push(rng() * Math.PI * 2);
  const biteDepths = biteAngles.map(() => 0.08 + rng() * 0.12);
  const biteWidths = biteAngles.map(() => 0.9 + rng() * 0.8);

  const fjordAngle = rng() * Math.PI * 2;
  const fjordDepth = 0.28 + rng() * 0.18;
  const fjordWidth = 0.55 + rng() * 0.3;

  const distToViewportEdge = (cx: number, cy: number, dx: number, dy: number) => {
    const tx = dx > 0 ? (VIEW_W - cx) / dx : dx < 0 ? -cx / dx : 1e9;
    const ty = dy > 0 ? (VIEW_H - cy) / dy : dy < 0 ? -cy / dy : 1e9;
    return Math.min(Math.abs(tx), Math.abs(ty));
  };

  const harborBiteTotal = (angle: number) => {
    let sum = 0;
    for (let b = 0; b < biteCount; b++) {
      const c = Math.cos(angle - biteAngles[b]);
      sum -= biteDepths[b] * Math.max(0, Math.pow(Math.max(0, c), biteWidths[b]));
    }
    if (fjordMode) {
      const fc = Math.cos(angle - fjordAngle);
      sum -= fjordDepth * Math.max(0, Math.pow(Math.max(0, fc), fjordWidth * 2.5));
    }
    return sum;
  };

  const exposeAngle = exposedMode ? rng() * Math.PI * 2 : 0;
  const cx = VIEW_W / 2 + (rng() - 0.5) * (exposedMode ? 120 : 140);
  const cy = VIEW_H / 2 + (rng() - 0.5) * (exposedMode ? 120 : 140);
  const verts: TerrainPoint[] = [];

  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.22;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const dEdge = distToViewportEdge(cx, cy, dx, dy);
    const directional = exposedMode ? 1 - 0.28 * Math.cos(angle - exposeAngle) : 1.02;
    const bites = harborBiteTotal(angle);
    const r1 = (exposedMode ? 0.1 : 0.12) * Math.cos(angle + phaseA);
    const r2 = (exposedMode ? 0.07 : 0.08) * Math.cos(angle * 3 + phaseB);
    const r3 = (exposedMode ? 0.04 : 0.045) * Math.cos(angle * 6 + phaseC);
    const r4 = (exposedMode ? 0.022 : 0.024) * Math.cos(angle * 11 + phaseD);
    const jitter = (rng() - 0.5) * 0.1;
    const k = Math.max(0.42, directional + bites + r1 + r2 + r3 + r4 + jitter);
    verts.push({ x: cx + dx * dEdge * k, y: cy + dy * dEdge * k, edgeKind: "coast" });
  }

  return verts;
}

export function generateCoastDocks(
  landPolygon: TerrainPoint[],
  rng: Rng,
  riverSegments: Array<{ a: TerrainPoint; b: TerrainPoint }> = []
): DockPlan[] {
  const docks: DockPlan[] = [];
  const dockBBoxes: Array<{ minX: number; maxX: number; minY: number; maxY: number }> = [];
  const centroid = polygonCentroid(landPolygon);
  const overlapsDock = (box: { minX: number; maxX: number; minY: number; maxY: number }) =>
    dockBBoxes.some(
      (b) => box.maxX + 1.2 > b.minX && box.minX - 1.2 < b.maxX && box.maxY + 1.2 > b.minY && box.minY - 1.2 < b.maxY
    );

  for (let i = 0; i < landPolygon.length; i++) {
    const a = landPolygon[i];
    const b = landPolygon[(i + 1) % landPolygon.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 112) continue;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (mx < -32 || mx > VIEW_W + 32 || my < -32 || my > VIEW_H + 32) continue;

    const p1x = -dy / segLen;
    const p1y = dx / segLen;
    const awayX = mx - centroid.x;
    const awayY = my - centroid.y;
    const outward = p1x * awayX + p1y * awayY > 0 ? { x: p1x, y: p1y } : { x: -p1x, y: -p1y };
    if (pointInPolygon({ x: mx + outward.x * 8, y: my + outward.y * 8 }, landPolygon)) continue;

    const clusterCount = rng() < 0.58 ? 1 : 2;
    for (let cluster = 0; cluster < clusterCount; cluster++) {
      if (rng() < 0.3) continue;
      const clusterT = 0.18 + rng() * 0.64;
      const longTwin = rng() < 0.18 && segLen > 144;
      const dockCount = longTwin ? 2 : 3 + Math.floor(rng() * 3);
      const pierW = longTwin ? 9.6 : 13.6;
      const pierLen = longTwin ? 70 : 45.6;
      const spacing = longTwin ? 18.8 : 21.6;
      const clusterWidth = spacing * (dockCount - 1);
      const angle = Math.atan2(outward.y, outward.x) + Math.PI / 2;
      const candidate: Array<{ path: string; polygon: TerrainPoint[]; box: ReturnType<typeof polygonBBox> }> = [];
      const pierHitsRiver = (poly: TerrainPoint[]) => riverSegments.some((seg) => poly.some((p) => pointToSegmentDist(p.x, p.y, seg.a, seg.b) < 52));

      for (let k = 0; k < dockCount; k++) {
        const along = (k - (dockCount - 1) / 2) * spacing;
        const t = clusterT + along / segLen;
        if (t < 0.08 || t > 0.92 || clusterWidth > segLen * 0.55) continue;
        const baseX = a.x + dx * t;
        const baseY = a.y + dy * t;
        const cx = baseX + outward.x * (pierLen / 2 - 2.4);
        const cy = baseY + outward.y * (pierLen / 2 - 2.4);
        if (cx < -16 || cx > VIEW_W + 16 || cy < -16 || cy > VIEW_H + 16) continue;
        const poly = rectPolygon(cx, cy, pierW, pierLen, angle);
        if (pierHitsRiver(poly)) continue;
        const box = polygonBBox(poly);
        if (overlapsDock(box)) continue;
        candidate.push({ path: polygonToPath(poly), polygon: poly, box });
      }

      if (candidate.length < 2) continue;
      for (const dock of candidate) {
        docks.push({ path: dock.path, polygon: dock.polygon });
        dockBBoxes.push(dock.box);
      }
    }
  }

  return docks;
}
