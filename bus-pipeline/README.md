## Current display: bus stops only

Suvidha and the standalone demo now show stop names, addresses and estimated directions. Bus-route lists, the route selector and unknown-route messages have been removed. All 1,173 stops remain. The ETL retains route relations internally for safe duplicate matching and future research; routes are not displayed to users.

This is an ETL pipeline: Extract from Overpass, Transform roads/stops and duplicates, Load generated files into Suvidha. It is not CI/CD. CI/CD could run the existing tests, build an APK or site, and deploy approved releases; it complements ETL rather than replacing it. Keep ETL for data updates and add CI/CD when automated software releases are needed.

# Thane bus stops: Python pipeline and Suvidha integration

This imports mapped OpenStreetMap bus-stop nodes into the existing Leaflet/Express JanSuvidha project. It does not use Google Maps, invent bus services, or require bus-stop photos. Python 3.10+ is sufficient; no pip packages are required.

## Run in VS Code / PowerShell

Open the existing JanSuvidha project folder. From its terminal:

```powershell
python bus-pipeline/pipeline.py
node import-bus.mjs
npm test
npm run bus:test
npm run android:sync
```

The first command uses existing complete cached responses by default. Use `--refresh` to download a fresh snapshot, or `--offline` to require the cache and forbid network calls:

```powershell
python bus-pipeline/pipeline.py --offline
python bus-pipeline/pipeline.py --refresh
python bus-pipeline/pipeline.py --config bus-pipeline/config.json --output public/data/bus
```

`npm run data:import`, normal app startup, and Android sync now regenerate both the original amenities and the bus module from their respective local source datasets. They do not contact Overpass. A running Express server should be restarted after an import so its in-memory facility catalogue is refreshed. An installed Android app needs a new APK build/install after sync.

For the standalone download bundle, extract the ZIP, open that folder, and run:

```powershell
python bus-pipeline/pipeline.py --offline --output public/data/bus
python bus-pipeline/test_pipeline.py
```

Open `public/data/bus/thane_bus_map.html` in a browser. It is a single HTML file with embedded stop data; Leaflet from unpkg and OSM map tiles require internet. The integrated app uses its bundled Leaflet library.

## Geographic scope and completeness

The default configurable box is **south 19.12, west 72.88, north 19.34, east 73.08**. It deliberately covers the wider Thane research area, including Ghodbunder Road, Eastern Express Highway, Kalwa and Diva, and also parts of neighbouring municipalities. **It is not the Thane administrative boundary.** Do not interpret its stop count as an official municipal total. Edit `bbox` in `config.json` to change the study area. Output coordinates remain the original OSM coordinates, not snapped road positions.

The pipeline retrieves all `highway=bus_stop` nodes, `public_transport=platform` nodes tagged `bus=yes`, bus stop-position nodes, and direct stop/platform node members of bus route relations. It retains stops without any route membership. Stops outside the box are excluded even when their route continues through it. Platforms mapped only as ways/polygons are not converted into invented stop points.

OpenStreetMap coverage may be incomplete or stale. Neither a missing route nor a missing stop proves absence of service. The dataset is a research baseline for official-data and field-survey reconciliation, not live travel advice or timetables.

## Route discovery and association

The pipeline first queries every `route=bus` relation intersecting the box and writes a complete `route_tag_inventory.json`. The live snapshot inspected for this update contains 75 TMT relations:

- 60 use network `Thane Municipal Transport` and operator `Thane Municipal Transport`.
- 15 use the same network and misspelled operator `Thane Muncipal Transport`.

The case-insensitive configurable `tmt_pattern` matches Thane or TMT in either network or operator; it does not depend on one exact network string. `include_other_operators: true` also retains mapped BEST and unattributed bus relations, because a stop can serve more than TMT. Set it to `false` for TMT-only route information. Stop discovery still retains all bus stops.

Routes are assigned only from direct stop/platform membership in a route relation, then unioned when representations of the same physical stop merge. A route passing near a stop is **not** evidence that it serves that stop. Routes mapped only as road geometry therefore leave gaps. `routes` contains unique route refs (or route names when refs are missing); `route_details` retains relation ID, operator, network, origin and destination, so identical route numbers from different operators remain distinguishable in research exports. A relation without a ref or name remains in route_details but does not make routes_known true by itself. This is not a guarantee of complete route coverage.

## Road side, heading and duplicate rules

Distances use a local equirectangular metre projection centred on the study box, suitable for these city-scale thresholds. The nearest segment of each candidate OSM road way is considered. A small bounding-box prefilter avoids testing distant segments. For stop-position nodes, actual membership in a road way takes priority over geometric proximity.

For a segment drawn from A to B, a positive cross product means the stop is on the left. With India's left-hand traffic, left-side stops are estimated to travel from A to B; right-side stops from B to A. Bearings are reported in eight compass directions. Explicit `oneway=yes/1/true` follows the way, `oneway=-1/reverse` reverses it; untagged roundabouts and motorways are treated as one-way. Reversible/conditional lanes are not inferred. Near-centreline and ambiguous-road cases have unknown headings unless reliable one-way geometry establishes direction.

Regular duplicate candidates merge only when all of these agree:

- The exact OSM road way ID, a known side, and compatible travel headings.
- The same normalised name, or a missing name.
- Distance no greater than the configured merge threshold.
- No ambiguous nearest-road match.

