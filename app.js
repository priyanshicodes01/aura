/* ============================================================
   AURA — application layer
   ============================================================ */

/* Count outbound network requests so the offline claim is provable. */
let REQUESTS = 0;
(function () {
  const f = window.fetch;
  window.fetch = function (...a) { REQUESTS++; paint(); return f.apply(this, a); };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...a) { REQUESTS++; paint(); return open.apply(this, a); };
})();

const $ = id => document.getElementById(id);

/* Only touch the DOM when the content has actually changed.
   paint() runs on every clock tick, and blindly reassigning innerHTML
   destroyed and recreated the route cards ~once a second. A browser only
   fires `click` when mousedown and mouseup land on the SAME element, so a
   card replaced mid-press swallowed the click and selecting a route felt
   broken. Comparing first keeps the elements — and their handlers — alive. */
function setHTML(el, html) {
  if (el.innerHTML !== html) el.innerHTML = html;
}

const S = {
  hour: 23,
  minute: 14,
  battery: 34,
  progress: 0,
  drain: 0,
  online: false,
  samples: [],
  simMin: 0,
  intent: parseIntent(''),
  routes: [],
  selected: 0,
  shadow: false,
  pocket: false,
  evade: false,
  running: false,
  origin: JOURNEY.from,
  zoom: false,
  lastTurn: null,
  checkinAsked: false,
  rerouted: false,
};

/* ---------------- geometry / projection ---------------- */
const VB_W = 1000, VB_H = 777, PAD_X = 74, PAD_Y = 58;

function project(lat, lng) {
  const fx = (lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng);
  const fy = (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat);
  return {
    x: PAD_X + fx * (VB_W - PAD_X * 2),
    y: (VB_H - PAD_Y) - fy * (VB_H - PAD_Y * 2),
  };
}
const pNode = id => project(NODES[id].lat, NODES[id].lng);

function lerpColor(c1, c2, t) {
  const h = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const [r1, g1, b1] = h(c1), [r2, g2, b2] = h(c2);
  const m = (a, b) => Math.round(a + (b - a) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}

/* ---------------- map ---------------- */
const SVGNS = 'http://www.w3.org/2000/svg';
/* Literal hex: SVG presentation attributes do not resolve var(). */
const C_LIT = '#F0B429', C_ACTIVE = '#4CC9F0', C_CONNECTED = '#B085F5', C_VERIFIED = '#7BE3C3';
function el(tag, attrs, text) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}

/* Each label gets its own offset and anchor. Centring everything above its
   node made "Green Park Mkt" and "Green Park Metro" collide — their nodes are
   only ~28px apart — and pushed "Aurobindo Marg" off the right edge.
   deer_mid is absent on purpose: the park carries its own label.
   dx/dy are in screen pixels, converted like everything else. */
const LABEL = {
  hkv:      { text: 'Hauz Khas Village', dx:  8, dy:  20, anchor: 'start'  },
  sda_mkt:  { text: 'SDA Market',        dx:  0, dy: -13, anchor: 'middle' },
  gp_mkt:   { text: 'Green Park Mkt',    dx:-10, dy: -12, anchor: 'end'    },
  gp_metro: { text: 'Green Park Metro',  dx: -6, dy:  20, anchor: 'middle' },
  aur_m:    { text: 'Aurobindo Marg',    dx: -8, dy: -13, anchor: 'end'    },
};

/* The map lives in a 1000-unit coordinate system but renders into a box of
   whatever width the device gives us. So a raw `font-size: 13` renders at
   13 x (boxWidth / 1000) actual pixels — about 5px on a 390px phone.
   Everything below is therefore specified in REAL SCREEN PIXELS and
   converted, which makes it correct at phone width and when enlarged. */
