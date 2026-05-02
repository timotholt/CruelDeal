/* global React, GameCard, buildDeck, makeRng,
   STAGE_W, STAGE_H, HEADER_H, FOOTER_H, BOARD_H, SIDE_PAD,
   DETECTION_ALGOS,
   useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakSelect */

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const CITY_V3_W = STAGE_W;
const CITY_V3_H = BOARD_H;
const C_CELL_W = window.CityMapConfigV3.CELL_UNIT;
const C_CELL_H = window.CityMapConfigV3.CELL_UNIT;
const {
  whoCanThisCardSeeV3,
  whoCanSeeMeV3
} = window.CityMapRulesV3;

// ---------- Floating Debug Dock ----------
function DebugDock({ tweaks, setTweak, showUI, setShowUI }) {
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef(null);
  const dragStartRef = useRef(null);

  const onHeaderPointerDown = (e) => {
    if (e.target.closest('.dock-toggle, .dock-collapse')) return;
    dragStartRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    
    const onMove = (ev) => {
      if (dragStartRef.current) {
        setPos({ x: ev.clientX - dragStartRef.current.x, y: ev.clientY - dragStartRef.current.y });
      }
    };
    const onUp = () => {
      dragStartRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={dragRef}
      className="debug-dock"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
    >
      <div className="dock-header" onPointerDown={onHeaderPointerDown}>
        <span className="dock-title">DEBUG</span>
        <button
          className="dock-collapse"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? '▸' : '▾'}
        </button>
      </div>
      {!collapsed && (
        <div className="dock-body">
          <label className="dock-row">
            <span className="dock-label">City Map</span>
            <button
              className={`dock-toggle ${tweaks.showMap ? 'dock-toggle--on' : ''}`}
              onClick={() => setTweak('showMap', !tweaks.showMap)}
            >
              {tweaks.showMap ? 'ON' : 'OFF'}
            </button>
          </label>
          <label className="dock-row">
            <span className="dock-label">Toggle Buildings</span>
            <button
              className={`dock-toggle ${tweaks.showBuildingsDebug === true ? 'dock-toggle--on' : ''}`}
              onClick={() => setTweak('showBuildingsDebug', !tweaks.showBuildingsDebug)}
            >
              {tweaks.showBuildingsDebug === true ? 'ON' : 'OFF'}
            </button>
          </label>
          <label className="dock-row">
            <span className="dock-label">Bright Buildings</span>
            <button
              className={`dock-toggle ${tweaks.brightBuildings === true ? 'dock-toggle--on' : ''}`}
              onClick={() => setTweak('brightBuildings', !tweaks.brightBuildings)}
            >
              {tweaks.brightBuildings === true ? 'ON' : 'OFF'}
            </button>
          </label>
          <label className="dock-row">
            <span className="dock-label">Building Borders</span>
            <button
              className={`dock-toggle ${tweaks.buildingBorders === true ? 'dock-toggle--on' : ''}`}
              onClick={() => setTweak('buildingBorders', !tweaks.buildingBorders)}
            >
              {tweaks.buildingBorders === true ? 'ON' : 'OFF'}
            </button>
          </label>
          <label className="dock-row">
            <span className="dock-label">Route Demo</span>
            <button
              className={`dock-toggle ${tweaks.showRouteDemo ? 'dock-toggle--on' : ''}`}
              onClick={() => setTweak('showRouteDemo', !tweaks.showRouteDemo)}
            >
              {tweaks.showRouteDemo ? 'ON' : 'OFF'}
            </button>
          </label>
          <label className="dock-row">
            <span className="dock-label">Game UI</span>
            <button
              className={`dock-toggle ${showUI ? 'dock-toggle--on' : ''}`}
              onClick={() => setShowUI(!showUI)}
            >
              {showUI ? 'ON' : 'OFF'}
            </button>
          </label>
        </div>
      )}
    </div>
  );
}

