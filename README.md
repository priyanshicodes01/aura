# Aura

**Not just where to go — which journey fits the moment.**
**The signal may disappear. Support shouldn't.**

A journey companion for Delhi that compares routes by what is physically on them —
street lighting, places open right now, and verified municipal transport — and that
keeps guiding you after the internet and the battery have gone.

Live: https://aura-kappa-self.vercel.app/

---

## The two rounds, in one app

| | |
|---|---|
| **Round 1 — Beyond the Fastest Route** | Type a sentence about your journey. Aura re-solves the street network against what you said and shows you the trade in counted facts, never in a verdict. |
| **Round 2 — 5% battery, no internet** | Aura measures how fast your battery is actually draining, projects it to your arrival, and drops to a black-screen skeleton route with one compact SMS check-in. |

---

## Four design decisions worth defending

### 1. Only score what you can point at
Every factor Aura uses is a physical object that exists on the map and can be verified
by walking there: a street lamp, a shop with its doors open, a bus stop, a sidewalk.

Aura stores **no crime data, no incident reports and no area reputation of any kind.**
This is not an oversight — it is the whole design. Route-safety products have a long
history of effectively steering users away from poorer neighbourhoods, because the
inputs correlate with income. Infrastructure counts do not have that failure mode.

Three consequences:

- **Aura never colours an area.** It scores *segments of road*. There is no red zone,
  because there is no zone.
- **Aura never uses a negative label.** It can say "890 m with no mapped street lighting."
  It cannot say "bad area." Absence is reported as absence.
- **The same data becomes civic accountability.** A low lighting score is a fact about
  municipal infrastructure, not about the people who live there.

### 2. One number would be a lie
Aura never collapses its factors into a single safety score. It reports three
independent dimensions — **Lit**, **Open now**, **Transport** — and lets the traveller
weight them. A single score hides its own assumptions, invites the false promise of
safety, and removes her judgement from her own journey.

The palette contains **no red and no green**, for the same reason. Those colours encode
a verdict. Each factor gets its own neutral hue instead.

### 3. A transparent model, not a black box
Round 1 asks for fairness and clear choices. You cannot audit a black box for fairness,
and you cannot tell someone *why* a route was chosen if the reason lives inside a
language model's weights.

So the reasoning is an inspectable scoring model over real features, and every number
on screen traces back to a countable object. `engine.js` is the entire argument, in
about 300 lines:

| Function | What it does |
|---|---|
| `scoreSegment()` | Feature extraction per road segment — lamp density, doors open at this hour, transport reach, modulated by time of day |
| `planRoute()` | Weighted Dijkstra. Cost = real travel time inflated by how badly a segment misses what she asked for. Change the weights and the graph genuinely re-solves; routes are not pre-baked |
| `parseIntent()` | Natural language → routing weights. Deterministic, shows you every phrase it matched, and runs in aeroplane mode |
| `verifyTag()` | Outlier detection on community reports. A report contradicting the mapped infrastructure with nobody backing it up is held, not published |
| `burnProjection()` | Linear regression on the battery curve, projected to arrival |

`parseIntent()` is deliberately model-swappable: replace the function body with an LLM
call returning the same weight object and nothing else changes. We kept it local because
an app whose premise is "the internet is gone" should not need a server to understand a
sentence — and because a model that improvises facts about a street at 1 a.m. is a hazard,
not a feature.

### 4. Answering "will I be safe on that bus" without surveilling anyone

The instinct is to show how many other women are on board. That instinct is right about
the fear and wrong about the mechanism, in three ways: it needs cameras scanning
passengers, no transit API anywhere publishes it, and an app that broadcasts *"the bus
arriving in 2 minutes has one woman on it"* has built a targeting tool.

But look at what actually failed in Delhi's most notorious case: the vehicle was a
private bus, **off its route**, posing as public transit. That is a property of the
vehicle, not of its passengers — and GTFS-Realtime publishes exactly the two fields
needed to catch it:

- `VehiclePosition` — where the bus actually is
- `TripUpdate` — which published trip it is supposed to be running

Subtract one from the other and you get **route deviation**. Aura therefore asks two
questions before it recommends a vehicle, not one:

| Question | Source | Failure it catches |
|---|---|---|
| Is it in the city's feed? | fleet id present | unmarked private vehicle posing as transit |
| Is it *on* its published route? | position vs. trip | a real, listed vehicle that has left its route |