function drawMap(svg, mult = 1) {
  /* preserveAspectRatio="meet" fits the whole viewBox inside the box, so the
     real scale is limited by whichever axis is tighter — width on a phone,
     height on a wide desktop window. Using width alone would make the text
     tiny on the enlarged map. */
  const boxW = svg.clientWidth || 390;
  const boxH = svg.clientHeight || 330;
  const scale = Math.min(boxW / VB_W, boxH / VB_H) || 0.39;
  const px = n => (n * mult) / scale;       // screen px -> viewBox units

  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.innerHTML = '';

  // Deer Park mass — an unlit open space is a real feature of this route choice.
  const dp = [pNode('deer_s'), pNode('deer_mid'), pNode('deer_n')];
  svg.appendChild(el('path', {
    d: `M${dp[0].x - 90} ${dp[0].y + 40} Q${dp[1].x - 130} ${dp[1].y} ${dp[2].x - 60} ${dp[2].y - 50}
        Q${dp[2].x + 80} ${dp[2].y - 20} ${dp[1].x + 70} ${dp[1].y + 30}
        Q${dp[0].x + 60} ${dp[0].y + 70} ${dp[0].x - 90} ${dp[0].y + 40} Z`,
    fill: 'rgba(255,255,255,.03)', stroke: 'rgba(255,255,255,.07)', 'stroke-width': px(1),
  }));
  svg.appendChild(el('text', {
    x: dp[1].x - px(16), y: dp[1].y - px(2), fill: '#7B8496', 'font-size': px(13),
    'text-anchor': 'middle', 'letter-spacing': px(2), 'font-weight': 600,
  }, 'DEER PARK'));
  svg.appendChild(el('text', {
    x: dp[1].x - px(16), y: dp[1].y + px(14), fill: '#4A5160', 'font-size': px(10),
    'text-anchor': 'middle',
  }, 'unlit · no shops'));

  const route = S.routes[S.selected];
  const onRoute = new Set(route ? route.segs.map(s => key(s.from, s.to)) : []);

  // Base network, coloured by how much light is actually mapped on it.
  for (const e of EDGES) {
    const a = pNode(e.a), b = pNode(e.b);
    const f = scoreSegmentAdjusted(e, S.hour);
    const col = lerpColor('#2B3140', '#F0B429', f.lit);
    const isOn = onRoute.has(key(e.a, e.b));

    svg.appendChild(el('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: col, 'stroke-width': px(e.cls === 'trunk' ? 4.5 : e.cls === 'path' ? 2.6 : 3.4),
      'stroke-linecap': 'round', opacity: isOn ? 1 : 0.42,
      'stroke-dasharray': e.cls === 'path' ? `${px(5)} ${px(4.5)}` : '',
    }));

    // transport presence
    if (e.transit) {
      svg.appendChild(el('circle', {
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, r: px(3.6),
        fill: C_CONNECTED, opacity: isOn ? 0.95 : 0.45,
      }));
    }
    // doors open right now
    const n = Math.min(e.openNow, 4);
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      svg.appendChild(el('circle', {
        cx: a.x + (b.x - a.x) * t + px(5), cy: a.y + (b.y - a.y) * t - px(5), r: px(2),
        fill: C_ACTIVE, opacity: isOn ? 0.9 : 0.35,
      }));
    }
  }

  // Selected route highlight
  if (route) {
    const pts = route.path.map(pNode).map(p => `${p.x},${p.y}`).join(' ');
    svg.appendChild(el('polyline', {
      points: pts, fill: 'none', stroke: '#fff', 'stroke-width': px(2.2),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: .92,
    }));
  }

  // Help points
  for (const h of HELP_POINTS) {
    const p = project(h.lat, h.lng);
    if (p.x < 0 || p.x > VB_W || p.y < 0 || p.y > VB_H) continue;
    const s = px(4);
    svg.appendChild(el('rect', {
      x: p.x - s, y: p.y - s, width: s * 2, height: s * 2, rx: px(1),
      fill: 'none', stroke: C_VERIFIED, 'stroke-width': px(1.4), opacity: .75,
      transform: `rotate(45 ${p.x} ${p.y})`,
    }));
  }

  // Place labels — white enough to actually read on a projector
  for (const id in LABEL) {
    const L = LABEL[id], p = pNode(id);
    svg.appendChild(el('text', {
      x: p.x + px(L.dx), y: p.y + px(L.dy), fill: '#D4DAE6', 'font-size': px(11),
      'text-anchor': L.anchor, 'font-weight': 500,
    }, L.text));
  }

  for (const id of [S.origin, JOURNEY.to]) {
    const p = pNode(id);
    svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: px(6), fill: 'none', stroke: '#fff', 'stroke-width': px(2) }));
    svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: px(2.6), fill: '#fff' }));
  }

  // Her position along the route
  if (route && S.progress > 0) {
    const pos = positionAt(route, S.progress / 100);
    const p = project(pos.lat, pos.lng);
    svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: px(12), fill: 'rgba(255,255,255,.14)' }));
    svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: px(5), fill: '#fff' }));
  }
}

