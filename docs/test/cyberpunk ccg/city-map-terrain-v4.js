(function () {
  "use strict";

  const {
    VIEW_W,
    VIEW_H
  } = window.CityMapConfigV3;

  const {
    pointInPolygon,
    polygonArea,
    polygonCentroid,
    pointToSegmentDist,
    pointToPolygonSignedDist,
    polygonToPolygonDist,
    polygonBBox,
    closestPointOnPolygon,
    distToRiver
  } = window.CityMapGeometryV3;

  const {
    polygonToPath,
    smoothClosedPath
  } = window.CityMapPathsV3;

  const {
    generateLandPolygon
  } = window.CityMapLandV3;

  const {
    generateRivers
  } = window.CityMapWaterV3;

  const MIN_ISLAND_CHANNEL = 14;
  const MIN_LAKE_COAST_CLEARANCE = 18;

  function viewportPolygon() {
    return [
      { x: 0, y: 0 },
      { x: VIEW_W, y: 0 },
      { x: VIEW_W, y: VIEW_H },
      { x: 0, y: VIEW_H }
    ];
  }

  function polygonEdges(polygon) {
    const edges = [];
    for (let i = 0; i < polygon.length; i++) {
      edges.push({
        a: polygon[i],
        b: polygon[(i + 1) % polygon.length],
        index: i
      });
    }
    return edges;
  }

  function visibleSampleArea(polygon, step = 8) {
    let count = 0;
    for (let x = step / 2; x < VIEW_W; x += step) {
      for (let y = step / 2; y < VIEW_H; y += step) {
        if (pointInPolygon({ x, y }, polygon)) count++;
      }
    }
    return count * step * step;
  }

  function pointEdgeDistance(point, polygon) {
    let best = Infinity;
    for (const edge of polygonEdges(polygon)) {
      best = Math.min(best, pointToSegmentDist(point.x, point.y, edge.a, edge.b));
    }
    return best;
  }

  function allPointsInside(poly, container, minEdgeClearance = 0) {
    for (const p of poly) {
      if (!pointInPolygon(p, container)) return false;
      if (minEdgeClearance > 0 && pointEdgeDistance(p, container) < minEdgeClearance) return false;
    }
    return true;
  }

  function makeBlob(cx, cy, radius, rng, sides = 18, variance = 0.34) {
    const pts = [];
    const phase = rng() * Math.PI * 2;
    const xSquash = 0.72 + rng() * 0.62;
    const ySquash = 0.72 + rng() * 0.62;
    for (let i = 0; i < sides; i++) {
      const a = phase + (Math.PI * 2 * i) / sides;
      const noise =
        1 +
        Math.sin(a * 2.1 + phase) * variance * 0.28 +
        Math.sin(a * 3.7 + phase * 0.7) * variance * 0.22 +
        (rng() - 0.5) * variance;
      pts.push({
        x: cx + Math.cos(a) * radius * xSquash * noise,
        y: cy + Math.sin(a) * radius * ySquash * noise
      });
    }
    return pts;
  }

  function coastClassification(midpoint, centroid, avgRadius) {
    const d = Math.hypot(midpoint.x - centroid.x, midpoint.y - centroid.y);
    if (d < avgRadius * 0.76) return "inlet";
    if (d > avgRadius * 1.12) return "headland";
    return "coast";
  }

  function buildCoastline(landmasses) {
    const edges = [];
    const docksAllowedEdges = [];
    const bridgeAllowedEdges = [];

    for (const landmass of landmasses) {
      const centroid = landmass.centroid;
      const radii = landmass.polygon.map(p => Math.hypot(p.x - centroid.x, p.y - centroid.y));
      const avgRadius = radii.reduce((sum, r) => sum + r, 0) / Math.max(1, radii.length);

      for (const edge of polygonEdges(landmass.polygon)) {
        const dx = edge.b.x - edge.a.x;
        const dy = edge.b.y - edge.a.y;
        const length = Math.hypot(dx, dy);
        const midpoint = {
          x: (edge.a.x + edge.b.x) / 2,
          y: (edge.a.y + edge.b.y) / 2
        };
        let nx = -dy / (length || 1);
        let ny = dx / (length || 1);
        const towardCenter = (centroid.x - midpoint.x) * nx + (centroid.y - midpoint.y) * ny;
        if (towardCenter > 0) {
          nx = -nx;
          ny = -ny;
        }
        const kind = coastClassification(midpoint, centroid, avgRadius);
        const id = `${landmass.id}:edge:${edge.index}`;
        const data = {
          id,
          landmassId: landmass.id,
          index: edge.index,
          a: edge.a,
          b: edge.b,
          length,
          midpoint,
          outward: { x: nx, y: ny },
          kind,
          dockable: length >= 24 && kind !== "inlet",
          bridgeable: length >= 18
        };
        edges.push(data);
        if (data.dockable) docksAllowedEdges.push(id);
        if (data.bridgeable) bridgeAllowedEdges.push(id);
      }
    }

    return { edges, docksAllowedEdges, bridgeAllowedEdges };
  }

  function makeLandmass(id, kind, polygon, extra = {}) {
    return {
      id,
      kind,
      isPrimary: kind === "mainland",
      polygon,
      path: smoothClosedPath(polygon),
      hardPath: polygonToPath(polygon),
      area: polygonArea(polygon),
      visibleArea: visibleSampleArea(polygon),
      centroid: polygonCentroid(polygon),
      bbox: polygonBBox(polygon),
      ...extra
    };
  }

  function makeIslandCandidate(landPolygon, rng) {
    const side = Math.floor(rng() * 4);
    const waterPad = 16;
    let cx, cy;
    if (side === 0) {
      cx = -waterPad + rng() * (VIEW_W + waterPad * 2);
      cy = 18 + rng() * 74;
    } else if (side === 1) {
      cx = VIEW_W - 74 + rng() * 92;
      cy = -waterPad + rng() * (VIEW_H + waterPad * 2);
    } else if (side === 2) {
      cx = -waterPad + rng() * (VIEW_W + waterPad * 2);
      cy = VIEW_H - 74 + rng() * 92;
    } else {
      cx = -18 + rng() * 92;
      cy = -waterPad + rng() * (VIEW_H + waterPad * 2);
    }

    if (pointInPolygon({ x: cx, y: cy }, landPolygon)) return null;

    const radius = 22 + rng() * 46;
    const poly = makeBlob(cx, cy, radius, rng, 16 + Math.floor(rng() * 7), 0.38);
    const visibleVerts = poly.filter(p => p.x > -6 && p.x < VIEW_W + 6 && p.y > -6 && p.y < VIEW_H + 6).length;
    if (visibleVerts < 4) return null;
    if (polygonToPolygonDist(poly, landPolygon) < MIN_ISLAND_CHANNEL) return null;
    return poly;
  }

  function generateTerrainIslands(landPolygon, rng, riverSegments) {
    const visibleLand = visibleSampleArea(landPolygon);
    const waterFraction = Math.max(0, 1 - visibleLand / (VIEW_W * VIEW_H));
    if (waterFraction < 0.18) return [];

    const target = waterFraction > 0.42 ? 2 : (rng() < 0.58 ? 1 : 0);
    const islands = [];
    for (let attempt = 0; attempt < 90 && islands.length < target; attempt++) {
      const poly = makeIslandCandidate(landPolygon, rng);
      if (!poly) continue;
      if (riverSegments && riverSegments.length) {
        const tooCloseToRiver = poly.some(p => distToRiver(p.x, p.y, riverSegments) < 12);
        if (tooCloseToRiver) continue;
      }
      let tooCloseToIsland = false;
      for (const existing of islands) {
        if (polygonToPolygonDist(poly, existing.polygon) < 16) {
          tooCloseToIsland = true;
          break;
        }
      }
      if (tooCloseToIsland) continue;
      islands.push(makeLandmass(`island-${islands.length + 1}`, "island", poly, {
        minimumChannel: polygonToPolygonDist(poly, landPolygon)
      }));
    }
    return islands;
  }

  function generateLake(landPolygon, rng, riverSegments) {
    if (rng() > 0.38) return null;
    const bbox = polygonBBox(landPolygon);
    for (let attempt = 0; attempt < 70; attempt++) {
      const cx = Math.max(30, Math.min(VIEW_W - 30, bbox.minX + rng() * bbox.w));
      const cy = Math.max(30, Math.min(VIEW_H - 30, bbox.minY + rng() * bbox.h));
      if (!pointInPolygon({ x: cx, y: cy }, landPolygon)) continue;
      if (pointToPolygonSignedDist({ x: cx, y: cy }, landPolygon) < MIN_LAKE_COAST_CLEARANCE + 8) continue;
      if (riverSegments && distToRiver(cx, cy, riverSegments) < 26) continue;

      const radius = 12 + rng() * 24;
      const poly = makeBlob(cx, cy, radius, rng, 13 + Math.floor(rng() * 5), 0.28);
      if (!allPointsInside(poly, landPolygon, MIN_LAKE_COAST_CLEARANCE)) continue;
      if (riverSegments && poly.some(p => distToRiver(p.x, p.y, riverSegments) < 18)) continue;
      return {
        id: "lake-1",
        kind: "lake",
        polygon: poly,
        path: smoothClosedPath(poly),
        area: polygonArea(poly),
        centroid: polygonCentroid(poly),
        bbox: polygonBBox(poly)
      };
    }
    return null;
  }

  function riverWaterBodies(rivers) {
    if (!rivers) return [];
    const bodies = [];
    const source = rivers.rivers || [rivers];
    source.forEach((river, index) => {
      bodies.push({
        id: `river-${index + 1}`,
        kind: "river",
        path: river.path,
        pts: river.pts,
        segments: river.segments,
        outerWidth: river.outerWidth,
        innerWidth: river.innerWidth,
        buildingBuffer: river.buildingBuffer,
        widthScale: river.widthScale
      });
    });
    return bodies;
  }

  function buildChannels(mainland, islands) {
    return islands.map((island) => {
      const islandCentroid = island.centroid;
      const mainlandPoint = closestPointOnPolygon(islandCentroid.x, islandCentroid.y, mainland.polygon);
      const islandPoint = closestPointOnPolygon(mainlandPoint.x, mainlandPoint.y, island.polygon);
      return {
        id: `channel-${mainland.id}-${island.id}`,
        kind: "island-channel",
        landmassIds: [mainland.id, island.id],
        minWidth: polygonToPolygonDist(mainland.polygon, island.polygon),
        centerline: [mainlandPoint, islandPoint],
        bridgeAllowed: island.visibleArea > 420
      };
    });
  }

  function makeElevation(rng, landmasses) {
    const hills = [];
    const primary = landmasses[0];
    const hillCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < hillCount; i++) {
      const bbox = primary.bbox;
      let x = primary.centroid.x;
      let y = primary.centroid.y;
      for (let attempt = 0; attempt < 30; attempt++) {
        const px = bbox.minX + rng() * bbox.w;
        const py = bbox.minY + rng() * bbox.h;
        if (pointInPolygon({ x: px, y: py }, primary.polygon)) {
          x = px;
          y = py;
          break;
        }
      }
      hills.push({
        id: `hill-${i + 1}`,
        x,
        y,
        radius: 80 + rng() * 130,
        height: 0.12 + rng() * 0.34
      });
    }
    return {
      base: 0,
      hills,
      shadowHint: { azimuth: -0.72, elevation: 0.55 }
    };
  }

  function sampleElevation(x, y, terrain) {
    if (!terrain || !terrain.elevation) return 0;
    let h = terrain.elevation.base || 0;
    for (const hill of terrain.elevation.hills || []) {
      const d = Math.hypot(x - hill.x, y - hill.y);
      const t = Math.max(0, 1 - d / hill.radius);
      h += hill.height * t * t * (3 - 2 * t);
    }
    return h;
  }

  function generateTerrain(rng) {
    const mainlandPolygon = generateLandPolygon(rng);
    const river = generateRivers(mainlandPolygon, rng);
    const riverSegments = river ? river.segments : [];
    const mainland = makeLandmass("mainland", "mainland", mainlandPolygon);
    const islands = generateTerrainIslands(mainlandPolygon, rng, riverSegments);
    const lake = generateLake(mainlandPolygon, rng, riverSegments);
    const landmasses = [mainland, ...islands];
    const waterBodies = [
      {
        id: "ocean",
        kind: "ocean",
        polygon: viewportPolygon(),
        path: polygonToPath(viewportPolygon()),
        area: VIEW_W * VIEW_H
      },
      ...riverWaterBodies(river),
      ...(lake ? [lake] : [])
    ];

    return {
      version: 1,
      bounds: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
      landmasses,
      mainland,
      waterBodies,
      coastline: buildCoastline(landmasses),
      channels: buildChannels(mainland, islands),
      elevation: makeElevation(rng, landmasses)
    };
  }

  function buildTerrain(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    return generateTerrain(window.makeRng(normalizedSeed));
  }

  function terrainSummary(terrain) {
    return {
      landmasses: terrain.landmasses.length,
      islands: terrain.landmasses.filter(l => l.kind === "island").length,
      waterBodies: terrain.waterBodies.length,
      rivers: terrain.waterBodies.filter(w => w.kind === "river").length,
      lakes: terrain.waterBodies.filter(w => w.kind === "lake").length,
      coastlineEdges: terrain.coastline.edges.length,
      channels: terrain.channels.length
    };
  }

  window.CityMapTerrainV4 = {
    MIN_ISLAND_CHANNEL,
    buildTerrain,
    generateTerrain,
    sampleElevation,
    terrainSummary
  };
})();