// ---------- Route Demo Layer ----------
function RouteDemoLayer({ city, active }) {
  const [routeState, setRouteState] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setRouteState(null);
      setVisible(false);
      return;
    }

    let cancelled = false;
    let timerId = null;

    // A point is "on-map" if it's within the visible canvas with margin.
    // 20px keeps paths away from the irregular coastline edges.
    const margin = 20;
    function onMap(pt) {
      return pt && pt.x >= margin && pt.x <= CITY_V3_W - margin &&
                   pt.y >= margin && pt.y <= CITY_V3_H - margin;
    }

    function step() {
      if (cancelled || !window.CityMapRoutingV1 || !city._routing) return;

      // Gather all playable slots
      const allSlots = city.districts.flatMap(d => d.slots || d.dots || []).map(s => ({
        x: s.x, y: s.y, type: 'slot', id: s.id
      }));

      // Gather named landmarks (venues)
      const allVenues = (city.venues || []).map(v => ({
        x: v.centroid.x, y: v.centroid.y, type: 'landmark', id: v.id
      }));

      // Combine them into a single pool
      const routePoints = [...allSlots, ...allVenues];
      if (routePoints.length < 2) return;

      // Pick two random points
      const shuffled = [...routePoints].sort(() => Math.random() - 0.5);
      const pt1 = shuffled[0];
      const pt2 = shuffled[1];

      // Route directly between their raw coordinates
      const result = window.CityMapRoutingV1.findPathBetweenCoords(
        city, 
        pt1.x, pt1.y, 
        pt2.x, pt2.y
      );

      // Reject if no path found
      if (!result || result.waypoints.length < 2) {
        timerId = setTimeout(step, 150);
        return;
      }

      const pathD = window.CityMapRoutingV1.routeToSvgPath(result.waypoints, false);
      const ptA = result.waypoints[0];
      const ptB = result.waypoints[result.waypoints.length - 1];
      
      if (!cancelled) {
        setRouteState({ pathD, ptA, ptB });
        setVisible(true);
      }

      // After 2s show, fade out over 0.5s, then pick next after 0.5s gap
      timerId = setTimeout(() => {
        if (!cancelled) setVisible(false);
        timerId = setTimeout(() => { if (!cancelled) step(); }, 500);
      }, 2000);
    }

    step();
    return () => { cancelled = true; if (timerId) clearTimeout(timerId); };
  }, [active, city]);

  if (!active || !routeState) return null;

  return (
    <svg
      style={{
        position: 'absolute', top: 0, left: 0, pointerEvents: 'none',
        opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease-out',
        zIndex: 10
      }}
      width={CITY_V3_W} height={CITY_V3_H}
      viewBox={`0 0 ${CITY_V3_W} ${CITY_V3_H}`}
    >
      <defs>
        <filter id="route-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Wide glow underlay */}
      <path d={routeState.pathD} fill="none" stroke="#00f5ff" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.12"/>
      {/* Main neon line */}
      <path d={routeState.pathD} fill="none" stroke="#00f5ff" strokeWidth="1.2"
            strokeLinecap="round" strokeLinejoin="round"
            filter="url(#route-glow)" opacity="0.92"/>
      {/* Node markers at snap points */}
      {[routeState.ptA, routeState.ptB].filter(Boolean).map((pt, i) => (
        <g key={i}>
          <circle cx={pt.x} cy={pt.y} r="6" fill="none" stroke="#00f5ff" strokeWidth="0.7" opacity="0.6"/>
          <circle cx={pt.x} cy={pt.y} r="2.5" fill="#00f5ff" opacity="0.95"/>
        </g>
      ))}
    </svg>
  );
}

const VENUE_TOOLTIP_W = 152;
const VENUE_TOOLTIP_H = 48;
const VENUE_TOOLTIP_GAP = 30;
const VENUE_TOOLTIP_MARGIN = 8;

const VENUE_ICON_GLYPHS = {
  park: "P",
  stadium: "◉",
  lake: "~",
  bridge: "╱╲",
  tower: "▥",
  store: "▤",
  hospital: "+",
  hotel: "H",
  dojo: "拳",
  hideout: "⌂",
  precinct: "★",
  ripperdoc: "✚",
  hack: "</>",
  gun: "••",
  ammo: "•••",
  club: "♪",
  bar: "B",
  ramen: "≋",
  liquor: "L",
  pawn: "$",
  mart: "24"
};

function _clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function _tooltipLayout(anchorX, anchorY) {
  const maxLeft = CITY_V3_W - VENUE_TOOLTIP_W - VENUE_TOOLTIP_MARGIN;
  const maxTop = CITY_V3_H - VENUE_TOOLTIP_H - VENUE_TOOLTIP_MARGIN;
  const preferredTop = anchorY - VENUE_TOOLTIP_GAP - VENUE_TOOLTIP_H;
  const candidates = [
    { left: anchorX + VENUE_TOOLTIP_GAP * 0.7, top: preferredTop },
    { left: anchorX - VENUE_TOOLTIP_W - VENUE_TOOLTIP_GAP * 0.7, top: preferredTop },
    { left: anchorX - VENUE_TOOLTIP_W * 0.72, top: preferredTop },
    { left: anchorX - VENUE_TOOLTIP_W * 0.28, top: preferredTop }
  ].map((candidate) => {
    const left = _clamp(candidate.left, VENUE_TOOLTIP_MARGIN, maxLeft);
    const top = _clamp(candidate.top, VENUE_TOOLTIP_MARGIN, maxTop);
    const shift = Math.hypot(left - candidate.left, top - candidate.top);
    const diagonalBonus = Math.abs((left + VENUE_TOOLTIP_W / 2) - anchorX) * -0.018;
    return { ...candidate, left, top, score: shift * 9 + diagonalBonus };
  });

  const best = candidates.sort((a, b) => a.score - b.score)[0];
  const centerX = best.left + VENUE_TOOLTIP_W / 2;
  const exitOffset = anchorX < centerX ? -24 : 24;
  let edgeX = _clamp(anchorX + exitOffset, best.left + 10, best.left + VENUE_TOOLTIP_W - 10);
  if (Math.abs(edgeX - anchorX) < 12) {
    const leftExit = best.left + VENUE_TOOLTIP_W * 0.25;
    const rightExit = best.left + VENUE_TOOLTIP_W * 0.75;
    edgeX = Math.abs(leftExit - anchorX) > Math.abs(rightExit - anchorX) ? leftExit : rightExit;
  }
  const edgeY = best.top + VENUE_TOOLTIP_H;
  const dx = edgeX - anchorX;
  const dy = edgeY - anchorY;
  const d = Math.hypot(dx, dy) || 1;
  const startPad = 10;
  return {
    ...best,
    line: {
      x1: anchorX + dx / d * startPad,
      y1: anchorY + dy / d * startPad,
      x2: edgeX,
      y2: edgeY
    }
  };
}

