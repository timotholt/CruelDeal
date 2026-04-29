(function () {
  "use strict";

  const {
    polygonArea,
    polygonBBox,
    pointInPolygon
  } = window.CityMapGeometryV3;

  const {
    polygonToPath
  } = window.CityMapPathsV3;

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function rotatePoint(px, py, cx, cy, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    return {
      x: cx + dx * c - dy * s,
      y: cy + dx * s + dy * c
    };
  }

  function rectFootprint(cx, cy, w, h, angle) {
    return [
      rotatePoint(cx - w / 2, cy - h / 2, cx, cy, angle),
      rotatePoint(cx + w / 2, cy - h / 2, cx, cy, angle),
      rotatePoint(cx + w / 2, cy + h / 2, cx, cy, angle),
      rotatePoint(cx - w / 2, cy + h / 2, cx, cy, angle)
    ];
  }

  function insetLikeFootprint(cell, scale, angleJitter) {
    const c = cell.centroid;
    const footprint = cell.polygon.map(p => ({
      x: c.x + (p.x - c.x) * scale,
      y: c.y + (p.y - c.y) * scale
    }));
    if (angleJitter === 0 || footprint.length < 3) return footprint;
    return footprint.map(p => rotatePoint(p.x, p.y, c.x, c.y, angleJitter));
  }

  function footprintInsideCell(footprint, cell) {
    return footprint.every(p => pointInPolygon(p, cell.polygon));
  }

  function specialFootprintAllowed(cell, rng) {
    const special =
      cell.tags.includes("coast") ||
      cell.tags.includes("riverfront") ||
      cell.tags.includes("lakefront") ||
      cell.tags.includes("bridgeheadCandidate");
    if (special && cell.area > 880) return rng() < 0.14;
    if (cell.area > 2400) return rng() < 0.05;
    return false;
  }

  function buildingCountForCell(cell, rng) {
    if (cell.tags.includes("parkCandidate") && cell.area > 1450 && rng() < 0.68) return 0;
    if (cell.tags.includes("hill") && rng() < 0.28) return 0;
    if (cell.density === "dense") return cell.area > 960 ? 2 + (rng() < 0.38 ? 1 : 0) : 1;
    if (cell.density === "medium") return cell.area > 1300 && rng() < 0.42 ? 2 : 1;
    return rng() < 0.54 ? 1 : 0;
  }

  function heightForCell(cell, rng) {
    let base = cell.density === "dense" ? 18 : cell.density === "medium" ? 11 : 6;
    if (cell.tags.includes("coast")) base *= 0.78;
    if (cell.tags.includes("riverfront")) base *= 1.12;
    if (cell.tags.includes("hill")) base *= 0.82;
    return Math.max(2.5, base * (0.72 + rng() * 0.86));
  }

  function makeCellBuilding(cell, index, rng) {
    const bbox = polygonBBox(cell.polygon);
    const countOffset = index === 0 ? -0.18 : index === 1 ? 0.18 : 0;
    const center = {
      x: cell.centroid.x + Math.cos(cell.orientation || 0) * bbox.w * countOffset,
      y: cell.centroid.y + Math.sin(cell.orientation || 0) * bbox.h * countOffset
    };
    if (!pointInPolygon(center, cell.polygon)) {
      center.x = cell.centroid.x;
      center.y = cell.centroid.y;
    }

    let footprint;
    const angle = (cell.fieldAngle || cell.orientation || 0) + (rng() - 0.5) * 0.18;
    if (specialFootprintAllowed(cell, rng)) {
      footprint = insetLikeFootprint(cell, 0.34 + rng() * 0.14, (rng() - 0.5) * 0.14);
    } else {
      const w = Math.max(5, Math.min(bbox.w * (0.24 + rng() * 0.18), 20));
      const h = Math.max(5, Math.min(bbox.h * (0.24 + rng() * 0.18), 24));
      footprint = rectFootprint(center.x, center.y, w, h, angle);
    }
    if (!footprintInsideCell(footprint, cell)) {
      const w = Math.max(4, Math.min(bbox.w * 0.22, 14));
      const h = Math.max(4, Math.min(bbox.h * 0.22, 16));
      footprint = rectFootprint(cell.centroid.x, cell.centroid.y, w, h, angle);
    }
    if (!footprintInsideCell(footprint, cell)) {
      footprint = insetLikeFootprint(cell, 0.18, 0);
    }
    const height = heightForCell(cell, rng);
    return {
      id: `${cell.id}:building:${index + 1}`,
      cellId: cell.id,
      landmassId: cell.landmassId,
      footprint,
      path: polygonToPath(footprint),
      area: polygonArea(footprint),
      baseElevation: 0,
      height,
      roofType: rng() < 0.78 ? "flat" : "stepped",
      material: cell.density === "dense" ? "dark-glass" : "blue-concrete",
      shadow: {
        azimuth: -0.72,
        length: height * 0.68,
        opacity: Math.min(0.42, 0.08 + height / 90)
      },
      render: {
        extrudable: true,
        staticMesh: true,
        lodGroup: height > 18 ? "tower" : height > 9 ? "midrise" : "lowrise"
      }
    };
  }

  function bridgeProximity(cell, bridges) {
    let best = Infinity;
    for (const bridge of bridges) {
      if (!bridge.center) continue;
      best = Math.min(best, dist(cell.centroid, bridge.center));
    }
    return best;
  }

  function generateBuildings(bridgeResult, rng) {
    const roadCellIds = new Set(bridgeResult.roadGraph.roadCells);
    const blockedCellIds = new Set(bridgeResult.roadGraph.blockedCells);
    const buildings = [];
    const openSpaces = [];
    const landmarks = [];

    for (const cell of bridgeResult.cells) {
      if (blockedCellIds.has(cell.id)) {
        openSpaces.push({ id: `${cell.id}:road-reserve`, kind: "roadReserve", cellId: cell.id });
        continue;
      }
      const nearBridge = bridgeProximity(cell, bridgeResult.bridgePlan.bridges) < 24;
      const roadPressure = roadCellIds.has(cell.id) ? 0.45 : 1;
      const count = nearBridge ? Math.max(0, buildingCountForCell(cell, rng) - 1) : buildingCountForCell(cell, rng);
      if (count === 0) {
        openSpaces.push({
          id: `${cell.id}:open-space`,
          kind: cell.tags.includes("parkCandidate") ? "park" : "setback",
          cellId: cell.id,
          tags: cell.tags
        });
        continue;
      }
      for (let i = 0; i < count; i++) {
        const building = makeCellBuilding(cell, i, rng);
        building.height *= roadPressure;
        buildings.push(building);
      }
      if (cell.area > 2200 && rng() < 0.18) {
        landmarks.push({
          id: `${cell.id}:landmark`,
          kind: "civic-block",
          cellId: cell.id,
          footprint: bridgeResult.cells.find(c => c.id === cell.id).polygon,
          height: 8 + rng() * 10,
          render: { extrudable: true, staticMesh: true, lodGroup: "landmark" }
        });
      }
    }

    return {
      version: 1,
      buildings,
      openSpaces,
      landmarks,
      staticScene: {
        shadowAzimuth: -0.72,
        shadowElevation: 0.55,
        cacheable: true
      }
    };
  }

  function buildStaticBuildings(seed = 1) {
    const normalizedSeed = Number.isFinite(seed) ? (seed >>> 0) || 1 : 1;
    const bridgeResult = window.CityMapBridgePlannerV4.buildBridgePlan(normalizedSeed);
    const buildingPlan = generateBuildings(bridgeResult, window.makeRng(normalizedSeed ^ 0xb171d));
    return { ...bridgeResult, buildingPlan };
  }

  function buildingSummary(result) {
    return {
      buildings: result.buildingPlan.buildings.length,
      openSpaces: result.buildingPlan.openSpaces.length,
      landmarks: result.buildingPlan.landmarks.length,
      towers: result.buildingPlan.buildings.filter(b => b.render.lodGroup === "tower").length,
      extrudable: result.buildingPlan.buildings.filter(b => b.render.extrudable).length
    };
  }

  window.CityMapBuildingsV4 = {
    buildStaticBuildings,
    generateBuildings,
    buildingSummary
  };
})();
