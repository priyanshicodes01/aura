/* ============================================================
   AURA — reasoning engine
   ------------------------------------------------------------
   Why this is a transparent model and not a black-box LLM:

   Round 1 asks for fairness and clear choices. You cannot audit a
   black box for fairness, and you cannot show a traveller *why* a
   route was chosen if the reason lives inside a language model's
   weights. Every number this file produces can be traced back to a
   physical object on the map — a lamp, a shop, a bus stop.

   The engine does four things:
     1. scoreSegment()  — feature extraction over the road graph
     2. planRoute()     — weighted Dijkstra (cost = time x deficit)
     3. parseIntent()   — natural language -> routing weights
     4. verifyTag()     — outlier detection on community reports
   ============================================================ */

const WALK_MPS = 1.25;          // ~4.5 km/h
const PENALTY_GAIN = 2.4;       // how hard a deficit is punished
const LAMP_SPACING_IDEAL = 25;  // metres between lamps for lit = 1.0

const key = (a, b) => [a, b].sort().join('|');

function edgeBetween(a, b) {
  return EDGES.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

function neighbours(id) {
  const out = [];
  for (const e of EDGES) {
    if (e.a === id) out.push({ to: e.b, edge: e });
    else if (e.b === id) out.push({ to: e.a, edge: e });
  }
  return out;
}

const clamp01 = v => Math.max(0, Math.min(1, v));

/* ---------- 1. Feature extraction ------------------------------------
   Returns three INDEPENDENT factors. We never collapse them into one
   number: a single score hides its own assumptions and invites the
   false promise of safety. She compares three visible things instead.
*/
const NIGHT_ACTIVITY_DECAY = { path: 0.08, residential: 0.35, secondary: 0.60, trunk: 0.80 };

function scoreSegment(edge, hour) {
  const isNight = hour >= 20 || hour < 6;

  // LIT — from mapped street lamps per metre of segment.
  const lit = clamp01(edge.lamps / (edge.lengthM / LAMP_SPACING_IDEAL));

  // ACTIVE — doors open right now + modelled footfall for this hour.
  let open = edge.openNow, foot = edge.footfall;
  if (!isNight) {                       // data is stored at 23:00; scale up for daytime
    open = Math.min(open * 2.2 + 2, 12);
    foot = clamp01(foot * 1.4 + 0.25);
  } else {
    foot = clamp01(foot * (NIGHT_ACTIVITY_DECAY[edge.cls] ?? 0.4) + foot * 0.4);
  }
  const active = clamp01(0.6 * Math.min(open / 5, 1) + 0.4 * foot);

  // CONNECTED — can she leave this segment by public transport?
  const connected = edge.transit
    ? clamp01(0.5 + 0.5 * Math.min(edge.busRoutes.length / 3, 1))
    : 0.15;

  return { lit, active, connected };
}

/* ---------- Her own observations ----------
   This resolves a real tension. Aura refuses to repaint a street for
   everyone on the strength of one uncorroborated report — that is the
   anti-poisoning rule. But when SHE is standing there and says the
   street is not what Aura promised, arguing with her is absurd.

   So: her own report re-routes her own journey immediately, and only
   enters the shared picture once other people independently agree.
   One person's word is always enough to change their own path and
   never enough to change everybody else's.
*/
const PERSONAL = {};

function reportPersonally(edge, deltas) {
  const k = key(edge.a, edge.b);
  PERSONAL[k] = {
    lit: (PERSONAL[k]?.lit || 0) + (deltas.lit || 0),
    active: (PERSONAL[k]?.active || 0) + (deltas.active || 0),
  };
}

/* Factors adjusted by trusted community reports (Module A correction layer). */
function scoreSegmentAdjusted(edge, hour) {
  const base = scoreSegment(edge, hour);
  const k = key(edge.a, edge.b);
  let litBoost = 0, activeBoost = 0;

  const mine = PERSONAL[k];
  if (mine) { litBoost += mine.lit; activeBoost += mine.active; }
  for (const t of VIBE_TAGS) {
    if (key(...t.edge.split('|')) !== k) continue;
    const v = verifyTag(t);
    if (!v.accepted) continue;                       // rejected reports change nothing
    if (t.label === 'Well-lit')        litBoost += 0.10 * v.trust;
    else if (t.label === 'Lights out') litBoost -= 0.18 * v.trust;   // a reported outage counts against
    else                               activeBoost += 0.10 * v.trust;
  }
  return {
    lit: clamp01(base.lit + litBoost),
    active: clamp01(base.active + activeBoost),
    connected: base.connected,
    boosted: Math.abs(litBoost) + Math.abs(activeBoost) > 0.01,
  };
}

/* ---------- 2. Route planning — weighted Dijkstra ---------------------
   Cost is real travel time inflated by how badly the segment misses
   what she asked for. Change the weights and the graph genuinely
   re-solves; routes are not pre-baked.
*/
function normWeights(w) {
  const s = w.lit + w.active + w.connected || 1;
  return { lit: w.lit / s, active: w.active / s, connected: w.connected / s };
}

function planRoute(fromId, toId, weights, hour, comfort = 1) {
  const w = normWeights(weights);
  const dist = {}, prev = {}, seen = {};
  for (const id in NODES) dist[id] = Infinity;
  dist[fromId] = 0;

  while (true) {
    let u = null, best = Infinity;
    for (const id in NODES) if (!seen[id] && dist[id] < best) { best = dist[id]; u = id; }
    if (u === null || u === toId) break;
    seen[u] = true;

    for (const { to, edge } of neighbours(u)) {
      if (seen[to]) continue;
      const f = scoreSegmentAdjusted(edge, hour);
      const deficit = w.lit * (1 - f.lit) + w.active * (1 - f.active) + w.connected * (1 - f.connected);
      const seconds = edge.lengthM / WALK_MPS;
      const cost = seconds * (1 + PENALTY_GAIN * deficit * comfort);
      if (dist[u] + cost < dist[to]) { dist[to] = dist[u] + cost; prev[to] = u; }
    }
  }

  if (dist[toId] === Infinity) return null;
  const path = [toId];
  while (path[0] !== fromId) path.unshift(prev[path[0]]);
  return summarise(path, hour);
}

/* Turn a node path into everything the UI needs to explain itself. */
function summarise(path, hour) {
  const segs = [];
  let lengthM = 0, lamps = 0, openNow = 0, unlitM = 0;
  const routes = new Set();

  for (let i = 0; i < path.length - 1; i++) {
    const edge = edgeBetween(path[i], path[i + 1]);
    const f = scoreSegmentAdjusted(edge, hour);
    segs.push({ edge, f, from: path[i], to: path[i + 1] });
    lengthM += edge.lengthM;
    lamps += edge.lamps;
    openNow += edge.openNow;
    if (f.lit < 0.25) unlitM += edge.lengthM;
    edge.busRoutes.forEach(r => routes.add(r));
  }

  const wsum = (sel) => segs.reduce((s, x) => s + sel(x.f) * x.edge.lengthM, 0) / lengthM;

  return {
    path, segs, lengthM,
    walkMin: Math.round(lengthM / WALK_MPS / 60),
    lamps, openNow, unlitM,
    busRoutes: [...routes],
    factors: { lit: wsum(f => f.lit), active: wsum(f => f.active), connected: wsum(f => f.connected) },
    id: path.join('>'),
  };
}

/* ---------- Multimodal: the verified municipal bus ---------------------
   Delhi's own GTFS-RT feed is the only source here that can *prove* what
   a vehicle is. A bus carrying an OTD fleet id is a municipal vehicle;
   an unmarked van is not. It is also free for women, which means the
   verified option is very often the fastest AND the cheapest — and no
   navigation app currently tells her that.
*/
const BUS_MPS = 5.0;            // ~18 km/h on an arterial at night

/* A vehicle is boardable only if the city's feed both claims it AND
   places it on its published route. Verification is two questions, not one. */
function vehicleStatus(f) {
  if (!f.verified) return { ok: false, why: 'not in any municipal feed — no id, no schedule, no oversight' };
  if (f.onRoute === false || (f.deviationM ?? 0) > DEVIATION_LIMIT_M) {
    return { ok: false, why: `${f.deviationM} m off its published route` };
  }
  return { ok: true, why: `on route, ${f.deviationM} m from its published path` };
}

function transitItinerary(hour) {
  const path = ['hkv', 'hkv_gate', 'aur_s', 'aur_m', 'gp_metro'];
  const r = summarise(path, hour);

  const boardable = FLEET.filter(f => vehicleStatus(f).ok).sort((a, b) => a.etaMin - b.etaMin);
  const fleet = boardable[0];
  const rejected = FLEET.filter(f => !vehicleStatus(f).ok)
                        .map(f => ({ ...f, status: vehicleStatus(f) }));

  const walkEdge = edgeBetween('hkv', 'hkv_gate');
  const stopEdge = edgeBetween('hkv_gate', 'aur_s');     // where she stands and waits
  const walkF = scoreSegmentAdjusted(walkEdge, hour);
  const stopF = scoreSegmentAdjusted(stopEdge, hour);

  const walkToStopM = walkEdge.lengthM;
  const rideM = r.lengthM - walkToStopM;
  const walkMin = Math.max(1, Math.round(walkToStopM / WALK_MPS / 60));
  const rideMin = Math.max(1, Math.round(rideM / BUS_MPS / 60));
  const waitMin = fleet.etaMin;
  const totalMin = walkMin + waitMin + rideMin;

  /* Time-weighted, not distance-weighted. Standing still at a stop covers
     no distance, so a distance-weighted average scores the wait as free —
     but waiting alone at an unlit stop is exactly the exposure that matters.
     Inside a tracked municipal vehicle, all three factors are met. */
  const legs = [
    { min: walkMin, f: walkF },
    { min: waitMin, f: { lit: stopF.lit, active: stopF.active, connected: 1 } },
    { min: rideMin, f: { lit: 1, active: 1, connected: 1 } },
  ];
  const mix = sel => legs.reduce((s, l) => s + sel(l.f) * l.min, 0) / totalMin;
  r.factors = { lit: mix(f => f.lit), active: mix(f => f.active), connected: mix(f => f.connected) };

  r.transit = {
    fleet, rejected, walkMin, waitMin, rideMin, rideM, stop: NODES.hkv_gate.name,
    stopLit: stopF.lit, stopActive: stopF.active,
    supervision: [...(SUPERVISION.hkv_gate || []), ...(SUPERVISION.gp_metro || [])],
  };
  r.totalMin = totalMin;
  r.walkMin = walkMin;                 // only this much is on foot
  r.isTransit = true;
  r.tags = ['Verified bus'];
  r.id = 'transit:' + path.join('>');
  return r;
}

/* What a finished itinerary costs under a given set of priorities.
   The same cost function that picks the path also ranks the options,
   so the order she sees is the order the model actually believes in. */
function routeCost(route, weights, comfort = 1) {
  const w = normWeights(weights);
  const f = route.factors;
  const deficit = w.lit * (1 - f.lit) + w.active * (1 - f.active) + w.connected * (1 - f.connected);
  return route.totalMin * (1 + PENALTY_GAIN * deficit * comfort);
}

/* Candidate generation: solve the graph under several different
   priorities, keep the distinct itineraries, then rank all of them —
   walking and bus together — by what she actually asked for. */
function candidateRoutes(hour, userWeights, opts = {}) {
  const comfort = opts.comfort ?? 1;
  const profiles = [
    { label: 'Balanced',      w: userWeights,                         comfort },
    { label: 'Shortest',      w: { lit: 1, active: 1, connected: 1 }, comfort: 0 },
    { label: 'Most lit',      w: { lit: 6, active: 2, connected: 1 }, comfort: 1.3 },
    { label: 'Most open now', w: { lit: 2, active: 6, connected: 1 }, comfort: 1.1 },
  ];

  const from = opts.from ?? JOURNEY.from;
  const out = [], seenIds = new Set();

  // The municipal bus is a candidate unless she has said she wants to walk,
  // and only from the start — mid-journey the boarding leg no longer applies.
  if (!opts.walkOnly && from === JOURNEY.from) {
    const t = transitItinerary(hour);
    out.push(t); seenIds.add(t.id);
  }

  for (const p of profiles) {
    const r = planRoute(from, JOURNEY.to, p.w, hour, p.comfort);
    if (!r) continue;
    if (seenIds.has(r.id)) {
      const ex = out.find(x => x.id === r.id);
      if (ex && !ex.tags.includes(p.label)) ex.tags.push(p.label);
      continue;
    }
    seenIds.add(r.id);
    r.tags = [p.label];
    r.totalMin = r.walkMin;
    out.push(r);
  }

  out.forEach(r => { r.cost = routeCost(r, userWeights, comfort); });
  out.sort((a, b) => a.cost - b.cost);
  out.forEach((r, i) => { r.letter = String.fromCharCode(65 + i); });
  return out;
}

/* ---------- 3. Intent parsing ----------------------------------------
   Deterministic, inspectable, and it runs with the aeroplane mode on.
   Every phrase it matches is shown back to her, so she can see exactly
   what the app thinks she asked for. Model-swappable: replace this
   function with an LLM call returning the same weight object.
*/
const INTENT_RULES = [
  { re: /\b(alone|by myself|solo|akeli)\b/i,            note: 'travelling alone',        dw: { lit: 2.2, active: 1.8, connected: 0.6 } },
  { re: /\b(late|night|dark|11 ?pm|midnight|raat)\b/i,  note: 'late at night',           dw: { lit: 2.0, active: 1.4, connected: 0.8 } },
  { re: /\b(hurry|rush|fast|quick|late for)\b/i,        note: 'in a hurry',              dw: { lit: -0.6, active: -0.4, connected: 0.4 }, comfort: -0.85 },
  { re: /\b(bus|metro|transit|public transport|dtc)\b/i, note: 'wants public transport', dw: { connected: 2.6 } },
  { re: /\b(walk|walking|on foot|prefer to walk)\b/i,   note: 'wants to walk',           dw: { lit: 0.8, active: 0.8 }, walkOnly: true },
  { re: /\b(batter|phone.*(dying|dead|low)|charge|%)\b/i, note: 'battery is low',        dw: { connected: 1.6 }, comfort: -0.15, lowBattery: true },
  { re: /\b(shops?|open|market|people|crowd|busy)\b/i,  note: 'prefers places open',     dw: { active: 2.2 } },
  { re: /\b(light|lit|lamp|bright)\b/i,                 note: 'prefers lit streets',     dw: { lit: 2.4 } },
  { re: /\b(luggage|bags?|heavy|tired)\b/i,             note: 'carrying things',         dw: { connected: 1.8, lit: 0.4 } },
];

const BASE_WEIGHTS = { lit: 1.6, active: 1.6, connected: 1.2 };

function parseIntent(text) {
  const w = { ...BASE_WEIGHTS };
  const matched = [];
  let comfort = 1, lowBattery = false, walkOnly = false;

  for (const rule of INTENT_RULES) {
    if (!rule.re.test(text)) continue;
    matched.push(rule.note);
    for (const k in rule.dw) w[k] = Math.max(0.1, (w[k] ?? 0) + rule.dw[k]);
    if (rule.comfort) comfort = Math.max(0.15, comfort + rule.comfort);
    if (rule.lowBattery) lowBattery = true;
    if (rule.walkOnly) walkOnly = true;
  }
  return { weights: w, matched, comfort, lowBattery, walkOnly, understood: matched.length > 0 };
}

/* ---------- 4. Community report verification -------------------------
   A report that contradicts the mapped infrastructure and has nobody
   backing it up is an outlier, not a fact. This is what stops one
   account from poisoning a segment. Shown in the UI, never silent.
*/
/* Defence 1 — proximity fencing. You can only report the segment you are
   standing on. There is no way to pan the map somewhere else and tag it,
   which is how a single actor would otherwise paint a whole district.

   Note what we deliberately do NOT do: keep a per-account trust score.
   A durable reputation score is a durable identifier, and you cannot
   promise anonymous reporting while maintaining one. Corroboration plus
   cross-verification gets the same defence without the identifier. */
const TAG_FENCE_M = 60;

function withinFence(pos, edge) {
  const a = NODES[edge.a], b = NODES[edge.b];
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const d = Math.min(haversine(pos, a), haversine(pos, b), haversine(pos, mid));
  return { ok: d <= TAG_FENCE_M, distanceM: d };
}

/* Defence 2 — cross-verification and corroboration. */
function verifyTag(tag) {
  const [a, b] = tag.edge.split('|');
  const edge = edgeBetween(a, b);
  if (!edge) return { accepted: false, trust: 0, reason: 'segment not in graph' };

  if (tag.pos) {
    const fence = withinFence(tag.pos, edge);
    if (!fence.ok) {
      return { accepted: false, trust: 0, fenced: true,
               reason: `you are ${Math.round(fence.distanceM)} m from that street — reports are only accepted for where you are standing` };
    }
  }

  const base = scoreSegment(edge, 23);

  // Checked in BOTH directions. Claiming a dark park is bright and claiming a
  // lamp-lined arterial is pitch dark are the same kind of false report, and
  // only one of them would ever be used to push people somewhere.
  let contradiction = 0;
  if (tag.label === 'Well-lit')   contradiction = Math.max(0, 0.35 - base.lit) / 0.35;
  if (tag.label === 'Lights out') contradiction = Math.max(0, base.lit - 0.50) / 0.50;

  const support = Math.min(tag.corroborations / 4, 1);      // 4+ independent reports = full support
  const freshness = Math.max(0, 1 - tag.agedMin / 90);       // decays over 90 minutes
  const trust = clamp01(0.55 * support + 0.25 * freshness + 0.20 * (1 - contradiction));

  if (contradiction > 0.6 && support < 0.6) {
    return { accepted: false, trust, reason: `contradicts ${edge.lamps} mapped lamps, only ${tag.corroborations} report(s)` };
  }
  return { accepted: true, trust, reason: `${tag.corroborations} independent reports, ${Math.round(freshness * 100)}% fresh` };
}

/* ---------- Round 2: dynamic burn rate -------------------------------
   Not a static percentage. We measure the slope of the battery curve
   and project it forward to arrival; Shadow Mode is offered when the
   projection lands below the reserve she needs to make a call.
*/
const RESERVE_PCT = 8;

function burnRate(samples) {
  if (samples.length < 2) return null;
  const s = samples.slice(-12);
  const n = s.length;
  const mx = s.reduce((a, p) => a + p.t, 0) / n;
  const my = s.reduce((a, p) => a + p.level, 0) / n;
  let num = 0, den = 0;
  for (const p of s) { num += (p.t - mx) * (p.level - my); den += (p.t - mx) ** 2; }
  if (den === 0) return null;
  return Math.max(0, -(num / den));      // % per minute, positive = draining
}

function burnProjection(samples, level, etaMin) {
  const rate = burnRate(samples);
  if (rate === null) return { rate: null, arriveAt: level, trigger: level <= 15, reason: 'measuring…' };
  const arriveAt = level - rate * etaMin;
  const minutesLeft = rate > 0 ? level / rate : Infinity;
  return {
    rate,
    arriveAt,
    minutesLeft,
    trigger: arriveAt < RESERVE_PCT || level <= 15,
    reason: `${rate.toFixed(2)}%/min × ${etaMin} min = ${(rate * etaMin).toFixed(1)}% needed, ${level.toFixed(0)}% available`,
  };
}

/* ---------- Geometry helpers ---------- */
function haversine(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(a, b) {
  const toR = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * toR) * Math.cos(b.lat * toR);
  const x = Math.cos(a.lat * toR) * Math.sin(b.lat * toR) -
            Math.sin(a.lat * toR) * Math.cos(b.lat * toR) * Math.cos((b.lng - a.lng) * toR);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/* The nearest properly lit street, for when the answer to "this is not what
   you promised" is not a different route but simply a way out. */
function nearestLitExit(pos, hour) {
  let best = null, bestD = Infinity;
  for (const e of EDGES) {
    if (scoreSegment(e, hour).lit < 0.6) continue;
    for (const id of [e.a, e.b]) {
      const d = haversine(pos, NODES[id]);
      if (d < bestD) { bestD = d; best = { node: id, edge: e }; }
    }
  }
  return best ? { ...best, distanceM: bestD } : null;
}

function nearestHelpPoint(pos) {
  let best = null, bestD = Infinity;
  for (const h of HELP_POINTS) {
    const d = haversine(pos, h);
    if (d < bestD) { bestD = d; best = h; }
  }
  return { point: best, distanceM: bestD };
}