/* Interpolate a lat/lng at fraction f along a route. */
function positionAt(route, f) {
  const total = route.lengthM;
  let want = total * Math.min(Math.max(f, 0), 1), acc = 0;
  for (const s of route.segs) {
    if (acc + s.edge.lengthM >= want) {
      const t = (want - acc) / s.edge.lengthM;
      const A = NODES[s.from], B = NODES[s.to];
      return { lat: A.lat + (B.lat - A.lat) * t, lng: A.lng + (B.lng - A.lng) * t, seg: s, t };
    }
    acc += s.edge.lengthM;
  }
  const last = route.segs[route.segs.length - 1];
  return { ...NODES[route.path[route.path.length - 1]], seg: last, t: 1 };
}

function remainingM(route, f) { return route.lengthM * (1 - Math.min(Math.max(f, 0), 1)); }

/* The enlarged map. Same drawing code, a much bigger box — which is exactly
   why sizes had to be expressed in screen pixels rather than viewBox units. */
function drawZoom() {
  const r = S.routes[S.selected];
  $('mzMeta').textContent = `${clockString()} · Route ${r ? r.letter : '—'}` +
    (r ? ` · ${r.totalMin} min · ${Math.round(r.unlitM)} m unlit` : '');
  drawMap($('mapBig'), 1.5);      // bigger text and markers for a projector
}

function openZoom() {
  S.zoom = true;
  $('mapZoom').classList.add('on');
  drawZoom();                 // must be after .on, or clientWidth reads 0
}

function closeZoom() {
  S.zoom = false;
  $('mapZoom').classList.remove('on');
}

/* ---------------- routes ---------------- */
function replan() {
  S.routes = candidateRoutes(S.hour, S.intent.weights, {
    walkOnly: S.intent.walkOnly,
    comfort: S.intent.comfort,
    from: S.origin,
  });
  if (S.selected >= S.routes.length) S.selected = 0;
}

/* ---------- Mid-journey check-in ----------
   Standard navigation calculates once and forgets. Aura asks one
   low-friction question at the point where its own prediction is most
   load-bearing, and re-solves from where she is standing if she says no.
   One question, one tap, no streak, no nagging — and never a
   consequence for ignoring it. An app that panics when she puts her
   phone in her bag is a liability, not a companion.
*/
function renderCheckin() {
  const slot = $('checkinSlot');
  const r = S.routes[S.selected];

  if (S.rerouted) {
    setHTML(slot, `<div class="checkin done">
      <b>${S.rerouted.headline}</b> ${S.rerouted.detail}
      Your word changed your own route immediately. It only changes anyone else's once
      other people independently agree — enough for your own path, never enough for everybody's.</div>`);
    return;
  }
  if (!r || S.shadow || S.checkinAsked || S.progress < 35 || S.progress > 85) { setHTML(slot, ''); return; }

  const pos = positionAt(r, S.progress / 100);
  const where = NODES[pos.seg.to].name.replace(' — ', ', ');
  const promised = Math.round(pos.seg.f.active * 100);

  setHTML(slot, `<div class="checkin">
    <b>Coming up to ${where}.</b> Aura expected this stretch to be ${promised}% active. Is it?
    <div class="checkin-btns">
      <button id="ciYes">Yes, it's fine</button>
      <button id="ciNo">No, it's dead</button>
    </div></div>`);

  $('ciYes').onclick = () => { S.checkinAsked = true; paint(); };
  $('ciNo').onclick = () => {
    // She is standing here, so this is a first-hand observation, not a rumour.
    reportPersonally(pos.seg.edge, { lit: -0.25, active: -0.45 });
    S.intent.weights.lit += 1.5;
    S.intent.weights.active += 1.5;

    const before = r.path.join('>');
    S.origin = pos.seg.to;          // re-solve from the next junction, not the start
    S.progress = 0;
    S.checkinAsked = true;
    S.selected = 0;
    $('progSlider').value = 0;
    replan();

    /* It would be easy to always claim a reroute. Often there isn't one —
       a corridor is a corridor — and saying so is worth more than pretending.
       Then the useful answer is the nearest lit street, not a fake alternative. */
    const after = S.routes[0];
    if (after && after.path.join('>') !== before) {
      S.rerouted = {
        headline: 'Rerouted from where you are.',
        detail: `New route is ${after.totalMin} min with ${Math.round(after.unlitM)} m unlit.`,
      };
    } else {
      const exit = nearestLitExit(pos, S.hour);
      const help = nearestHelpPoint(pos);
      S.rerouted = {
        headline: 'There is no better-lit way from here.',
        detail: `This is already the shortest way out, so Aura is not going to invent an alternative. ` +
          `Nearest lit street: ${NODES[exit.node].name.replace(' — ', ', ')}, ${Math.round(exit.distanceM)} m. ` +
          `Nearest open help point: ${help.point.name}, ${Math.round(help.distanceM)} m.`,
      };
    }
    paint();
  };
}

