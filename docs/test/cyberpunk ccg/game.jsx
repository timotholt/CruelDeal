/* global React, GameCard, LANE_POOL, buildDeck, makeRng,
   STAGE_W, STAGE_H, HEADER_H, FOOTER_H, BOARD_H, SIDE_PAD, LANE_GAP,
   LANE_W, LANE_H, LANE_COLS, LANE_ROWS,
   generateDots, dotPos, dotDistance, DETECTION_ALGOS,
   whoCanThisCardSee, whoCanSeeMe,
   useTweaks, TweaksPanel, TweakSection, TweakSlider, TweakToggle, TweakSelect */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

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

// ---------- Board ----------
function Lane({ lane, dots, placedCards, hoverDot, dragCard, algo, showGrid, accent, onInspect, onDotClick, selectedCard }) {
  return (
    <div className="lane" style={{ width: LANE_W, height: LANE_H }}>
      <div className="lane-frame" />
      {showGrid && (
        <svg className="lane-grid" width={LANE_W} height={LANE_H}>
          {Array.from({ length: LANE_COLS + 1 }).map((_, i) => (
            <line key={`v${i}`} x1={i * (LANE_W / LANE_COLS)} y1={0} x2={i * (LANE_W / LANE_COLS)} y2={LANE_H} />
          ))}
          {Array.from({ length: LANE_ROWS + 1 }).map((_, i) => (
            <line key={`h${i}`} x1={0} y1={i * (LANE_H / LANE_ROWS)} x2={LANE_W} y2={i * (LANE_H / LANE_ROWS)} />
          ))}
        </svg>
      )}

      <div className="lane-header">
        <div className="lane-header-name">{lane.name}</div>
        <div className="lane-header-sub">{lane.sub}</div>
      </div>

      {/* Dots */}
      {dots.map((d) => {
        const p = dotPos(d);
        const occupied = placedCards.find((c) => c.dot.id === d.id);
        const isHover = hoverDot && hoverDot.id === d.id;
        const isPlayable = selectedCard && !occupied;
        return (
          <div
            key={d.id}
            data-dot-id={d.id}
            className={`dot ${occupied ? "dot--occupied" : ""} ${isHover ? "dot--hover" : ""} ${isPlayable ? "dot--playable" : ""}`}
            style={{ left: p.x, top: p.y }}
            onClick={(e) => { if (!occupied && onDotClick) { e.stopPropagation(); onDotClick(d); } }}
          >
            <div className="dot-ring" />
            <div className="dot-core" />
          </div>
        );
      })}

      {/* Detection circles when DRAGGING */}
      {dragCard && hoverDot && hoverDot.laneIdx === lane.laneIdx && (
        <DetectionOverlay
          dot={hoverDot}
          card={dragCard}
          algo={algo}
          placedCards={placedCards}
        />
      )}

      {/* Detection circles when CARD IS SELECTED — preview at first open dot in this lane */}
      {!dragCard && selectedCard && (() => {
        const previewDot = dots.find((d) => !placedCards.some((c) => c.dot.id === d.id));
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

      {/* Placed cards — same canonical GameCard scaled down */}
      {placedCards.filter((c) => c.dot.laneIdx === lane.laneIdx).map((c) => {
        const p = dotPos(c.dot);
        // scale board cards: ~22px wide so they fit a column cell
        const boardScale = 0.22;
        const w = window.CARD_W * boardScale;
        const h = window.CARD_H * boardScale;
        return (
          <div
            key={c.uid}
            className={`placed ${c.owner === "you" ? "placed--you" : "placed--them"} ${c.revealed ? "placed--revealed" : ""} ${c.justRevealed ? "placed--flip" : ""}`}
            style={{ left: p.x, top: p.y, width: w, height: h }}
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
    </div>
  );
}

function DetectionOverlay({ dot, card, algo, placedCards }) {
  const p = dotPos(dot);
  // Visibility radius (blue) — how far this card sees a stealth-0 target
  const myRange = algo.range(card.vis, 0);
  // Exposure radius (red) — worst case: how far a stealth-0 enemy with same eye would see me.
  // Better: show the radius of EACH enemy that can already see this dot. For a clear preview, draw
  // a single red disc = the enemy with biggest effective range against THIS card.
  let maxEnemyReach = 0;
  for (const o of placedCards) {
    if (o.dot.laneIdx !== dot.laneIdx) continue;
    if (o.owner === "you") continue;
    const r = algo.range(o.vis, card.stealth);
    if (r > maxEnemyReach) maxEnemyReach = r;
  }
  // If no enemy in lane, still show "potential exposure" = card.power as a hint? Better: 0 means safe; show a tiny dashed ring representing my own footprint.
  const cellW = LANE_W / LANE_COLS;
  const cellH = LANE_H / LANE_ROWS;
  const cell = Math.min(cellW, cellH);
  const blueR = (myRange + 0.5) * cell;
  const redR = (maxEnemyReach + 0.5) * cell;

  return (
    <svg className="detect-svg" width={LANE_W} height={LANE_H}>
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
          <circle cx={p.x} cy={p.y} r={blueR} fill="url(#blueGrad)" stroke="#6ff7ff" strokeWidth="1" strokeDasharray="3 3" opacity="0.9" />
        </g>
      )}
      {maxEnemyReach > 0 && (
        <g className="ring-pulse-2">
          <circle cx={p.x} cy={p.y} r={redR} fill="url(#redGrad)" stroke="#ff5d8f" strokeWidth="1" strokeDasharray="2 4" opacity="0.9" />
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
      <div className="deck-stack" title={`${deckCount} cards in deck`}>
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
    if (o.dot.laneIdx !== hoverDot.laneIdx) continue;
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

  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "accentHue": 188,
    "dotDensity": 7,
    "algo": "subtract",
    "showGrid": false
  }/*EDITMODE-END*/);

  const accent = `oklch(0.78 0.16 ${tweaks.accentHue})`;
  const accent2 = `oklch(0.72 0.18 ${(tweaks.accentHue + 140) % 360})`;

  // Seeded session
  const sessionSeed = useMemo(() => Math.floor(Math.random() * 1e9), []);
  const rng = useMemo(() => makeRng(sessionSeed), [sessionSeed]);

  // Pick 3 lanes
  const lanes = useMemo(() => {
    const pool = [...LANE_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map((l, i) => ({ ...l, laneIdx: i }));
  }, [sessionSeed]);

  // Dots — regenerate when density changes
  const dotsByLane = useMemo(() => {
    const r = makeRng(sessionSeed + 1);
    return lanes.map((l, i) => generateDots(i, tweaks.dotDensity, r));
  }, [lanes, tweaks.dotDensity, sessionSeed]);

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
      const seenByTrigger = whoCanThisCardSee(trigger.dot, trigger.vis, snapshot, algo);
      // Others can see trigger
      const seerOfTrigger = whoCanSeeMe(trigger.dot, trigger.stealth, snapshot, algo);

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
    // Identify lane by x within board area
    const boardTop = HEADER_H;
    const boardLeft = SIDE_PAD;
    const localX = stageX - boardLeft;
    const localY = stageY - (boardTop + 8);
    if (localY < 0 || localY > LANE_H) return null;
    const laneStride = LANE_W + LANE_GAP;
    const laneIdx = Math.floor(localX / laneStride);
    if (laneIdx < 0 || laneIdx > 2) return null;
    const inLaneX = localX - laneIdx * laneStride;
    if (inLaneX < 0 || inLaneX > LANE_W) return null;

    // Find nearest dot in that lane
    const dots = dotsByLane[laneIdx] || [];
    let best = null, bestD = Infinity;
    for (const d of dots) {
      const p = dotPos(d);
      const dx = p.x - inLaneX;
      const dy = p.y - localY;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d; }
    }
    // snap distance: only if within some threshold
    const THRESH = 36 * 36;
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
      const allDots = dotsByLane.flat();
      const open = allDots.filter((d) => !placed.some((c) => c.dot.id === d.id));
      if (open.length === 0) {
        setTurn("you");
        return;
      }
      // simple AI: pick dot that maximizes their cards visible while minimizing exposure
      let best = open[0], bestScore = -Infinity;
      for (const d of open) {
        const seeing = whoCanThisCardSee(d, card.vis, placed, algo).filter((c) => c.owner === "you").length;
        const seers = whoCanSeeMe(d, card.stealth, placed, algo).filter((c) => c.owner === "you").length;
        const score = seeing * 2 - seers;
        if (score > bestScore) { bestScore = score; best = d; }
      }
      setTheirHand((h) => h.filter((c) => c.uid !== card.uid));
      placeCard(card, best, "them");
      setTimeout(() => setTurn("you"), 60);
    }, 1100);
    return () => clearTimeout(t);
  }, [turn, theirHand, placed, dotsByLane, algo, placeCard]);

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
        <div className="zone zone--header" style={{ height: HEADER_H }}>
          <Header
            accent={accent}
            you={{ name: "V_KOJIMA", score: scores.you }}
            them={{ name: "ZAIBATSU", score: scores.them }}
            turn={turn}
            deckCount={yourDeck.length}
          />
        </div>

        {/* Board */}
        <div className="zone zone--board" style={{ top: HEADER_H, height: BOARD_H }}>
          <div className="board-inner">
            {lanes.map((lane, i) => (
              <Lane
                key={lane.id}
                lane={lane}
                dots={dotsByLane[i] || []}
                placedCards={placed}
                hoverDot={dragState?.hoverDot}
                dragCard={dragState?.card}
                algo={algo}
                showGrid={tweaks.showGrid}
                accent={accent}
                onInspect={(c) => setInspect(c)}
                onDotClick={onDotClick}
                selectedCard={selected}
              />
            ))}
          </div>

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

        {/* Drag layer */}
        {dragState && <DragLayer card={dragState.card} x={dragState.x} y={dragState.y} />}

        {/* Undo button */}
        <button
          className="undo-btn"
          onClick={undo}
          disabled={history.length === 0}
          title="Undo last placement"
        >
          <span className="undo-icon">↶</span>
          <span className="undo-label">UNDO</span>
          <span className="undo-count">{history.length}</span>
        </button>

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

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Visuals">
          <TweakSlider
            label="Accent hue"
            value={tweaks.accentHue}
            min={0} max={360} step={1}
            onChange={(v) => setTweak("accentHue", v)}
          />
          <TweakToggle
            label="Show grid"
            checked={tweaks.showGrid}
            onChange={(v) => setTweak("showGrid", v)}
          />
        </TweakSection>
        <TweakSection title="Game">
          <TweakSlider
            label="Dots per lane"
            value={tweaks.dotDensity}
            min={5} max={8} step={1}
            onChange={(v) => setTweak("dotDensity", v)}
          />
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
    </div>
  );
}

window.Game = Game;