A vehicle more than 250 m off its published path is refused, even though it is
genuinely municipal and genuinely in the feed. **You cannot know who is inside a vehicle
without surveilling them. You can always know whether the vehicle is where the city says
it should be.**

Alongside this, Aura routes toward *supervision that already exists* and is static,
public and mappable — Delhi Metro's women-only coach at the front of every train,
staffed station gates, and the DTC routes carrying civilian bus marshals. No passenger
is ever counted.

### 5. Waiting is not free

A distance-weighted route score treats four minutes at a bus stop as costing nothing,
because standing still covers no ground. But waiting alone at an unlit stop is precisely
the exposure that matters, and a bus every 40 minutes from a dark corner is a completely
different proposition from one every 11 minutes from a lit, busy one.

So the transit itinerary is scored **time-weighted, not distance-weighted** — walk leg at
the walk leg's factors, the wait at the *stop's* factors, and the ride at full marks,
because she is inside a tracked vehicle. Headway is surfaced too: missing a 615 costs
eleven minutes, not forty, and that is part of the decision.

### 6. Zero surveillance, including from us
- No continuous location sharing exists anywhere in the product.
- **Ghost Ping** composes an SMS and hands it to the system composer. You press send.
  The app has no ability to transmit on its own, and it needs no internet.
- **Community reports** are anonymous, snapped to a street segment rather than a point,
  and delayed before they surface, so no sequence of tags can be used to follow anyone.
- **"Vibe is off"** points you to the nearest open help point without broadcasting
  anything to anyone.
- The demo rig shows a live count of outbound network requests. It stays at zero.

### 7. Three defences against poisoning, and one we deliberately refused

Crowdsourced tags invite an obvious attack: someone with bad intent marks a deserted
street as bustling and well-lit, to draw people to it. Aura layers three independent
defences, each of which works even if the others fail.

1. **Proximity fencing.** You can only report the segment you are standing on
   (`TAG_FENCE_M`, 60 m). There is no way to pan the map across the city and tag it,
   which is how one actor would otherwise repaint a whole district.
2. **Cross-verification.** A report is checked against the mapped infrastructure, in
   *both* directions. Claiming a park with zero mapped lamps is well lit, and claiming a
   lamp-lined arterial is pitch dark, are the same kind of false report.
3. **Corroboration.** A report that contradicts the map and has nobody independently
   backing it is held rather than published, and freshness decays over 90 minutes.

**What we refused:** silent per-account trust scores. It is the obvious fourth layer and
it is incompatible with the rest of the product — *a durable reputation score is a
durable identifier.* You cannot promise anonymous reporting and simultaneously maintain
a persistent per-user history of where that user has been. Fencing plus corroboration
delivers the same defence without building the identifier, so that is what is here.

### 8. Her word about her own journey is always enough

There is a real tension between "never repaint a street on one uncorroborated report"
and "believe her when she is standing there." Aura resolves it by separating the two
scopes:

> **One person's report is always enough to change their own route, and never enough to
> change everybody else's.**

Mid-journey, Aura asks one low-friction question at the point where its own prediction is
most load-bearing — *"Aura expected this stretch to be 61% active. Is it?"* If she says
no, her route re-solves from the next junction immediately, and her report enters the
shared picture only once other people independently agree.

**It asks once, it never nags, and ignoring it has no consequences.** There is no
automatic SOS for an unanswered check-in. A phone goes in a bag, a battery dies, a friend
turns up — an app that alerts your family every time you don't look at your screen is a
liability, not a companion.

And when there is no better route, Aura says so. From inside a corridor there often
isn't one, and the app will tell her *"this is already the shortest way out"* plus the
nearest lit street and open help point, rather than inventing an alternative to look
responsive.

---

## Round 2: how Shadow Mode is actually triggered

Not a static percentage. Aura samples the battery level, fits the slope, and projects
it forward to the arrival time of the route you are on:

```
rate      = linear regression over the last 12 battery samples   (% per minute)
arriveAt  = level − rate × etaMinutes
trigger   = arriveAt < 8%   OR   level ≤ 15%
```

The 8% reserve is the charge needed to still make a phone call on arrival. The
`level ≤ 15%` floor exists because a measured slope is noisy — a phone can sit at 40%
for ten minutes and then drop three points at once — and a projection alone would fire
at strange moments.

The arithmetic is printed on screen rather than hidden, so the suggestion is arguable
rather than mysterious.