function VenueTooltip({ venue, anchorX, anchorY }) {
  if (!venue) return null;
  const layout = _tooltipLayout(anchorX, anchorY);
  const icon = VENUE_ICON_GLYPHS[venue.iconKey] || "◇";
  return (
    <>
      <svg
        className="venue-tooltip-link"
        width={CITY_V3_W}
        height={CITY_V3_H}
        style={{ "--venue-accent": venue.accentColor || "#00f5ff" }}
      >
        <line
          x1={layout.line.x1}
          y1={layout.line.y1}
          x2={layout.line.x2}
          y2={layout.line.y2}
        />
      </svg>
      <div
        className="venue-tooltip"
        style={{
          left: `${layout.left}px`,
          top: `${layout.top}px`,
          "--venue-accent": venue.accentColor || "#00f5ff"
        }}
      >
        <div className="venue-tooltip__header">
          <span className="venue-tooltip__icon">{icon}</span>
          <span className="venue-tooltip__name">{venue.name || "Unnamed Venue"}</span>
        </div>
        <div className="venue-tooltip__bonus">
          {(venue.bonus && venue.bonus.text) || "Venue bonus TBD"}
        </div>
      </div>
    </>
  );
}

// ---------- Stage scaling ----------
function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function recompute() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / STAGE_W, vh / STAGE_H);
      setScale(s);
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, []);
  return scale;
}

// ---------- Header ----------
function Header({ accent, you, them, turn, deckCount }) {
  return (
    <div className="header">
      <div className="hud-corner hud-tl" />
      <div className="hud-corner hud-tr" />
      <div className="hud-corner hud-bl" />
      <div className="hud-corner hud-br" />

      <div className={`player-side ${turn === "you" ? "player--active" : ""}`}>
        <div className="player-icon">
          <div className="player-icon-inner" style={{ background: accent }}>Y</div>
        </div>
        <div className="player-meta">
          <div className="player-name">{you.name}</div>
          <div className="player-tag">◉ {you.score}</div>
        </div>
      </div>

      <div className="header-center">
        <div className="round-label">ROUND {turn === "you" ? "—" : "·"}</div>
        <div className="turn-label">
          {turn === "you" ? "YOUR TURN" : "OPP THINKING"}
        </div>
        <div className="deck-ticker">DECK · {deckCount}</div>
      </div>

      <div className={`player-side player-side--right ${turn === "them" ? "player--active" : ""}`}>
        <div className="player-meta player-meta--right">
          <div className="player-name">{them.name}</div>
          <div className="player-tag">◉ {them.score}</div>
        </div>
        <div className="player-icon">
          <div className="player-icon-inner player-icon-inner--enemy">Z</div>
        </div>
      </div>
    </div>
  );
}