const FACTOR_META = [
  ['lit', 'Lit', 'var(--lit)'],
  ['active', 'Open now', 'var(--active)'],
  ['connected', 'Transport', 'var(--connected)'],
];

function renderRoutes() {
  const html = S.routes.map((r, i) => {
    const bars = FACTOR_META.map(([k, label, col]) => `
      <div class="bar">
        <div class="bar-label"><span>${label}</span><span>${Math.round(r.factors[k] * 100)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.factors[k] * 100)}%;background:${col}"></div></div>
      </div>`).join('');

    const unlit = r.unlitM > 40
      ? `<br>${Math.round(r.unlitM)} m with no mapped street lighting`
      : '<br>No unlit stretch on this route';

    // The verified badge is only claimed when she is actually on the fleet.
    // A walking route that happens to pass a bus stop does not get it.
    const t = r.transit;
    const fleet = r.isTransit
      ? (i === S.selected
          ? `<div class="badge-verified">◆ ${t.fleet.operator} route ${t.fleet.route} · fleet ${t.fleet.fleetId} · free for women</div>`
          : `<div class="badge-verified">◆ Verified municipal fleet · free for women</div>`)
      : '';

    /* What is actually pulling up at the stop. Verification is two
       questions: is it in the city's feed, and is it on its route?
       Only rendered for the SELECTED card — it is tall, and when every card
       carried it, cards B and C were pushed out of the scroll view entirely. */
    const vcheck = (r.isTransit && i === S.selected) ? `
      <div class="vcheck">
        <div class="vrow ok"><span>◆</span><div><b>${t.fleet.operator} ${t.fleet.route} · ${t.fleet.fleetId}</b>
          ${vehicleStatus(t.fleet).why} · one every ${t.fleet.headwayMin} min${t.fleet.marshal ? ' · marshal on board' : ''}</div></div>
        ${t.rejected.map(v => `<div class="vrow bad"><span>△</span><div><b>${v.operator}${v.fleetId ? ' · ' + v.fleetId : ''}</b>${v.status.why}</div></div>`).join('')}
      </div>
      <div class="supers">${t.supervision.map(s => `<span title="${s.detail}">${s.label}</span>`).join('')}</div>` : '';

    const sub = r.isTransit
      ? `${t.walkMin} min walk · ${t.waitMin} min wait · ${t.rideMin} min on the bus`
      : `${(r.lengthM / 1000).toFixed(2)} km on foot`;

    return `
      <div class="route${i === S.selected ? ' sel' : ''}" data-i="${i}">
        <div class="route-top">
          <div class="route-letter">${r.letter}</div>
          <div>
            <div class="route-time">${r.totalMin} min</div>
            <div class="route-dist">${sub}</div>
          </div>
          <div class="route-tag">${i === 0 ? 'Recommended' : r.tags[0]}</div>
        </div>
        <div class="bars">${bars}</div>
        <div class="facts">${r.lamps} mapped street lamps · ${r.openNow} places open now${unlit}</div>
        ${fleet}${vcheck}
      </div>`;
  }).join('');

  setHTML($('routeList'), html);

  const n = S.routes.length;
  $('routeCount').textContent =
    `— ${n} option${n === 1 ? '' : 's'}, tap one to show it on the map`;
}