When accepted, Shadow Mode:

- unloads all map rendering (the GPU is the expensive part, not the pixels)
- goes to true black and dims the screen
- drops GPS polling from continuous to every 45 s
- draws a single white bearing arrow, the metres remaining, and the next street name
  from the already-cached route
- keeps the nearest open help point one line away

**Pocket mode** goes one step further, because the cheapest screen is no screen. The
phone goes in her pocket and buzzes at junctions — one buzz for left, two for right — so
she is not lighting up a display and staring down at it in the dark. A tap wakes it.

*Honest caveat:* `navigator.vibrate` works on Android browsers and is not supported on
iOS Safari. On iOS this degrades to the wake-on-tap screen rather than silently doing
nothing, and a native build would use Core Haptics instead.

**An honest note on true black:** #000000 saves real power on an OLED panel and none at
all on an LCD. The large win is the brightness drop and unloading the map; the black
screen is also simply the right visual for the moment. We would rather state the
mechanism correctly than overclaim it.

---

## Data honesty

This runs entirely offline from a cached, hand-verified slice of Delhi between **Hauz
Khas Village** and **Green Park Metro**. What is real and what is not:

| Layer | Status in this build |
|---|---|
| Street geometry, lamp counts, sidewalks, road class | Modelled on OpenStreetMap tags (`highway=street_lamp`, `lit=*`, `sidewalk=*`) for this slice, cached as a static graph |
| Venue opening hours at 23:00 | Hand-verified for this slice |
| Help points | **Hand-verified, deliberately not from a live API.** An opening-hours field that sends a frightened person to a locked gate at 1 a.m. is the worst failure this app could have |
| Municipal fleet | Real feed *shape* from Delhi's Open Transit Data GTFS-Realtime (route, fleet id, operator, headway); the vehicle positions in this build are a snapshot, not live |
| Route candidates | **Genuinely computed.** Weighted Dijkstra over the graph at request time |
| Battery, GPS position, clock | Simulated through the demo rig, so the app can be shown without walking to Green Park or draining a real phone |

Nothing in the UI claims to be live when it is cached.

### Why the verified fleet badge matters in Delhi
Delhi publishes GTFS-Realtime for DTC and DIMTS cluster buses. That makes "is this
vehicle municipal?" a *verifiable* question rather than a guess: a bus carrying an OTD
fleet id is in the city's own feed, an unmarked van is not. DTC and cluster buses are
also **free for women**, which means the vehicle you can verify is frequently both the
fastest option and the cheapest — and no navigation app currently tells her that.

Aura only shows the verified badge when you are actually on the fleet. A walking route
that happens to pass a bus stop does not get it.

---

## Running it

No build step, no dependencies, no API keys.

```bash
# any static server, e.g.
npx serve .
```

Or open `index.html` directly in a browser.

**To see the offline claim work:** load the deployed URL once, turn off your wi-fi,
and reload. The service worker serves the whole app from cache. The request counter in
the demo rig stays at zero either way.

## Files

| File | |
|---|---|
| `index.html` | Markup for the phone shell, Shadow Mode, and the demo rig |
| `styles.css` | Visual system, including the no-red-no-green palette rule |
| `data.js` | The cached Delhi slice: road graph, help points, fleet, reports |
| `engine.js` | Scoring model, weighted Dijkstra, intent parsing, tag verification, burn rate |
| `app.js` | Rendering, the SVG map, Shadow Mode, Ghost Ping |
| `sw.js` | Offline shell |

---

## What we would build next

- **Real candidate generation at city scale.** The scoring model is the defensible part
  and it already works; what it needs is a real street graph behind it and a small
  caching server, because the public Overpass endpoint cannot take per-user traffic and
  Places calls are billed per request.
- **Live GTFS-Realtime.** Parsing Delhi OTD's protobuf feed so the fleet id and ETA on
  the badge are the actual bus approaching, not a snapshot.
- **Lighting outage reporting.** The honest inversion of this product: the same segment
  scores, aggregated and handed to the municipality as a list of streets whose lamps are
  out. Community reports are the right input for that, and unlike route scoring it
  genuinely improves with scale.
- **Android-native Ghost Ping.** On Android a check-in can be sent from a notification
  action. On iOS there is no API to send an SMS programmatically at all, so the composer
  handoff is the honest ceiling there — and we would rather ship the real ceiling than
  demo something that cannot exist.
