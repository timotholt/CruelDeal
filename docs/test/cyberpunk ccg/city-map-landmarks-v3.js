(function () {
  "use strict";

  const {
    MICRO_LANDMARK_SHAPES: _MICRO_LANDMARK_SHAPES
  } = window.CityMapConfigV3;
  const {
    pointInPolygon: _pointInPolygon,
    polygonArea: _polygonArea,
    polygonCentroid: _polygonCentroid,
    pointToSegmentDist: _pointToSegmentDist
  } = window.CityMapGeometryV3;
  const {
    polygonToPath: _polygonToPath
  } = window.CityMapPathsV3;
  const {
    nearestLandmarkDistance: _nearestLandmarkDistance,
    weightedPickRemove: _weightedPickRemove
  } = window.CityMapPartitionV3;

  function generateDistrictLandmarks(districts, rng, cityGridAngle) {
    for (const d of districts) {
      const big = d.leafBlocks.filter(lb => lb.bigLandmark);
      const small = d.leafBlocks.filter(lb => !lb.bigLandmark);
      const picks = [];
      if (big.length > 0) {
        const sortedBig = big
          .map(lb => ({
            lb,
            dist: Math.hypot(_polygonCentroid(lb.polygon).x - d.centroid.x,
                             _polygonCentroid(lb.polygon).y - d.centroid.y)
          }))
          .sort((a, b) => a.dist - b.dist);
        picks.push({ lb: sortedBig[0].lb, big: true });
      } else {
        const sortedSmall = small
          .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
          .filter(x => x.area > 300 && x.area < 2500)
          .sort((a, b) => b.area - a.area + (rng() - 0.5) * 200);
        if (sortedSmall.length > 0) picks.push({ lb: sortedSmall[0].lb, big: false });
      }

      const numSmallExtra = 24 + Math.floor(rng() * 9);
      {
        const candidates = small
          .map(lb => ({ lb, area: _polygonArea(lb.polygon) }))
          .filter(x => x.area > 45 && x.area < 1500)
          .filter(x => !picks.some(p => p.lb === x.lb))
          .map(x => ({
            ...x,
            weight: Math.pow(1400 / Math.max(55, x.area), 1.35) * (0.75 + rng() * 0.5)
          }));
        for (let k = 0; k < numSmallExtra && candidates.length; k++) {
          const picked = _weightedPickRemove(candidates, rng);
          picks.push({ lb: picked.lb, big: false, area: picked.area });
        }
      }

      let stadiumUsed = false;
      for (const p of picks) {
        const lb = p.lb;
        let type;
        if (p.big) {
          const r = rng();
          if (!stadiumUsed && r < 0.30) {
            const sportR = rng();
            if (sportR < 0.34)      type = "stadium_soccer";
            else if (sportR < 0.67) type = "stadium_football";
            else                    type = "stadium_baseball";
            stadiumUsed = true;
          }
          else if (r < 0.30 + 0.40)     type = "mall";
          else                          type = "park";
        } else {
          const area = p.area != null ? p.area : _polygonArea(lb.polygon);
          let parkP, plazaP;
          if      (area <= 120)  { parkP = 0.995; plazaP = 0.005; }
          else if (area <= 220)  { parkP = 0.97; plazaP = 0.025; }
          else if (area <= 420)  { parkP = 0.88; plazaP = 0.09; }
          else if (area <= 800)  { parkP = 0.62; plazaP = 0.25; }
          else                    { parkP = 0.28; plazaP = 0.44; }
          const r = rng();
          if (r < parkP)               type = "park";
          else if (r < parkP + plazaP) type = "plaza";
          else                         type = "mall";

          if (type === "park") {
            const parkSpacing = area <= 120 ? 11 : (area <= 300 ? 16 : 24);
            const nearPark = _nearestLandmarkDistance(lb.polygon, d.landmarks, lm => lm.type === "park") < parkSpacing;
            if (nearPark) type = rng() < 0.68 ? "plaza" : "mall";
          }
        }
        d.landmarks.push({
          polygon: lb.polygon,
          path: _polygonToPath(lb.polygon),
          type
        });
      }

      // Disabled experiment retained here with the landmark policy it belongs
      // to. The tetromino sub-block landmarks read as floating debris at this
      // scale, but the code is useful if we revisit building-aligned cutouts.
      /*
      const usedBlocks = new Set(picks.map(p => p.lb));
      const microShapes = _MICRO_LANDMARK_SHAPES;
      for (const lb of d.leafBlocks) {
        if (usedBlocks.has(lb)) continue;
        if (rng() > 0.30) continue;
        const blockArea = _polygonArea(lb.polygon);
        if (blockArea < 220 || blockArea > 2200) continue;
        const c = _polygonCentroid(lb.polygon);
        let minR = Infinity;
        for (let i = 0; i < lb.polygon.length; i++) {
          const a = lb.polygon[i];
          const b = lb.polygon[(i + 1) % lb.polygon.length];
          const d2 = _pointToSegmentDist(c.x, c.y, a, b);
          if (d2 < minR) minR = d2;
        }
        const shape = microShapes[Math.floor(rng() * microShapes.length)];
        const fillFrac = 0.35 + rng() * 0.30;
        const scale = (minR * 2 * fillFrac) / shape.unitSize;
        const rot = cityGridAngle + (rng() < 0.5 ? 0 : Math.PI / 2);
        const cosR = Math.cos(rot), sinR = Math.sin(rot);
        const microPoly = shape.points.map(p => {
          const ux = (p.x - shape.unitSize / 2) * scale;
          const uy = (p.y - shape.unitSize / 2) * scale;
          return {
            x: c.x + ux * cosR - uy * sinR,
            y: c.y + ux * sinR + uy * cosR,
            edgeKind: "coast"
          };
        });
        let inside = true;
        for (const p of microPoly) {
          if (!_pointInPolygon(p, lb.polygon)) { inside = false; break; }
        }
        if (!inside) continue;
        const r = rng();
        const microType = (r < 0.55) ? "park" : (r < 0.85) ? "plaza" : "mall";
        d.landmarks.push({
          polygon: microPoly,
          path: _polygonToPath(microPoly),
          type: microType,
          micro: true
        });
      }
      */
    }
  }

  window.CityMapLandmarksV3 = {
    generateDistrictLandmarks
  };
})();