/* The companion explanation. It only ever states counted facts. */
function renderWhy() {
  const r = S.routes[S.selected];
  if (!r) return;

  const quickest = S.routes.reduce((a, b) => (a.totalMin <= b.totalMin ? a : b));
  const onFoot = S.routes.filter(x => !x.isTransit);
  const darkest = onFoot.length ? onFoot.reduce((a, b) => (a.unlitM >= b.unlitM ? a : b)) : null;
  let lead = '';

  if (r.isTransit) {
    const t = r.transit;
    lead = `<b>Route ${r.letter} is a ${t.fleet.operator} bus that is where the city says it should be.</b> ` +
      `Fleet ${t.fleet.fleetId} appears in Delhi's own feed and is ${t.fleet.deviationM} m from its ` +
      `published route — Aura checks both, because a vehicle can be real and still be off route. ` +
      `It is free for women, so the one you can verify is also the cheapest. ` +
      `You walk ${t.walkMin} min to ${t.stop}, wait about ${t.waitMin} min at a stop with ` +
      `${Math.round(t.stopLit * 100)}% lighting cover, then ride ${(t.rideM / 1000).toFixed(1)} km. ` +
      `One comes every ${t.fleet.headwayMin} min, so missing it costs ${t.fleet.headwayMin} minutes, not forty.`;
    if (t.rejected.length) {
      const v = t.rejected[0];
      lead += ` There is also ${v.operator.toLowerCase()} at the stop, ${v.etaMin} min sooner — Aura will not recommend it: ${v.status.why}.`;
    }
    if (darkest) {
      lead += ` Walking instead would put you on foot for ${darkest.totalMin} min, ` +
        `${Math.round(darkest.unlitM)} m of it with no mapped street lighting.`;
    }
  } else if (r.id === quickest.id) {
    lead = `<b>Route ${r.letter} is the quickest way to do this on foot.</b> ` +
      `It is also the one with the least light on it: ${Math.round(r.unlitM)} m of the ` +
      `${(r.lengthM / 1000).toFixed(2)} km has no mapped street lamps, and ${r.openNow} places are ` +
      `open along the whole route. Aura is not telling you not to take it — it is telling you what it is.`;
  } else {
    const gainLamps = r.lamps - quickest.lamps;
    const gainOpen = r.openNow - quickest.openNow;
    const lessDark = Math.max(0, Math.round(quickest.unlitM - r.unlitM));
    lead = `<b>Route ${r.letter} is ${r.totalMin - quickest.totalMin} min longer than Route ${quickest.letter}.</b> ` +
      `What you get for those minutes: ${gainLamps > 0 ? gainLamps + ' more' : 'no extra'} mapped street lamps` +
      `${gainOpen > 0 ? `, ${gainOpen} more places open at this hour` : ''}` +
      `${lessDark > 0 ? `, and ${lessDark} m less walking with no lighting` : ''}.`;
    const stops = r.segs.filter(s => s.edge.transit).length;
    if (stops) lead += ` There ${stops === 1 ? 'is 1 bus stop' : `are ${stops} bus stops`} on it, so you can cut the walk short if you change your mind.`;
  }

  const boosted = r.segs.some(s => s.f.boosted);
  setHTML($('whyPanel'), lead +
    `<span class="src">Counted from cached OpenStreetMap street-lamp and sidewalk tags, venue opening hours, ` +
    `and Delhi OTD fleet data${boosted ? ', adjusted by corroborated community reports' : ''}. ` +
    `Aura uses no crime data and scores no neighbourhood — only the street in front of you.</span>`);
}

/* ---------------- burn rate banner (Round 2 entry) ---------------- */
function renderBurn() {
  const slot = $('burnSlot');
  const r = S.routes[S.selected];
  if (!r || S.shadow) { setHTML(slot, ''); return; }

  const etaMin = Math.max(1, Math.round(r.totalMin * (1 - S.progress / 100)));
  const proj = burnProjection(S.samples, S.battery, etaMin);
  if (!proj.trigger) { setHTML(slot, ''); return; }

  const arrive = Math.max(0, proj.arriveAt);
  setHTML(slot, `
    <div class="burn">
      <b>At this rate you arrive on ${arrive.toFixed(0)}%.</b>
      You need ${RESERVE_PCT}% left to make a call. Aura can drop to a mode that uses almost nothing.
      <span class="math">${proj.reason}</span>
      <button id="burnGo">Switch to Shadow Mode</button>
    </div>`);
  $('burnGo').onclick = enterShadow;
}