// ---------- City Board (replaces Lane components) ----------
function CityBoard({ city, placedCards, hoverDot, dragCard, algo, accent, onInspect, onDotClick, selectedCard, sessionSeed, mapOpacity, showLabels, showGamePieces = true, roundedMapEdge, tweaks }) {
  const [hoveredDistrictId, setHoveredDistrictId] = useState(null);
  const [tooltip, setTooltip] = useState({ venue: null, anchorX: 0, anchorY: 0 });
  const boardRef = useRef(null);
  const boardCity = city;
  const allDots = useMemo(() => boardCity.districts.flatMap(d => d.dots || d.slots || []), [boardCity]);
  const venueById = useMemo(
    () => boardCity.venueById || Object.fromEntries((boardCity.venues || []).map((venue) => [venue.id, venue])),
    [boardCity]
  );
  const hoveredDistrict = useMemo(
    () => boardCity.districts.find((district) => district.id === hoveredDistrictId),
    [boardCity, hoveredDistrictId]
  );
  const hoveredSlotCount = hoveredDistrict
    ? Math.min(
        hoveredDistrict.slots.filter(slot => slot.owner === "them").length,
        hoveredDistrict.slots.filter(slot => slot.owner === "you").length
      ) * 2
    : 0;
  const showVenueTooltip = (dot) => {
    const venue = dot && (dot.venue || venueById[dot.venueId]);
    if (!venue) return;
    setTooltip({ venue, anchorX: dot.x, anchorY: dot.y });
  };
  const hideVenueTooltip = () => setTooltip({ venue: null, anchorX: 0, anchorY: 0 });
  const updateVenueTooltipFromBoardPointer = (event) => {
    if (!showGamePieces || dragCard) return;
    const boardEl = boardRef.current || event.currentTarget;
    const boardRect = boardEl.getBoundingClientRect();
    const localX = (event.clientX - boardRect.left) * (CITY_V3_W / boardRect.width);
    const localY = (event.clientY - boardRect.top) * (CITY_V3_H / boardRect.height);
    if (localX < 0 || localX > CITY_V3_W || localY < 0 || localY > CITY_V3_H) {
      hideVenueTooltip();
      return;
    }

    let best = null;
    let bestD = Infinity;
    for (const dot of allDots) {
      const dx = dot.x - localX;
      const dy = dot.y - localY;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestD) {
        bestD = distSq;
        best = dot;
      }
    }
    const hoverRadius = 18;
    if (best && bestD <= hoverRadius * hoverRadius) showVenueTooltip(best);
    else hideVenueTooltip();
  };

  return (
    <div
      ref={boardRef}
      className="city-board city-board--v4"
      onMouseMove={updateVenueTooltipFromBoardPointer}
      onPointerMove={updateVenueTooltipFromBoardPointer}
      onMouseLeave={() => { setHoveredDistrictId(null); hideVenueTooltip(); }}
      onPointerLeave={hideVenueTooltip}
      style={{
        width: CITY_V3_W,
        height: CITY_V3_H,
        position: "relative",
        overflow: "hidden",
        borderRadius: roundedMapEdge ? 10 : 0
      }}
    >
      {/* City map base */}
      <CityMapV4Preview
        seed={sessionSeed}
        width={CITY_V3_W}
        height={CITY_V3_H}
        opacity={mapOpacity ?? 1}
        showLabels={showLabels !== false}
        showBuildings={tweaks.showBuildingsDebug !== true}
        brightBuildings={tweaks.brightBuildings === true}
        buildingBorders={tweaks.buildingBorders === true}
        hoveredDistrictId={hoveredDistrictId}
      />

      {/* Route demo overlay — rendered above map, below game pieces */}
      <RouteDemoLayer city={boardCity} active={tweaks.showRouteDemo === true} />

      {boardCity && (
        <svg
          className="district-hover-surface"
          width={CITY_V3_W}
          height={CITY_V3_H}
          viewBox={`0 0 ${CITY_V3_W} ${CITY_V3_H}`}
          preserveAspectRatio="none"
        >
          {boardCity.districts.map((district) => (
            <g key={`${district.id}-hit`}>
              {((district.ownershipPolygons || district.polygons) || []).map((polygon, index) => (
                <path
                  key={`${district.id}-hit-cell-${index}`}
                  d={window.CityMapPathsV3.polygonToPath(polygon)}
                  fill="black"
                  opacity="0.001"
                  stroke="transparent"
                  strokeWidth="8"
                  data-district-id={district.id}
                  data-district-name={district.name}
                  onMouseEnter={() => setHoveredDistrictId(district.id)}
                  onMouseLeave={() => setHoveredDistrictId(null)}
                />
              ))}
            </g>
          ))}
        </svg>
      )}

      {hoveredDistrict && (
        <div className="district-hover-readout">
          <span>{hoveredDistrict.name}</span>
          <b>{hoveredDistrict.id}</b>
          <i>{hoveredSlotCount} slots</i>
        </div>
      )}

      {/* Detection overlay (drag preview) */}
      {showGamePieces && dragCard && hoverDot && (
        <DetectionOverlay
          dot={hoverDot}
          card={dragCard}
          algo={algo}
          placedCards={placedCards}
        />
      )}

      {/* Detection overlay (tap-to-place preview) */}
      {showGamePieces && !dragCard && selectedCard && (() => {
        const previewDot = allDots.find((d) => d.owner === "you" && !placedCards.some((c) => c.dot.id === d.id));
        if (!previewDot) return null;
        return (
          <DetectionOverlay
            dot={previewDot}
            card={selectedCard}
            algo={algo}
            placedCards={placedCards}
          />
        );
      })()}

      {/* Dots */}
      {showGamePieces && allDots.map((d) => {
        const occupied = placedCards.find((c) => c.dot.id === d.id);
        const isHover = hoverDot && hoverDot.id === d.id;
        const isOwnSlot = d.owner === "you";
        const isPlayable = selectedCard && !occupied && isOwnSlot;
        return (
          <div
            key={d.id}
            data-dot-id={d.id}
            className={`dot dot--${d.owner || "you"} ${occupied ? "dot--occupied" : ""} ${isHover ? "dot--hover" : ""} ${isPlayable ? "dot--playable" : ""}`}
            style={{ left: d.x, top: d.y }}
            onMouseEnter={() => showVenueTooltip(d)}
            onMouseLeave={hideVenueTooltip}
            onPointerEnter={() => showVenueTooltip(d)}
            onPointerLeave={hideVenueTooltip}
            onClick={(e) => { if (!occupied && isOwnSlot && onDotClick) { e.stopPropagation(); onDotClick(d); } }}
          >
            <div className="dot-slot" />
          </div>
        );
      })}

      {/* Placed cards (absolute board coords) */}
      {showGamePieces && placedCards.map((c) => {
        const boardScale = 0.24;
        const w = window.CARD_W * boardScale;
        const h = window.CARD_H * boardScale;
        return (
          <div
            key={c.uid}
            className={`placed ${c.owner === "you" ? "placed--you" : "placed--them"} ${c.revealed ? "placed--revealed" : ""} ${c.justRevealed ? "placed--flip" : ""}`}
            style={{ left: c.dot.x, top: c.dot.y, width: w, height: h }}
            onMouseEnter={() => showVenueTooltip(c.dot)}
            onMouseLeave={hideVenueTooltip}
            onPointerEnter={() => showVenueTooltip(c.dot)}
            onPointerLeave={hideVenueTooltip}
            onClick={(e) => { e.stopPropagation(); onInspect && onInspect(c); }}
          >
            <div className="card-scaler" style={{ transform: `scale(${boardScale})` }}>
              <GameCard
                card={c}
                faceDown={!c.revealed}
                owner={c.owner}
              />
            </div>
          </div>
        );
      })}

      <VenueTooltip venue={tooltip.venue} anchorX={tooltip.anchorX} anchorY={tooltip.anchorY} />
    </div>
  );
}

