Written for: the vibeathon judging panel — paste each block into one slide.

# Aura — pitch deck

15 slides. Speaker notes are the indented lines; they are what you say, not what goes
on the slide. Keep the slide text as short as it is here.

If you need to cut, drop slides 9 and 11 first. Never cut 3, 6, 8 or 12.

---

## Slide 1 — Title

# Aura

### Not just where to go — which journey fits the moment.
### The signal may disappear. Support shouldn't.

Delhi · Round 1 + Round 2

> Read the two taglines out loud and stop. Do not explain them yet.

---

## Slide 2 — The decision nobody helps you make

**Hauz Khas Village → Green Park Metro. 11:15 pm.**

- Through Deer Park — **17 min**
- Along Aurobindo Marg — **23 min**

Every navigation app shows you the 17.

> Anyone who has lived in Delhi has stood at this exact junction. You do not need to
> explain the problem — name the two streets and the room already knows.

---

## Slide 3 — What the 17 minutes actually contains

| | Deer Park | Aurobindo Marg |
|---|---|---|
| Time | 17 min | 23 min |
| Mapped street lamps | 15 | 69 |
| Places open at 23:00 | 3 | 19 |
| Walking with no lighting | **890 m** | **0 m** |

Aura does not say one of these is safe.
It says what each one **is**, and lets her choose.

> This table is the product. Everything else is delivery.

---

## Slide 4 — Round 1: say it in a sentence

> *"I'm walking home alone, it's late and my phone is dying."*

Aura reads: **travelling alone · late at night · on foot · battery low**
→ re-weights lighting, activity and transport
→ re-solves the street network
→ recommends the 23-minute road, and explains the six minutes

Change the sentence to *"in a hurry, I'll walk it"* → it recommends the park instead,
and states what she is trading. It does not hide the 890 m, and it does not refuse her
the route either.

> Demo this live if you can. The sentence going in and the map changing is the whole
> Round 1 argument in four seconds.

---

## Slide 5 — One number would be a lie

Aura never produces a safety score.

**Lit · Open now · Transport** — three independent factors, always visible, hers
to weight.

A single score hides its own assumptions, invites the false promise of safety, and
takes her judgement away from her.

*There is no red and no green anywhere in the interface. Those colours are a verdict.*

> The palette point lands harder than you expect. It shows the constraint was taken
> seriously at the level of pixels.

---

## Slide 6 — Fairness: only score what you can point at

Every factor is a **physical object you could walk to and photograph**:
a street lamp · a shop with its doors open · a bus stop · a sidewalk.

**No crime data. No incident reports. No area reputation. Ever.**

- Aura scores **segments of road**, never areas — so there is no red zone, because
  there is no zone
- Aura reports **absence**, never a negative label — "890 m unlit", never "bad area"
- Low lighting is a fact about **municipal infrastructure**, not about the people who
  live there

> Route-safety apps have a real history of steering users away from poorer
> neighbourhoods, because the inputs correlate with income. Infrastructure counts do
> not have that failure mode. Say this out loud — it is the clause most teams will
> have ignored.

---

## Slide 7 — The verified fleet, which only works in Delhi

Delhi publishes **GTFS-Realtime for DTC and DIMTS cluster buses.**

So "is this vehicle municipal?" becomes a **verifiable** question:

| In the city's own feed | Not in any feed |
|---|---|
| DTC 615 · fleet DL1PC-5512 | unmarked van, shared auto |
| Tracked, scheduled, **free for women** | no id, no schedule, no recourse |

**12 minutes. 3 of them on foot. Free.**
The vehicle she can verify is also the fastest and the cheapest — and no navigation
app tells her that.

> This is the feature nobody else in the room will have, because it needs local
> knowledge rather than a bigger model.

---

## Slide 8 — "Will there be other women on that bus?"

The honest answer to the question everyone actually asks.

**We will not count passengers.** It needs cameras, no transit feed on earth publishes
it, and *"the bus arriving in 2 minutes has one woman on board"* is a targeting tool,
not a safety feature.

But in Delhi's most notorious case the bus was **private, and off its route.**
That is a property of the **vehicle**, not its passengers — and GTFS-Realtime gives us
both halves:

| | Source | Catches |
|---|---|---|
| Is it in the feed? | fleet id | unmarked vehicle posing as transit |
| Is it **on its route**? | position vs. published trip | a real, listed bus that has left its route |

**Over 250 m off its published path → refused, even though it is genuinely municipal.**

> You cannot know who is inside a vehicle without surveilling them.
> You can always know whether the vehicle is where the city says it should be.

Plus supervision that already exists and needs no one watched: Metro's **women-only
coach**, staffed gates, **DTC bus marshals**.

---

## Slide 9 — Waiting is not free

A distance-weighted score says 4 minutes at a stop costs nothing — standing still
covers no ground.

But waiting alone at an unlit stop **is** the exposure. So Aura scores the itinerary
**time-weighted**: the walk at the walk's factors, **the wait at the stop's factors**,
the ride at full marks because she is inside a tracked vehicle.