/* ---------------- Shadow Mode ---------------- */
function enterShadow() { S.shadow = true; $('shadow').classList.add('on'); paint(); }
function exitShadow() { S.shadow = false; $('shadow').classList.remove('on'); paint(); }

function renderShadow() {
  if (!S.shadow) return;
  const r = S.routes[S.selected];
  if (!r) return;
  const f = S.progress / 100;
  const pos = positionAt(r, f);
  const rem = remainingM(r, f);

  $('shBatt').textContent = `${S.battery.toFixed(0)}%`;
  $('shDest').textContent = NODES[JOURNEY.to].name.toUpperCase();
  $('shDistVal').textContent = Math.round(rem);

  const nextNode = NODES[pos.seg.to];
  const brg = bearing(pos, nextNode);
  $('shArrowG').setAttribute('transform', `rotate(${brg.toFixed(0)} 50 50)`);
  $('shNext').textContent = rem < 30
    ? 'You have arrived'
    : `${compass(brg)} · continue to ${nextNode.name.replace(' — ', ', ')}`;

  const h = nearestHelpPoint(pos);
  $('shHelp').innerHTML =
    `<b>${h.point.name}</b>${h.point.kind} · ${h.point.hours} · ${Math.round(h.distanceM)} m away`;

  hapticTurns(pos);
  if (S.pocket) {
    $('pkBatt').textContent = `${S.battery.toFixed(0)}%`;
    $('pkDist').textContent = `${Math.round(rem)} m`;
  }
}

/* Haptic turn cues. The lowest-power interface is no interface: the phone
   goes in her pocket and buzzes once for left, twice for right, so she is
   not lighting up a screen and staring at it in the dark.
   navigator.vibrate is supported on Android browsers and not on iOS Safari;
   on iOS this degrades to the wake-on-tap screen. See README. */
let _lastSeg = null, _lastBearing = null;

function hapticTurns(pos) {
  const k = key(pos.seg.from, pos.seg.to);
  if (k === _lastSeg) return;
  const brg = bearing(NODES[pos.seg.from], NODES[pos.seg.to]);

  if (_lastSeg !== null && _lastBearing !== null) {
    const delta = ((brg - _lastBearing + 540) % 360) - 180;
    if (delta < -25)      { S.lastTurn = 'Left';        navigator.vibrate?.([180]); }
    else if (delta > 25)  { S.lastTurn = 'Right';       navigator.vibrate?.([180, 120, 180]); }
    else                  { S.lastTurn = 'Straight on'; }
  }
  _lastSeg = k; _lastBearing = brg;
}

function compass(b) {
  const dirs = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
  return dirs[Math.round(b / 45) % 8];
}

/* ---------------- Vibe is off ---------------- */
function renderEvade() {
  const r = S.routes[S.selected];
  const pos = r ? positionAt(r, S.progress / 100) : NODES[JOURNEY.from];
  const h = nearestHelpPoint(pos);
  $('evName').textContent = h.point.name;
  $('evDist').textContent = `${Math.round(h.distanceM)} m · ${Math.max(1, Math.round(h.distanceM / WALK_MPS / 60))} min · ${h.point.hours}`;
  $('evArrowG').setAttribute('transform', `rotate(${bearing(pos, h.point).toFixed(0)} 50 50)`);
}

/* ---------------- Ghost Ping ---------------- */
function smsBody() {
  const r = S.routes[S.selected];
  const pos = r ? positionAt(r, S.progress / 100) : NODES[JOURNEY.from];
  const eta = r ? Math.max(1, Math.round(r.totalMin * (1 - S.progress / 100))) : 0;
  return [
    `Aura check-in ${clockString()}`,
    `Battery ${S.battery.toFixed(0)}%`,
    `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`,
    `maps.google.com/?q=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}`,
    `Heading to ${NODES[JOURNEY.to].name}, about ${eta} min`,
    `Sent by me. Aura is not tracking me.`,
  ].join('\n');
}