function DetectionOverlay({ dot, card, algo, placedCards }) {
  const myRange = algo.range(card.vis, 0);
  let maxEnemyReach = 0;
  for (const o of placedCards) {
    if (o.dot.districtIdx !== dot.districtIdx) continue;
    if (o.owner === "you") continue;
    const r = algo.range(o.vis, card.stealth);
    if (r > maxEnemyReach) maxEnemyReach = r;
  }
  // Use cell size from city for radius scale
  const cell = Math.min(C_CELL_W, C_CELL_H);
  const blueR = (myRange + 0.5) * cell;
  const redR = (maxEnemyReach + 0.5) * cell;

  return (
    <svg className="detect-svg" width={CITY_V3_W} height={CITY_V3_H}>
      <defs>
        <radialGradient id="blueGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6ff7ff" stopOpacity="0.0" />
          <stop offset="60%" stopColor="#6ff7ff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#6ff7ff" stopOpacity="0.22" />
        </radialGradient>
        <radialGradient id="redGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5d8f" stopOpacity="0.0" />
          <stop offset="70%" stopColor="#ff5d8f" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ff5d8f" stopOpacity="0.28" />
        </radialGradient>
      </defs>
      {myRange > 0 && (
        <g className="ring-pulse">
          <circle cx={dot.x} cy={dot.y} r={blueR} fill="url(#blueGrad)" stroke="#6ff7ff" strokeWidth="1" strokeDasharray="3 3" opacity="0.9" />
        </g>
      )}
      {maxEnemyReach > 0 && (
        <g className="ring-pulse-2">
          <circle cx={dot.x} cy={dot.y} r={redR} fill="url(#redGrad)" stroke="#ff5d8f" strokeWidth="1" strokeDasharray="2 4" opacity="0.9" />
        </g>
      )}
    </svg>
  );
}