**And headway is part of the decision.** Missing a 615 costs 11 minutes, not 40.

> This was the sharpest hole in our own first model — it treated the wait as free. Say
> that you found it and fixed it; judges trust teams that audit themselves.

---

## Slide 10 — Three defences against poisoning, and one we refused

The obvious attack: mark a deserted street as bustling, to draw people to it.

1. **Proximity fencing** — you can only report the 60 m you are standing in. No panning
   the map and painting a district.
2. **Cross-verification** — checked against mapped infrastructure, **in both
   directions**. "This dark park is bright" and "this lamp-lined road is pitch dark" are
   the same false report.
3. **Corroboration** — a report contradicting the map with nobody backing it is *held*,
   not published. Freshness decays over 90 minutes.

**What we refused: silent per-account trust scores.**
*A durable reputation score is a durable identifier.* You cannot promise anonymous
reporting and keep a permanent per-user history of where that user has been. Fencing
plus corroboration gives the same defence without building the identifier.

> Bring up the attack yourself before a judge does. Then the refused fourth layer shows
> you understood the privacy cost of the obvious answer.

---

## Slide 11 — Her word about her own journey is always enough

Mid-journey, one question at the point where Aura's own prediction matters most:

> *"Aura expected this stretch to be 61% active. Is it?"*

**No** → her route re-solves from the next junction immediately.

> **One person's report is always enough to change their own route, and never enough to
> change everybody else's.**

That resolves the tension between refusing single reports and believing the woman who
is standing there.

**It asks once. It never nags. Ignoring it does nothing.**
No automatic SOS for an unanswered check-in — a phone goes in a bag, a battery dies, a
friend turns up. An app that alerts your family when you don't look at your screen is a
liability, not a companion.

**And when there is no better route, it says so** — "this is already the shortest way
out", plus the nearest lit street and open help point, instead of inventing an
alternative to look responsive.

---

## Slide 12 — Round 2: the trigger is arithmetic, not a percentage

```
rate     = regression slope of the last 12 battery samples   (%/min)
arriveAt = level − rate × minutesRemaining
trigger  = arriveAt < 8%   OR   level ≤ 15%
```

**"At this rate you arrive on 0%. You need 8% to make a call."**

8% is the reserve to still place a call. The 15% floor is there because a measured
slope is noisy — and the arithmetic is printed on screen, so the suggestion is
arguable instead of mysterious.

> Judges will ask why not just use 20%. The answer is on the slide: 20% is plenty for
> a 5-minute walk and far too late for a 40-minute one. This also answers "different
> phones drain at different rates" — we never assume a rate, we measure yours.

---

## Slide 13 — Shadow Mode

When it fires, Aura gives up almost everything:

- map rendering unloaded — **the GPU is the cost, not the pixels**
- true black, screen dimmed
- GPS from continuous → **every 45 s**
- what is left: one bearing arrow, metres remaining, next street, nearest open help point
- route was **cached before the signal went**

**Pocket mode** goes further, because the cheapest screen is no screen: the phone goes
in her pocket and buzzes at junctions — one buzz left, two right. A tap wakes it.

**Ghost Ping** — one slide of a finger writes an SMS with time, battery and
coordinates, and hands it to the system composer. **You** press send.
No internet. Nothing tracked.

> Honest detail worth saying: true black saves real power on OLED and none on LCD.
> The big win is the brightness drop and dropping the map. Judges notice when you
> refuse to overclaim.

---

## Slide 14 — Zero surveillance, including from us

- **No** continuous location sharing exists anywhere in the product
- **Ghost Ping** cannot transmit on its own — it has no send capability, only a composer
- **Community reports** are anonymous, snapped to a street segment rather than a point,
  and delayed before they appear — so no sequence of tags can be used to follow anyone
- **"Vibe is off"** routes her to the nearest open help point and broadcasts nothing
- **No per-account trust score**, because that score would itself be a tracking identifier

**Outbound network requests made by the app: 0.**
Counted live on screen. Turn off your wi-fi and reload — it still works.

> Then actually do it. Aeroplane mode, reload, keep talking. It is the best thirty
> seconds in the demo.

---

## Slide 15 — Why a transparent model and not an LLM

**You cannot audit a black box for fairness.**
Round 1 asks for fairness and clear choices. Both require the reasoning to be legible.

So the engine is ~400 lines you can read:
feature extraction → **weighted Dijkstra** → explanation from counted facts.
Change the weights and the graph genuinely re-solves. No route is pre-baked.

The intent parser is **one function, model-swappable** — drop in an LLM call returning
the same weight object and nothing else changes. We kept it local because an app whose
premise is *"the internet is gone"* should not need a server to read a sentence, and
because a model that improvises facts about a street at 1 a.m. is a hazard, not a feature.

**Next:** live GTFS-RT · city-scale graph with a caching layer ·
lighting-outage reports handed back to the municipality.

> If a judge asks "where is the AI?", this slide is the answer and it is a stronger
> answer than an API key would have been. The model is doing the routing; the
> constraint made it legible.