function setupGhostSlider() {
  const track = $('ghostSlider'), knob = $('ghostKnob');
  let dragging = false, startX = 0, x = 0;

  const maxX = () => track.clientWidth - knob.clientWidth - 8;
  const set = v => { x = Math.max(0, Math.min(v, maxX())); knob.style.left = (4 + x) + 'px'; };

  const down = e => { dragging = true; startX = (e.touches ? e.touches[0].clientX : e.clientX) - x; };
  const move = e => {
    if (!dragging) return;
    e.preventDefault();
    set((e.touches ? e.touches[0].clientX : e.clientX) - startX);
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    if (x > maxX() * 0.8) {
      track.classList.add('done');
      set(maxX());
      $('smsPreview').textContent = smsBody();
      $('smsModal').classList.add('on');
    } else { set(0); }
  };

  knob.addEventListener('mousedown', down);
  knob.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('mouseup', up);
  window.addEventListener('touchend', up);

  $('smsCancel').onclick = () => { $('smsModal').classList.remove('on'); track.classList.remove('done'); set(0); };
  $('smsSend').onclick = () => {
    // Opens the native composer. The app never sends anything by itself.
    window.location.href = 'sms:?&body=' + encodeURIComponent(smsBody());
    $('smsModal').classList.remove('on');
  };
}

/* ---------------- community reports ---------------- */
const TAG_OPTIONS = [
  { emoji: '💡', label: 'Well-lit' },
  { emoji: '☕️', label: 'Bustling' },
  { emoji: '🚌', label: 'Bus just came' },
  { emoji: '🌑', label: 'Lights out' },
];

function setupTags() {
  const grid = $('tagGrid');
  TAG_OPTIONS.forEach(o => {
    const b = document.createElement('div');
    b.className = 'tag-opt';
    b.innerHTML = `<span style="font-size:17px">${o.emoji}</span> ${o.label}`;
    b.onclick = () => submitTag(o);
    grid.appendChild(b);
  });
  $('btnTag').onclick = () => $('tagModal').classList.add('on');
  $('tagClose').onclick = () => $('tagModal').classList.remove('on');
}

function submitTag(opt) {
  const r = S.routes[S.selected];
  const pos = positionAt(r, S.progress / 100);
  const seg = pos.seg.edge;
  const candidate = {
    edge: key(seg.a, seg.b), label: opt.label, corroborations: 1, agedMin: 0,
    pos: { lat: pos.lat, lng: pos.lng },      // fenced: you can only report where you stand
  };
  const v = verifyTag(candidate);

  $('tagVerdict').innerHTML = v.accepted
    ? `<b>Accepted, weight ${(v.trust * 100).toFixed(0)}%.</b> ${v.reason}. It will appear on ${NODES[seg.a].name} → ${NODES[seg.b].name} after a delay, snapped to the street rather than your point, with no identity attached.`
    : v.fenced
      ? `<b>Not accepted.</b> ${v.reason}.`
      : `<b>Held for corroboration.</b> ${v.reason}. Aura will not change a route on one report that disagrees with what is mapped on the ground — that is how a single account could otherwise repaint a street.`;

  if (v.accepted) { VIBE_TAGS.push({ id: 'u' + Date.now(), ...candidate }); replan(); paint(); }
}

/* ---------------- clock, ticking, painting ---------------- */
function clockString() {
  return `${String(S.hour).padStart(2, '0')}:${String(S.minute).padStart(2, '0')}`;
}

function tick() {
  S.simMin += 1;
  S.minute = (S.minute + 1) % 60;

  /* The hour deliberately does NOT advance. One simulated minute passes every
     1.2 real seconds, so a rolling hour drifted from 23:00 into daylight after
     about eight minutes of demoing — silently changing every route score
     mid-presentation. The hour is owned by the demo rig slider, nothing else. */

  if (S.drain > 0) S.battery = Math.max(0, S.battery - S.drain);
  S.samples.push({ t: S.simMin, level: S.battery });
  if (S.samples.length > 40) S.samples.shift();

  if (S.running && S.progress < 100) {
    const r = S.routes[S.selected];
    if (r) S.progress = Math.min(100, S.progress + 100 / Math.max(r.totalMin, 1));
    $('progSlider').value = S.progress;
  }
  paint();
}

function paint() {
  if (!$('clock')) return;          // may be called before the DOM is ready
  $('clock').textContent = clockString();
  $('battpct').textContent = `${S.battery.toFixed(0)}%`;
  $('battfill').style.width = `${S.battery}%`;
  $('netstate').textContent = S.online ? 'LTE' : 'No service';
  $('hourVal').textContent = `${String(S.hour).padStart(2, '0')}:00`;
  $('battVal').textContent = `${S.battery.toFixed(0)}%`;
  $('progVal').textContent = `${Math.round(S.progress)}%`;
  $('reqCount').textContent = REQUESTS;

  const night = S.hour >= 20 || S.hour < 6;
  $('ctxline').textContent = `${night ? 'Night' : 'Day'} mode · Hauz Khas → Green Park`;

  renderRoutes();
  renderWhy();
  renderBurn();
  renderCheckin();
  drawMap($('map'));
  if (S.zoom) drawZoom();
  renderShadow();
  if (S.evade) renderEvade();
}