// ---------- Hand ----------
function Hand({ cards, draggingUid, selectedUid, onPointerDown, onInspect, deckCount }) {
  const N = cards.length;
  return (
    <div className="hand-wrap">
      <div className="deck-stack">
        <div className="deck-card deck-card--3" />
        <div className="deck-card deck-card--2" />
        <div className="deck-card deck-card--1" />
        <div className="deck-count">{deckCount}</div>
      </div>
      <div className="hand">
        {cards.map((c, i) => {
          const center = (N - 1) / 2;
          const off = i - center;
          const rot = off * 5;
          const ty = Math.abs(off) * Math.abs(off) * 1.4;
          const tx = off * 30;
          const handScale = 0.55;
          // Hand cards: a stable hit-zone div sized to the SCALED card,
          // and inside it a card-scaler that holds the canonical card.
          // Hover state lives on the hit-zone, so the visual lift never
          // moves the hit-zone — no flicker.
          return (
            <div
              key={c.uid}
              className={`hand-slot ${draggingUid === c.uid ? "hand-slot--dragging" : ""} ${selectedUid === c.uid ? "hand-slot--selected" : ""}`}
              style={{
                "--tx": `${tx}px`,
                "--ty": `${ty}px`,
                "--rot": `${rot}deg`,
                "--scale": handScale,
                width: window.CARD_W * handScale,
                height: window.CARD_H * handScale,
                zIndex: 10 - Math.abs(off),
              }}
              onPointerDown={(e) => onPointerDown(e, c, "hand")}
              onClick={(e) => {
                // Only treat as click if pointerdown didn't initiate drag.
                if (e.detail === 0) return; // synthetic
                if (e._wasDrag) return;
                onInspect && onInspect(c);
              }}
            >
              <div className="card-scaler hand-scaler">
                <GameCard card={c} owner="you" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Drag layer ----------
function DragLayer({ card, x, y }) {
  if (!card) return null;
  // Shrink while dragging so player can see the destination dot
  const dragScale = 0.32;
  return (
    <div
      className="drag-layer"
      style={{
        left: x,
        top: y,
        width: window.CARD_W * dragScale,
        height: window.CARD_H * dragScale,
      }}
    >
      <div className="card-scaler" style={{ transform: `scale(${dragScale})` }}>
        <GameCard card={card} dragging glow owner="you" />
      </div>
    </div>
  );
}

// ---------- Math chip ----------
function MathChip({ card, hoverDot, placedCards, algo }) {
  if (!card || !hoverDot) return null;
  // find biggest enemy threat
  let worst = null;
  for (const o of placedCards) {
    if (o.dot.districtIdx !== hoverDot.districtIdx) continue;
    if (o.owner === "you") continue;
    const r = algo.range(o.vis, card.stealth);
    if (!worst || r > worst.r) worst = { r, o };
  }
  return (
    <div className="math-chip">
      <span className="chip-line">
        <span className="chip-key">YOU SEE</span>
        <span className="chip-eq">{card.vis} − S</span>
        <span className="chip-tag chip-tag--blue">range {algo.range(card.vis, 0)}</span>
      </span>
      <span className="chip-line">
        <span className="chip-key">SEEN BY</span>
        <span className="chip-eq">
          {worst ? `${worst.o.name} ${worst.o.vis} − ${card.stealth}` : "none"}
        </span>
        <span className="chip-tag chip-tag--red">
          {worst ? `range ${worst.r}` : "safe"}
        </span>
      </span>
    </div>
  );
}

// ---------- Toast ----------
function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

// ---------- Game ----------
function Game() {
  const scale = useStageScale();
  const [showUI, setShowUI] = useState(true);

  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accentHue": 188,
    "algo": "subtract",
    "showMap": true,
    "roundMapEdge": true,
    "mapOpacity": 0.85,
    "showRouteDemo": false
  }/*EDITMODE-END*/);

  const accent = `oklch(0.78 0.16 ${tweaks.accentHue})`;
  const accent2 = `oklch(0.72 0.18 ${(tweaks.accentHue + 140) % 360})`;

  // Seeded session
  const sessionSeed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const rng = useMemo(() => makeRng(sessionSeed), [sessionSeed]);

  // Build the city. V3.5 is now the production map generator.
  // enrichCity adds building centroids + snap-to-road data for routing.
  const city = useMemo(() => {
    const c = window.CityMapV35.buildCityV35(sessionSeed);
    if (window.CityMapRoutingV1) window.CityMapRoutingV1.enrichCity(c);
    if (window.CityMapVenuesV1) window.CityMapVenuesV1.enrichCity(c);
    return c;
  }, [sessionSeed]);
  const allDots = useMemo(() => city.districts.flatMap(d => d.dots), [city]);

  const [yourDeck, setYourDeck] = useState(() => buildDeck(makeRng(sessionSeed + 7)));
  const [theirDeck, setTheirDeck] = useState(() => buildDeck(makeRng(sessionSeed + 99)));
  const [yourHand, setYourHand] = useState([]);
  const [theirHand, setTheirHand] = useState([]);
  const [placed, setPlaced] = useState([]); // {uid, ...card, dot, owner, revealed}
  const [turn, setTurn] = useState("you");
  const [scores, setScores] = useState({ you: 0, them: 0 });
  const [toast, setToast] = useState(null);
  const [dragState, setDragState] = useState(null); // {card, x, y, hoverDot}
  const [selected, setSelected] = useState(null); // tap-to-place card
  const [inspect, setInspect] = useState(null); // card being inspected
  const [history, setHistory] = useState([]); // snapshots for undo: { placed, yourHand, turn }

  const algo = DETECTION_ALGOS[tweaks.algo] || DETECTION_ALGOS.subtract;

  // Initial draw
  useEffect(() => {
    const yh = yourDeck.slice(0, 4);
    const th = theirDeck.slice(0, 4);
    setYourHand(yh);
    setTheirHand(th);
    setYourDeck(yourDeck.slice(4));
    setTheirDeck(theirDeck.slice(4));
  }, [sessionSeed]);

  // Toast helper
  const showToast = useCallback((msg, ms = 1800) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), ms);
  }, []);

  // ---------- Placement ----------
  const placeCard = useCallback((card, dot, owner) => {
    const placement = {
      ...card,
      dot,
      owner,
      revealed: owner === "you" ? false : false, // both face-down to opponent — but show your own face up
      faceVisibleToYou: owner === "you",
      uid: card.uid,
    };
    setPlaced((prev) => {
      const next = [...prev, placement];
      // run detection chain on the next array
      setTimeout(() => runDetectionChain(next, placement), 280);
      return next;
    });
  }, []);

  const runDetectionChain = useCallback((currentPlaced, justPlaced) => {
    // BFS chain: starting from justPlaced, reveal anyone in its sight (and anyone seeing it).
    // Then for each newly-revealed card, repeat.
    let snapshot = currentPlaced.map((c) => ({ ...c }));
    const queue = [justPlaced.uid];
    const revealedNow = new Set();

    function step() {
      if (queue.length === 0) {
        // commit final states + clear flip flags
        setPlaced((prev) => prev.map((c) => {
          const f = snapshot.find((s) => s.uid === c.uid);
          return f ? { ...c, revealed: f.revealed, justRevealed: false } : c;
        }));
        return;
      }
      const uid = queue.shift();
      const trigger = snapshot.find((c) => c.uid === uid);
      if (!trigger) { step(); return; }

      // Trigger sees others
      const seenByTrigger = whoCanThisCardSeeV3(trigger.dot, trigger.vis, snapshot, algo);
      // Others can see trigger
      const seerOfTrigger = whoCanSeeMeV3(trigger.dot, trigger.stealth, snapshot, algo);

      const newlyRevealed = [];
      function revealIt(card) {
        if (!card.revealed && !revealedNow.has(card.uid)) {
          card.revealed = true;
          card.justRevealed = true;
          revealedNow.add(card.uid);
          newlyRevealed.push(card);
        }
      }
      // reveal trigger itself if it was hidden and someone saw it (or first placement)
      if (seerOfTrigger.length > 0 || trigger === justPlaced) revealIt(trigger);
      seenByTrigger.forEach((c) => {
        // Only enemy cards can be detected (allies are known)
        if (c.owner !== trigger.owner) revealIt(c);
      });
      seerOfTrigger.forEach((c) => {
        // any opposing seer — they're already on board, but we visualize their probe
        // (we don't reveal allied cards via detection)
      });

      // commit progress visually so it "pops" in sequence
      setPlaced((prev) => prev.map((c) => {
        const f = snapshot.find((s) => s.uid === c.uid);
        return f ? { ...c, revealed: f.revealed, justRevealed: f.justRevealed } : c;
      }));

      // Push newly-revealed into queue for chain
      newlyRevealed.forEach((c) => queue.push(c.uid));

      setTimeout(step, 380);
    }
    step();
  }, [algo]);

  // ---------- Drag / Click ----------
  const stageRef = useRef(null);
  const onPointerDownCard = useCallback((e, card, source) => {
    if (turn !== "you") return;
    if (source === "hand" && e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const rect = stageRef.current.getBoundingClientRect();
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    let isDrag = false;
    // Acceleration: amplify pointer delta by 1.6× from the start point so a
    // small tablet/mouse motion translates to a big card movement.
    const ACCEL = 1.7;

    const onMove = (ev) => {
      const r = stageRef.current.getBoundingClientRect();
      const rawX = (ev.clientX - r.left) / scale;
      const rawY = (ev.clientY - r.top) / scale;
      // amplified position relative to start
      const xx = startX + (rawX - startX) * ACCEL;
      const yy = startY + (rawY - startY) * ACCEL;
      if (!isDrag) {
        const dx = rawX - startX, dy = rawY - startY;
        if (dx * dx + dy * dy > 25) {
          isDrag = true;
          setDragState({ card, x: xx, y: yy, hoverDot: null });
        }
      } else {
        const hover = findNearestDot(xx, yy);
        setDragState((s) => s ? { ...s, x: xx, y: yy, hoverDot: hover } : s);
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (!isDrag) {
        // click — toggle selection (tap-to-place mode)
        setSelected((cur) => (cur && cur.uid === card.uid ? null : card));
        return;
      }
      setDragState((s) => {
        if (s && s.hoverDot) {
          tryPlace(card, s.hoverDot);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [turn, scale, placed, yourHand]);

  const tryPlace = useCallback((card, dot) => {
    const occupied = placed.some((c) => c.dot.id === dot.id);
    if (occupied) { showToast("DOT OCCUPIED"); return; }
    if (dot.owner !== "you") { showToast("OPPONENT SLOT"); return; }
    setHistory((h) => [...h, {
      placed: placed.map((c) => ({ ...c })),
      yourHand: yourHand.map((c) => ({ ...c })),
      turn,
    }]);
    setYourHand((h) => h.filter((c) => c.uid !== card.uid));
    setSelected(null);
    placeCard(card, dot, "you");
    setTimeout(() => setTurn("them"), 60);
  }, [placed, yourHand, turn, placeCard, showToast]);

  // tap-to-place: click on an open dot when a card is selected
  const onDotClick = useCallback((dot) => {
    if (!selected) return;
    if (turn !== "you") return;
    tryPlace(selected, dot);
  }, [selected, turn, tryPlace]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) { showToast("NOTHING TO UNDO"); return h; }
      const last = h[h.length - 1];
      setPlaced(last.placed);
      setYourHand(last.yourHand);
      setTurn(last.turn);
      setSelected(null);
      return h.slice(0, -1);
    });
  }, [showToast]);

  function findNearestDot(stageX, stageY) {
    // City board occupies (0..STAGE_W) x (HEADER_H..HEADER_H+BOARD_H) in stage coords
    const boardLeft = 0;
    const boardTop = HEADER_H;
    const localX = stageX - boardLeft;
    const localY = stageY - boardTop;
    if (localX < 0 || localX > CITY_V3_W) return null;
    if (localY < 0 || localY > CITY_V3_H) return null;

    let best = null, bestD = Infinity;
    for (const d of allDots) {
      if (d.owner !== "you") continue;
      if (placed.some((c) => c.dot.id === d.id)) continue;
      const dx = d.x - localX;
      const dy = d.y - localY;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    // snap distance: only if within some threshold (~ one cell)
    const THRESH = (Math.max(C_CELL_W, C_CELL_H) * 1.1) ** 2;
    return bestD < THRESH ? best : null;
  }

  // ---------- AI opponent ----------
  useEffect(() => {
    if (turn !== "them") return;
    const t = setTimeout(() => {
      // pick a card from their hand and a random open dot
      const card = theirHand[0];
      if (!card) {
        setTurn("you");
        return;
      }
      // collect open dots
      const open = allDots.filter((d) => d.owner === "them" && !placed.some((c) => c.dot.id === d.id));
      if (open.length === 0) {
        setTurn("you");
        return;
      }
      // simple AI: pick dot that maximizes their cards visible while minimizing exposure
      let best = open[0], bestScore = -Infinity;
      for (const d of open) {
        const seeing = whoCanThisCardSeeV3(d, card.vis, placed, algo).filter((c) => c.owner === "you").length;
        const seers = whoCanSeeMeV3(d, card.stealth, placed, algo).filter((c) => c.owner === "you").length;
        const score = seeing * 2 - seers;
        if (score > bestScore) { bestScore = score; best = d; }
      }
      setTheirHand((h) => h.filter((c) => c.uid !== card.uid));
      placeCard(card, best, "them");
      setTimeout(() => setTurn("you"), 60);
    }, 1100);
    return () => clearTimeout(t);
  }, [turn, theirHand, placed, allDots, algo, placeCard]);

  // ---------- Draw replenish ----------
  useEffect(() => {
    if (yourHand.length < 4 && yourDeck.length > 0 && turn === "them") {
      setYourHand((h) => [...h, yourDeck[0]]);
      setYourDeck((d) => d.slice(1));
    }
    if (theirHand.length < 4 && theirDeck.length > 0 && turn === "you") {
      setTheirHand((h) => [...h, theirDeck[0]]);
      setTheirDeck((d) => d.slice(1));
    }
  }, [turn]);

  // ---------- Render ----------
  return (
    <div
      className="game-root"
      style={{
        "--accent": accent,
        "--accent2": accent2,
        "--accent-hue": tweaks.accentHue,
      }}
    >
      <div
        className="stage"
        ref={stageRef}
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="bg-noise" />
        <div className="bg-glow" />

        {/* Header */}
        {showUI && (
          <div className="zone zone--header" style={{ height: HEADER_H }}>
            <Header
              accent={accent}
              you={{ name: "V_KOJIMA", score: scores.you }}
              them={{ name: "ZAIBATSU", score: scores.them }}
              turn={turn}
              deckCount={yourDeck.length}
            />
          </div>
        )}

        {/* Board: city map + districts replace lanes */}
        <div className="zone zone--board" style={{ top: HEADER_H, height: BOARD_H, left: 0, right: 0 }}>
          <CityBoard
            city={city}
            placedCards={placed}
            hoverDot={dragState?.hoverDot}
            dragCard={dragState?.card}
            algo={algo}
            accent={accent}
            onInspect={(c) => setInspect(c)}
            onDotClick={onDotClick}
            selectedCard={selected}
            sessionSeed={sessionSeed}
            mapOpacity={tweaks.showMap ? (tweaks.mapOpacity ?? 1) : 0}
            showLabels={showUI}
            showGamePieces={showUI}
            roundedMapEdge={tweaks.roundMapEdge !== false}
            tweaks={tweaks}
          />

          {/* Math chip floats just above hand */}
          {dragState && dragState.hoverDot && (
            <MathChip
              card={dragState.card}
              hoverDot={dragState.hoverDot}
              placedCards={placed}
              algo={algo}
            />
          )}
        </div>

        {/* Footer / hand */}
        {showUI && (
          <div className="zone zone--footer" style={{ top: HEADER_H + BOARD_H, height: FOOTER_H }}>
            <Hand
              cards={yourHand}
              draggingUid={dragState?.card?.uid}
              selectedUid={selected?.uid}
              onPointerDown={onPointerDownCard}
              onInspect={(c) => setInspect(c)}
              deckCount={yourDeck.length}
            />
          </div>
        )}

        {/* Drag layer */}
        {dragState && <DragLayer card={dragState.card} x={dragState.x} y={dragState.y} />}

        {/* Undo button */}
        {showUI && (
          <button
            className="undo-btn"
            onClick={undo}
            disabled={history.length === 0}
          >
            <span className="undo-icon">↶</span>
            <span className="undo-label">UNDO</span>
            <span className="undo-count">{history.length}</span>
          </button>
        )}

        {/* Inspector overlay */}
        {inspect && (
          <div className="inspector-backdrop" onClick={() => setInspect(null)}>
            <div
              className="inspector-stage"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-scaler inspector-scaler">
                <GameCard card={inspect} owner={inspect.owner || "you"} />
              </div>
              <div className="inspector-meta">
                <div className="inspector-row">
                  <span className="inspector-key">STEALTH</span>
                  <span className="inspector-val">{inspect.stealth}</span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-key">POWER</span>
                  <span className="inspector-val">{inspect.power}</span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-key">EYE</span>
                  <span className="inspector-val">{inspect.vis}</span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-key">SEES</span>
                  <span className="inspector-val">{algo.range(inspect.vis, 0)} cells (vs S=0)</span>
                </div>
              </div>
              <div className="inspector-hint">tap outside to close</div>
            </div>
          </div>
        )}

        {/* Toast */}
        <Toast msg={toast} />
      </div>

      {/* Floating debug dock */}
      <DebugDock tweaks={tweaks} setTweak={setTweak} showUI={showUI} setShowUI={setShowUI} />

      {/* Tweaks */}
      {showUI && <TweaksPanel title="Tweaks">
        <TweakSection title="Visuals">
          <TweakSlider
            label="Accent hue"
            value={tweaks.accentHue}
            min={0} max={360} step={1}
            onChange={(v) => setTweak("accentHue", v)}
          />
          <TweakToggle
            label="City map"
            checked={tweaks.showMap}
            onChange={(v) => setTweak("showMap", v)}
          />
          <TweakToggle
            label="Rounded map edge"
            checked={tweaks.roundMapEdge !== false}
            onChange={(v) => setTweak("roundMapEdge", v)}
          />
          <TweakSlider
            label="Map opacity"
            value={tweaks.mapOpacity}
            min={0.1} max={1} step={0.05}
            onChange={(v) => setTweak("mapOpacity", v)}
          />
        </TweakSection>
        <TweakSection title="Game">
          <TweakSelect
            label="Detection algorithm"
            value={tweaks.algo}
            options={[
              { value: "subtract", label: "V − S (subtract)" },
              { value: "binary", label: "Binary (S ≥ V hides)" },
              { value: "half", label: "V − ⌈S/2⌉ (halved)" },
            ]}
            onChange={(v) => setTweak("algo", v)}
          />
          <div className="tweak-note">
            {DETECTION_ALGOS[tweaks.algo].desc}
          </div>
        </TweakSection>
      </TweaksPanel>
      }
    </div>
  );
}

window.Game = Game;
