(function () {
  "use strict";

  const { CELL_UNIT } = window.CityMapConfigV3;

  function cityV3DotPos(dot) {
    return { x: dot.x, y: dot.y };
  }

  function cityV3DotDistance(a, b) {
    if (a.districtIdx !== b.districtIdx) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y) / CELL_UNIT;
  }

  function whoCanThisCardSeeV3(dot, vis, placedCards, algo) {
    const seen = [];
    for (const other of placedCards) {
      if (other.dot.id === dot.id) continue;
      const d = cityV3DotDistance(dot, other.dot);
      const r = algo.range(vis, other.stealth);
      if (d <= r) seen.push(other);
    }
    return seen;
  }

  function whoCanSeeMeV3(dot, myStealth, placedCards, algo) {
    const seers = [];
    for (const other of placedCards) {
      if (other.dot.id === dot.id) continue;
      const d = cityV3DotDistance(dot, other.dot);
      const r = algo.range(other.vis, myStealth);
      if (d <= r) seers.push(other);
    }
    return seers;
  }

  window.CityMapRulesV3 = {
    cityV3DotPos,
    cityV3DotDistance,
    whoCanThisCardSeeV3,
    whoCanSeeMeV3
  };
})();
