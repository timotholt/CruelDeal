(function () {
  "use strict";

  const TYPE_META = {
    "park": {
      tier: "iconic", label: "Park", icon: "park", accent: "#69ffb8",
      names: ["Memorial Garden", "Chromeleaf Park", "Battery Grove", "Neon Commons"],
      bonus: "Cover cards gain +1 stealth here"
    },
    "stadium": {
      tier: "iconic", label: "Stadium", icon: "stadium", accent: "#ffd166",
      names: ["Neon Coliseum", "Sector Dome", "The Glass Bowl", "Prizefight Field"],
      bonus: "+1 Power to any card played here"
    },
    "lake": {
      tier: "iconic", label: "Lake", icon: "lake", accent: "#6ff7ff",
      names: ["Mirror Lake", "Blackwater Basin", "Crystal Reservoir", "Lake Aster"],
      bonus: "Stealth cards are harder to reveal here"
    },
    "bridge": {
      tier: "major", label: "Bridge", icon: "bridge", accent: "#f7b267",
      names: ["Crimson Span", "Delta Bridge", "Signal Crossing", "Avenue Overpass"],
      bonus: "Movement cards get +1 range here"
    },
    "tower": {
      tier: "major", label: "Tower", icon: "tower", accent: "#9bfffd",
      names: ["Onyx Spire", "Glass Tower", "Helix Arcology", "Spire One"],
      bonus: "Recon cards see +1 district band"
    },
    "department-store": {
      tier: "major", label: "Department Store", icon: "store", accent: "#ffdd87",
      names: ["Nakamura Goods", "MegaMart 9", "Kress Department", "Chrome Bazaar"],
      bonus: "Gear cards cost -1 here"
    },
    "hospital": {
      tier: "major", label: "Hospital", icon: "hospital", accent: "#8fffe0",
      names: ["St. Mercy", "Neon Cross", "Blackline Clinic", "Mercy Stack"],
      bonus: "Recover +2 when a card survives here"
    },
    "hotel": {
      tier: "major", label: "Hotel", icon: "hotel", accent: "#d7a6ff",
      names: ["Hotel Karma", "The Orchid", "Sleepless Tower", "Cyan Suites"],
      bonus: "Agents played here keep +1 stealth"
    },
    "dojo": {
      tier: "major", label: "Dojo", icon: "dojo", accent: "#ff8b70",
      names: ["Iron Fist Dojo", "Red Mat House", "Kata Nine", "Ghost Palm"],
      bonus: "+2 Power to melee cards"
    },
    "hideout": {
      tier: "major", label: "Hideout", icon: "hideout", accent: "#b8ff6a",
      names: ["Safehouse 7", "The Bunker", "Low Signal", "Black Room"],
      bonus: "Stealth cards cost -1 here"
    },
    "precinct": {
      tier: "major", label: "Precinct", icon: "precinct", accent: "#7da8ff",
      names: ["Block 9 PD", "Metro Watch", "Blueglass Station", "Civic Lockup"],
      bonus: "Reveal one hidden enemy after scoring"
    },
    "ripperdoc": {
      tier: "minor", label: "Ripperdoc", icon: "ripperdoc", accent: "#ff5d8f",
      names: ["Doc Bones", "Chrome Surgeon", "Mercy Needle", "The Back Room"],
      bonus: "Cyberware cards heal +1 here"
    },
    "hacker-den": {
      tier: "minor", label: "Hacker Den", icon: "hack", accent: "#77ffea",
      names: ["Cipher's Lair", "Null Cafe", "Root Cellar", "The Backslash"],
      bonus: "Hack cards get +1 Power here"
    },
    "gun-store": {
      tier: "minor", label: "Gun Store", icon: "gun", accent: "#ffb000",
      names: ["Cobra Arms", "Guns & Ammo", "Trigger Happy", "Iron Republic"],
      bonus: "+1 Power for weapon cards"
    },
    "ammo-store": {
      tier: "minor", label: "Ammo Store", icon: "ammo", accent: "#f77f00",
      names: ["Full Metal", "Bullet Pantry", "Hot Load", "Shell House"],
      bonus: "Weapon cards reload one spent counter"
    },
    "strip-club": {
      tier: "minor", label: "Strip Club", icon: "club", accent: "#ff5dce",
      names: ["Sadie's Slink", "Velvet Cage", "Pink Static", "Afterglow"],
      bonus: "+1 to charisma plays"
    },
    "bar": {
      tier: "minor", label: "Bar", icon: "bar", accent: "#ff7a59",
      names: ["Drunken Tiger", "Last Call", "Neon Whiskey", "Empty Magazine"],
      bonus: "Brawler cards get +1 Power here"
    },
    "ramen": {
      tier: "minor", label: "Ramen Shop", icon: "ramen", accent: "#ffe45e",
      names: ["Ichi Ramen", "Noodle 404", "Yakisoba Yamamoto", "Steam Bowl"],
      bonus: "First low-cost card here gets +1 Power"
    },
    "liquor": {
      tier: "minor", label: "Liquor Store", icon: "liquor", accent: "#caff8a",
      names: ["Booze Stop", "Bottle Ghost", "Nightcap", "Corner Proof"],
      bonus: "Risk cards get +1 Power here"
    },
    "pawn": {
      tier: "minor", label: "Pawn Shop", icon: "pawn", accent: "#c6a477",
      names: ["Five Finger", "Gold Tooth", "Cash Circuit", "Lucky Loan"],
      bonus: "Gear cards can be recycled here"
    },
    "convenience": {
      tier: "minor", label: "Convenience Store", icon: "mart", accent: "#9cfffa",
      names: ["24/7 Mart", "Quick Fix", "NanoStop", "Corner Light"],
      bonus: "Draw effects get +1 priority here"
    }
  };

  const LOWRISE_TYPES = ["gun-store", "ammo-store", "strip-club", "bar", "ramen", "liquor", "pawn", "convenience", "ripperdoc", "hacker-den"];
  const MIDRISE_TYPES = ["department-store", "hotel", "dojo", "hideout", "precinct", "ripperdoc", "hacker-den"];
  const TOWER_TYPES = ["tower", "department-store", "hospital", "hotel", "precinct", "hideout"];

  function hashString(value) {
    let h = 2166136261;
    const text = String(value || "");
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(list, key) {
    if (!list || !list.length) return null;
    return list[hashString(key) % list.length];
  }

  function centroidOf(points) {
    const geom = window.CityMapGeometryV3;
    if (geom && geom.polygonCentroid && points && points.length >= 3) return geom.polygonCentroid(points);
    let x = 0, y = 0;
    for (const p of points || []) { x += p.x; y += p.y; }
    return points && points.length ? { x: x / points.length, y: y / points.length } : { x: 0, y: 0 };
  }

  function districtForPoint(city, point) {
    const geom = window.CityMapGeometryV3;
    if (!geom || !geom.pointInPolygon || !point) return null;
    return (city.districts || []).find(district =>
      (district.ownershipPolygons || district.polygons || []).some(poly => geom.pointInPolygon(point, poly))
    ) || null;
  }

  function blockForId(city, blockId) {
    return (city.cells || []).find(cell => cell.id === blockId) || null;
  }

  function metaFor(type, sourceId) {
    const meta = TYPE_META[type] || TYPE_META.convenience;
    return {
      type,
      tier: meta.tier,
      typeLabel: meta.label,
      iconKey: meta.icon,
      accentColor: meta.accent,
      name: pick(meta.names, sourceId),
      bonus: { text: meta.bonus }
    };
  }

  function buildingType(building) {
    const group = building.render && building.render.lodGroup;
    if (group === "tower") return pick(TOWER_TYPES, building.id);
    if (group === "midrise") return pick(MIDRISE_TYPES, building.id);
    return pick(LOWRISE_TYPES, building.id);
  }

  function makeVenue(type, sourceId, source, city, opts) {
    const block = opts.blockId ? blockForId(city, opts.blockId) : null;
    const district = block ? city.districts.find(d => d.id === block.districtId) : districtForPoint(city, opts.centroid);
    const meta = metaFor(type, sourceId);
    return {
      id: `venue:${sourceId}`,
      source,
      sourceId,
      ...meta,
      districtId: district ? district.id : null,
      districtIdx: district ? district.idx : null,
      blockId: opts.blockId || null,
      buildingId: opts.buildingId || null,
      openSpaceId: opts.openSpaceId || null,
      waterBodyId: opts.waterBodyId || null,
      bridgeId: opts.bridgeId || null,
      centroid: opts.centroid,
      snapEdgeId: opts.snapEdgeId || null,
      snapPoint: opts.snapPoint || null,
      snapT: opts.snapT ?? null,
      snapCandidates: opts.snapCandidates || []
    };
  }

  function extractVenues(city) {
    const venues = [];

    for (const space of (city.buildingPlan && city.buildingPlan.openSpaces) || []) {
      if (space.kind !== "park" && space.kind !== "compound") continue;
      const block = blockForId(city, space.cellId);
      if (!block) continue;
      venues.push(makeVenue(space.kind === "compound" ? "stadium" : "park", space.id, "openSpace", city, {
        blockId: space.cellId,
        openSpaceId: space.id,
        centroid: block.centroid || centroidOf(block.polygon)
      }));
    }

    for (const body of (city.terrain && city.terrain.waterBodies) || []) {
      if (body.kind !== "lake" || !body.polygon) continue;
      venues.push(makeVenue("lake", body.id || `lake-${venues.length}`, "waterBody", city, {
        waterBodyId: body.id || null,
        centroid: centroidOf(body.polygon)
      }));
    }

    for (const bridge of (city.bridgePlan && city.bridgePlan.bridges) || []) {
      if (typeof bridge.x !== "number" || typeof bridge.y !== "number") continue;
      venues.push(makeVenue("bridge", bridge.id || `bridge-${venues.length}`, "bridge", city, {
        bridgeId: bridge.id || null,
        centroid: { x: bridge.x, y: bridge.y }
      }));
    }

    for (const building of (city.buildingPlan && city.buildingPlan.buildings) || []) {
      const centroid = building.centroid || centroidOf(building.footprint);
      venues.push(makeVenue(buildingType(building), building.id, "building", city, {
        blockId: building.cellId,
        buildingId: building.id,
        centroid,
        snapEdgeId: building.snapEdgeId,
        snapPoint: building.snapPoint,
        snapT: building.snapT,
        snapCandidates: building.snapCandidates || []
      }));
    }

    return venues;
  }

  function chooseVenueForSlot(slot, districtVenues, used) {
    let best = null;
    const ownerIsTop = slot.owner === "them";
    for (const venue of districtVenues) {
      if (used.has(venue.id)) continue;
      const sameBlock = venue.blockId && venue.blockId === slot.blockId;
      const dx = venue.centroid.x - slot.x;
      const dy = venue.centroid.y - slot.y;
      const dist = Math.hypot(dx, dy);
      const sidePenalty = ownerIsTop
        ? Math.max(0, venue.centroid.y - slot.y) * 0.18
        : Math.max(0, slot.y - venue.centroid.y) * 0.18;
      const tierBonus = venue.tier === "iconic" ? -7 : venue.tier === "major" ? -3 : 0;
      const blockBonus = sameBlock ? -80 : 0;
      const sourceBonus = venue.source === "openSpace" ? -10 : 0;
      const score = dist + sidePenalty + tierBonus + blockBonus + sourceBonus;
      if (!best || score < best.score) best = { venue, score };
    }
    if (best) return best.venue;

    for (const venue of districtVenues) {
      const dx = venue.centroid.x - slot.x;
      const dy = venue.centroid.y - slot.y;
      const score = Math.hypot(dx, dy);
      if (!best || score < best.score) best = { venue, score };
    }
    return best ? best.venue : null;
  }

  function assignSlots(city, venues) {
    const byDistrict = new Map();
    for (const venue of venues) {
      if (!venue.districtId) continue;
      if (!byDistrict.has(venue.districtId)) byDistrict.set(venue.districtId, []);
      byDistrict.get(venue.districtId).push(venue);
    }

    for (const district of city.districts || []) {
      const pool = byDistrict.get(district.id) || [];
      const used = new Set();
      for (const slot of district.slots || []) {
        const venue = chooseVenueForSlot(slot, pool, used);
        if (!venue) continue;
        used.add(venue.id);
        slot.venueId = venue.id;
        slot.venue = venue;
        slot.x = venue.centroid.x;
        slot.y = venue.centroid.y;
        slot.blockId = venue.blockId || slot.blockId;
        slot.buildingId = venue.buildingId || null;
        slot.snapEdgeId = venue.snapEdgeId || null;
        slot.snapPoint = venue.snapPoint || null;
        slot.snapT = venue.snapT ?? null;
        slot.snapCandidates = venue.snapCandidates || [];
      }
      district.dots = district.slots;
    }
  }

  function enrichCity(city) {
    if (!city) return city;
    const venues = extractVenues(city);
    city.venues = venues;
    city.venueById = Object.fromEntries(venues.map(v => [v.id, v]));
    assignSlots(city, venues);
    return city;
  }

  window.CityMapVenuesV1 = {
    enrichCity,
    extractVenues,
    TYPE_META
  };
})();