/* ---------------- intent ---------------- */
const SUGGESTIONS = [
  "I'm walking home alone, it's late and my phone is dying",
  "In a hurry, I'll walk it",
  "I'd rather take a bus, carrying bags",
];

function runIntent(text) {
  S.intent = parseIntent(text);
  replan();
  S.selected = 0;
  renderChips();
  paint();
}

function renderChips() {
  const box = $('intentChips');
  box.innerHTML = '';
  if (S.intent.matched.length) {
    S.intent.matched.forEach(m => {
      const c = document.createElement('span');
      c.className = 'chip read';
      c.textContent = 'read: ' + m;
      box.appendChild(c);
    });
  } else {
    SUGGESTIONS.forEach(s => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = s;
      c.onclick = () => { $('intentInput').value = s; runIntent(s); };
      box.appendChild(c);
    });
  }
}

/* ---------------- wiring ---------------- */
function boot() {
  replan();
  setupGhostSlider();
  setupTags();
  renderChips();

  /* One listener on the container, which is never replaced, rather than one
     per card. Plus a remembered index from the press: if a card is rebuilt
     between mousedown and mouseup, the browser fires `click` on the container
     instead of the card, and reading the target alone would lose the pick. */
  let pendingPick = null;
  const remember = e => {
    const c = e.target.closest?.('.route');
    pendingPick = c ? +c.dataset.i : null;
  };
  $('routeList').addEventListener('mousedown', remember);
  $('routeList').addEventListener('touchstart', remember, { passive: true });

  $('routeList').addEventListener('click', e => {
    const card = e.target.closest('.route');
    const i = card ? +card.dataset.i : pendingPick;
    if (i == null || Number.isNaN(i)) return;
    S.selected = i;
    pendingPick = null;
    paint();
  });

  $('intentGo').onclick = () => runIntent($('intentInput').value);
  $('intentInput').addEventListener('keydown', e => { if (e.key === 'Enter') runIntent(e.target.value); });

  $('hourSlider').oninput = e => { S.hour = +e.target.value; replan(); paint(); };
  $('battSlider').oninput = e => {
    S.battery = +e.target.value;
    S.samples.push({ t: S.simMin, level: S.battery });
    paint();
  };
  $('progSlider').oninput = e => { S.progress = +e.target.value; paint(); };

  document.querySelectorAll('[data-drain]').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('[data-drain]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.drain = +b.dataset.drain;
      S.samples = [{ t: S.simMin, level: S.battery }];
    };
  });
  document.querySelectorAll('[data-net]').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('[data-net]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      S.online = b.dataset.net === '1';
      paint();
    };
  });

  $('btnStart').onclick = () => {
    S.running = !S.running;
    $('btnStart').textContent = S.running ? 'Pause' : 'Start';
  };
  $('btnEvade').onclick = () => { S.evade = true; $('evade').classList.add('on'); renderEvade(); };
  $('evExit').onclick = () => { S.evade = false; $('evade').classList.remove('on'); };

  // Tapping the shadow screen's top row leaves Shadow Mode.
  $('shadow').querySelector('.sh-top').onclick = exitShadow;

  // Enlarge the map: the button, or tapping the map itself.
  $('mapExpand').onclick = e => { e.stopPropagation(); openZoom(); };
  $('map').onclick = openZoom;
  $('mzClose').onclick = closeZoom;
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && S.zoom) closeZoom(); });
  window.addEventListener('resize', () => { if (S.zoom) drawZoom(); });

  $('pocketBtn').onclick = () => { S.pocket = true; $('pocket').classList.add('on'); paint(); };
  $('pocket').onclick = () => { S.pocket = false; $('pocket').classList.remove('on'); };

  S.samples.push({ t: 0, level: S.battery });
  paint();
  setInterval(tick, 1200);   // 1 simulated minute per 1.2 s

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
