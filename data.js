/* ============================================================
   AURA — Delhi data slice (Hauz Khas Village → Green Park Metro)
   ------------------------------------------------------------
   PROVENANCE
   Every attribute below describes a PHYSICAL, VERIFIABLE object:
   street lamps, sidewalks, bus stops, shops open at this hour.

   We deliberately store NO crime data, NO incident reports and NO
   area reputation of any kind. Aura scores *segments of road* by
   the infrastructure present on them. It never scores a locality
   and never scores the people in one.

   Source model (see README):
     - lamp counts / sidewalk / road class -> OpenStreetMap tags
       (highway=street_lamp nodes, lit=*, sidewalk=*, highway=*)
     - openNow                             -> Places opening_hours
     - transit                             -> Delhi OTD GTFS + GTFS-RT
   Values in this file are a cached, hand-verified snapshot of that
   slice so the app runs with zero network calls. See README
   "Data honesty" for exactly what is live vs. cached vs. simulated.
   ============================================================ */

/* ---------- Graph nodes (real Delhi locations, approx. coords) ---------- */
const NODES = {
  hkv:       { name: 'Hauz Khas Village',            lat: 28.5540, lng: 77.1945 },
  hkv_gate:  { name: 'HKV Main Gate',                lat: 28.5536, lng: 77.1968 },
  sda_lane:  { name: 'SDA Back Lane',                lat: 28.5558, lng: 77.1962 },
  sda_mkt:   { name: 'SDA Market',                   lat: 28.5578, lng: 77.1980 },
  deer_s:    { name: 'Deer Park — South Gate',       lat: 28.5528, lng: 77.1988 },
  deer_mid:  { name: 'Deer Park — Central Path',     lat: 28.5552, lng: 77.2005 },
  deer_n:    { name: 'Deer Park — North Gate',       lat: 28.5575, lng: 77.2018 },
  aur_s:     { name: 'Aurobindo Marg Crossing',      lat: 28.5525, lng: 77.2045 },
  aur_m:     { name: 'Aurobindo Marg — Uphaar',      lat: 28.5558, lng: 77.2058 },
  gp_mkt:    { name: 'Green Park Market',            lat: 28.5598, lng: 77.2032 },
  gp_metro:  { name: 'Green Park Metro Station',     lat: 28.5586, lng: 77.2065 },
};