Each new member must be compatible with **every** member already in the group. This prevents chains of unnamed nodes from joining two differently named stops. Different ways remain separate, including two carriageways with the same road name; the conservative rule can retain duplicates at split-way boundaries.

A stop-position on the carriageway attaches only to a unique nearby, compatible, same-way platform group sharing an actual route relation. If both sides share that relation or multiple groups qualify, it remains separate. Distance alone never picks a side. No opposing-direction route list is copied merely because two stops face each other.

### Configurable thresholds

| Setting | Default |
| --- | ---: |
| `merge_distance_m` | 6 m |
| `stop_position_attach_m` | 15 m |
| `road_snap_distance_m` | 45 m |
| `minimum_side_offset_m` | 1.5 m |
| `road_ambiguity_m` | 1 m |
| `heading_tolerance_degrees` | 30 degrees |
| `highway_distance_m` | 30 m |
| `review_distance_m` | 40 m |

`road_classes` includes trunk, primary, secondary, tertiary and residential roads, plus motorway, link, service, unclassified and living-street ways. Service roads help avoid assigning every roadside stop to a main carriageway. The independent `on_highway` flag tests proximity to any class in `highway_classes` (default trunk/primary), even when a service road is the nearest road. `highway_road` and `highway_way_id` preserve that separate association.

### Known heading/address limitations

OSM way direction is a drawing direction, not automatically a traffic direction. Medians, service lanes, flyovers, tunnels, bus-only contraflow lanes, missing one-way tags, imprecise stop coordinates, junctions and steeply curved roads can defeat a purely geometric estimate. This implementation does not model elevation or conditional traffic restrictions. Headings are labelled **estimated** in the UI. Known route destinations remain in research exports and are not replaced by the geometric heading.

Addresses come from OSM address tags when present. Otherwise the card says `Near <road name/ref>` and marks it as a nearest-road estimate. If neither is available it says `Address not recorded in OpenStreetMap`. No street number or locality is fabricated. Unnamed nodes display as `Unnamed bus stop`; the exported raw name remains empty for research-quality counts.

## Outputs and review

Generated files live in `public/data/bus/`:

- `thane_bus_stops.geojson`: point geometry; required name, road, on_highway, heading, routes and routes_known properties, plus addresses, road IDs/sides, highway association, heading provenance, original OSM IDs and relation details.
- `thane_bus_stops.csv`: matching core fields; routes and OSM node IDs are JSON arrays inside quoted CSV cells. Unknown route rows include `Bus routes not known yet`.
- `thane_bus_map.html`: standalone Leaflet demo with popups, different highway/local colours, and stop names, addresses and directions.
- `validation.json`, `merged_stops.csv`, `nearby_separate_stops.csv`: every merge and every pair of resulting stops within 40 m retained separately, with reasons, IDs and distances. A merge is a reviewable inference, not proof from a field survey.
- `summary.json`: total stops, highway stops, unknown routes, unnamed stops, merged source nodes, close pairs and unknown headings.
- `route_tag_inventory.json`, `provenance.json`: observed tags, configuration and licensing.

Inspect a familiar road: search its name in Suvidha and compare opposite-side headings and the OSM source links. In the validation tables use IDs to locate each feature in the GeoJSON. Original node IDs are retained even after merging. Review ambiguous or median/service-road examples before treating estimated directions as survey findings.

The initial result contains 1,173 stops, 472 near highways, 680 without route information, 129 unnamed stops, 20 merged source nodes and 474 nearby pairs kept separate. There are 176 unknown headings. Counts can change when OSM or configuration changes.

## Caching and failure handling

Exact Overpass query text is hashed into each raw cache filename. Metadata records the query and endpoint; Overpass responses retain their source timestamps. Configuration changes affecting queries use new keys; merge/heading-only changes can reuse downloaded data. `--refresh` refreshes the same key; it is not automatic. Cache has no implicit expiry, so periodically refresh when needed.

Requests use bounded timeouts, retries with backoff and two configurable Overpass endpoints. HTTP, network, JSON errors and Overpass `remark`/partial responses are rejected. A missing offline cache is an error. A failed fetch does not replace the existing generated dataset, and an empty result is not silently installed. Successful cache writes use a temporary file then rename. Dataset output writes happen only after all downloads and processing finish; output files are not a transactional database.

## Validation performed

Run `python bus-pipeline/test_pipeline.py` for offline synthetic checks covering opposite directions, reversed drawn ways, reverse one-way roads, dual carriageways, conservative name handling, unique/ambiguous stop-position attachment, unknown routes, independent highway proximity, tolerant TMT matching, retry behaviour, cached runs and partial-response rejection.

The project's `npm test` also exercises bus import validation, stop-name search and category switching, empty search, route-free cards, escaping untrusted OSM labels, and photo-free bus-stop detail cards. Existing amenities and emergency contacts remain covered. Android sync verifies copied assets byte-for-byte. The in-app browser could not connect to the local preview server, so browser layout and real-device behaviour remain unverified.

## Attribution and source documentation

Data: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Preserve attribution when sharing derived datasets and maps.

Technical references: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL), [route relations](https://wiki.openstreetmap.org/wiki/Relation:route), [stop-position nodes](https://wiki.openstreetmap.org/wiki/Tag:public_transport%3Dstop_position).