/* ---------- Graph edges ----------
   lamps     : count of mapped working street lamps on the segment
   lengthM   : segment length in metres
   openNow   : venues with doors open at 23:00 (cached opening_hours)
   footfall  : modelled pedestrian activity index 0-1 for this hour
   transit   : 1 if a served bus stop sits on the segment
   sidewalk  : dedicated pedestrian path present
   cls       : OSM highway class
   busRoutes : Delhi municipal fleet routes serving the segment
*/
const EDGES = [
  { a: 'hkv',      b: 'hkv_gate', lengthM: 260, lamps: 9,  openNow: 4, footfall: 0.60, transit: 0, sidewalk: true,  cls: 'residential', busRoutes: [] },
  { a: 'hkv',      b: 'sda_lane', lengthM: 280, lamps: 3,  openNow: 0, footfall: 0.20, transit: 0, sidewalk: false, cls: 'residential', busRoutes: [] },
  { a: 'hkv',      b: 'deer_s',   lengthM: 300, lamps: 1,  openNow: 0, footfall: 0.10, transit: 0, sidewalk: false, cls: 'path',        busRoutes: [] },
  { a: 'deer_s',   b: 'deer_mid', lengthM: 260, lamps: 0,  openNow: 0, footfall: 0.05, transit: 0, sidewalk: false, cls: 'path',        busRoutes: [] },
  { a: 'deer_mid', b: 'deer_n',   lengthM: 240, lamps: 0,  openNow: 0, footfall: 0.05, transit: 0, sidewalk: false, cls: 'path',        busRoutes: [] },
  /* the cut-through everyone actually takes: shortest on the map, unlit end to end */
  { a: 'deer_mid', b: 'gp_mkt',   lengthM: 330, lamps: 0,  openNow: 0, footfall: 0.08, transit: 0, sidewalk: false, cls: 'path',        busRoutes: [] },
  { a: 'deer_n',   b: 'gp_mkt',   lengthM: 300, lamps: 6,  openNow: 2, footfall: 0.40, transit: 0, sidewalk: true,  cls: 'residential', busRoutes: [] },
  { a: 'deer_n',   b: 'sda_mkt',  lengthM: 420, lamps: 4,  openNow: 1, footfall: 0.30, transit: 0, sidewalk: false, cls: 'residential', busRoutes: [] },
  /* east exit onto the arterial — the way out of the park if the park turns out
     to be nothing like Aura predicted. Without an escape edge, a mid-journey
     reroute has nowhere to send her. */
  { a: 'deer_n',   b: 'aur_m',    lengthM: 420, lamps: 17, openNow: 3, footfall: 0.50, transit: 0, sidewalk: true,  cls: 'residential', busRoutes: [] },
  { a: 'sda_lane', b: 'sda_mkt',  lengthM: 300, lamps: 7,  openNow: 3, footfall: 0.50, transit: 0, sidewalk: true,  cls: 'residential', busRoutes: [] },
  { a: 'sda_mkt',  b: 'gp_mkt',   lengthM: 560, lamps: 12, openNow: 5, footfall: 0.60, transit: 0, sidewalk: true,  cls: 'residential', busRoutes: [] },
  { a: 'gp_mkt',   b: 'gp_metro', lengthM: 380, lamps: 14, openNow: 3, footfall: 0.70, transit: 1, sidewalk: true,  cls: 'secondary',   busRoutes: ['615'] },
  { a: 'hkv_gate', b: 'aur_s',    lengthM: 780, lamps: 26, openNow: 6, footfall: 0.80, transit: 1, sidewalk: true,  cls: 'trunk',       busRoutes: ['615', '522'] },
  { a: 'aur_s',    b: 'aur_m',    lengthM: 380, lamps: 18, openNow: 4, footfall: 0.85, transit: 1, sidewalk: true,  cls: 'trunk',       busRoutes: ['615', '522', '620'] },
  { a: 'aur_m',    b: 'gp_metro', lengthM: 330, lamps: 16, openNow: 5, footfall: 0.85, transit: 1, sidewalk: true,  cls: 'trunk',       busRoutes: ['615', '620'] },
];

/* ---------- Help points ----------
   Hand-verified for this slice. We do NOT resolve these from a live
   Places query: an API that sends someone to a locked gate at 1am is
   the worst failure this app could have. `verified` records how the
   opening hours were confirmed.
*/
const HELP_POINTS = [
  { id: 'aiims',    name: 'AIIMS Trauma Centre',      kind: 'Hospital — Emergency',  lat: 28.5670, lng: 77.2090, hours: '24×7',        verified: 'hand-checked' },
  { id: 'safdar',   name: 'Safdarjung Hospital',      kind: 'Hospital — Emergency',  lat: 28.5690, lng: 77.2065, hours: '24×7',        verified: 'hand-checked' },
  { id: 'gp_metro', name: 'Green Park Metro',         kind: 'Staffed metro station', lat: 28.5586, lng: 77.2065, hours: 'till 23:40',  verified: 'hand-checked' },
  { id: 'chemist',  name: 'Green Park 24h Chemist',   kind: 'Pharmacy',              lat: 28.5599, lng: 77.2036, hours: '24×7',        verified: 'hand-checked' },
  { id: 'fuel',     name: 'Fuel Station, Aurobindo',  kind: 'Fuel — staffed',        lat: 28.5561, lng: 77.2061, hours: '24×7',        verified: 'hand-checked' },
  { id: 'booth',    name: 'Hauz Khas Police Booth',   kind: 'Police booth',          lat: 28.5537, lng: 77.1972, hours: '24×7',        verified: 'hand-checked' },
];

/* ---------- Municipal fleet (Delhi OTD GTFS-RT shape) ----------
   Delhi publishes GTFS-Realtime for DTC and DIMTS cluster buses on the
   Open Transit Data portal. A vehicle carrying an OTD fleet id is a
   verified municipal vehicle; an unmarked van or shared auto is not.
   DTC and cluster buses are also free for women in Delhi.

   `deviationM` is the important field, and it is the one that needs no
   camera and no passenger data. GTFS-Realtime publishes both where a
   vehicle IS (VehiclePosition) and which trip it is SUPPOSED to be
   running (TripUpdate). Subtract one from the other and you can tell
   that a vehicle has left its published route — which is exactly the
   failure mode in Delhi's most notorious case: a private bus, off
   route, posing as public transit. You cannot know who is inside a
   vehicle without surveilling them. You CAN know whether the vehicle
   is where the city says it should be.

   Snapshot below mirrors the real feed's fields. See README.
*/
const FLEET = [
  { route: '615', fleetId: 'DL1PC-5512', operator: 'DTC',              etaMin: 4,  verified: true,  freeForWomen: true,  headwayMin: 11, deviationM: 0,    marshal: true,  onRoute: true  },
  { route: '522', fleetId: 'DL1PD-1180', operator: 'DIMTS Cluster',    etaMin: 9,  verified: true,  freeForWomen: true,  headwayMin: 14, deviationM: 12,   marshal: false, onRoute: true  },
  { route: '620', fleetId: 'DL1PC-9043', operator: 'DTC',              etaMin: 16, verified: true,  freeForWomen: true,  headwayMin: 18, deviationM: 0,    marshal: true,  onRoute: true  },
  { route: '—',   fleetId: null,         operator: 'Unmarked private', etaMin: 2,  verified: false, freeForWomen: false, headwayMin: null, deviationM: null, marshal: false, onRoute: null },
];

const DEVIATION_LIMIT_M = 250;   // beyond this, a vehicle is off its published route

/* ---------- Static supervision facts ----------
   Mappable, unchanging, and requiring nobody to be watched: Delhi Metro
   runs a women-only coach at the front of every train, and a subset of
   DTC routes carry civilian bus marshals. This is the honest version of
   "will there be other women on board" — you cannot count passengers
   without surveilling them, but you CAN route toward the places where
   the system has already made provision.
*/
const SUPERVISION = {
  gp_metro: [
    { label: 'Women-only coach', detail: 'front coach of every train, marked on the platform' },
    { label: 'Staffed till close', detail: 'CISF post at the gate until 23:40' },
  ],
  hkv_gate: [
    { label: 'Marshal on route 615', detail: 'civilian bus marshal, DTC night roster' },
  ],
};

/* ---------- Community vibe tags ----------
   Anonymous, coarsened to the segment (never a point), and delayed
   before they surface, so no tag can be used to follow anyone.
   `corroborations` = independent reports on the same segment/hour.
*/
const VIBE_TAGS = [
  { id: 't1', edge: 'hkv|hkv_gate', emoji: '☕️', label: 'Bustling',   corroborations: 6, agedMin: 25 },
  { id: 't2', edge: 'aur_s|aur_m',  emoji: '💡', label: 'Well-lit',   corroborations: 9, agedMin: 40 },
  { id: 't3', edge: 'deer_s|deer_mid', emoji: '💡', label: 'Well-lit', corroborations: 1, agedMin: 12 },
  { id: 't4', edge: 'gp_mkt|gp_metro', emoji: '🚌', label: 'Bus just came', corroborations: 4, agedMin: 6 },
];

const JOURNEY = { from: 'hkv', to: 'gp_metro' };

const BOUNDS = { minLat: 28.5505, maxLat: 28.5615, minLng: 77.1925, maxLng: 77.2085 };
