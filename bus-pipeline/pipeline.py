"""OSM bus-stop import. Python 3.10+, standard library only; see README.md."""
import argparse
import csv
import hashlib
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    temporary.replace(path)


def query(name, q, cfg, cache, refresh=False, offline=False):
    """Cache only complete JSON responses, keyed by the exact query, not just bbox."""
    digest = hashlib.sha256(q.encode()).hexdigest()[:16]
    target = cache / f'{name}-{digest}.json'
    if target.exists() and not refresh:
        value = json.loads(target.read_text(encoding='utf8'))
        if not value.get('remark') and isinstance(value.get('elements'), list):
            print(f'Cache: {target.name}', flush=True)
            return value
    if offline:
        raise RuntimeError(f'Missing complete cache: {target}; run once online')
    errors = []
    for attempt in range(cfg['retries']):
        endpoint = cfg['endpoints'][attempt % len(cfg['endpoints'])]
        try:
            req = urllib.request.Request(endpoint, data=urllib.parse.urlencode({'data': q}).encode(),
                headers={'User-Agent': 'JanSuvidhaResearch/1.0 (OSM civic research)', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=cfg['request_timeout_seconds']) as response:
                value = json.load(response)
            if value.get('remark') or not isinstance(value.get('elements'), list):
                raise RuntimeError(value.get('remark', 'Invalid Overpass response'))
            write_json(target, value)
            write_json(target.with_suffix('.meta.json'), {'query': q, 'endpoint': endpoint,
                'downloaded_at': datetime.now(timezone.utc).isoformat(), 'sha256': hashlib.sha256(q.encode()).hexdigest()})
            return value
        except (OSError, ValueError, RuntimeError) as exc:
            errors.append(str(exc))
            print(f'{name}: attempt {attempt + 1} failed: {exc}', file=sys.stderr, flush=True)
            if attempt + 1 < cfg['retries']:
                time.sleep(min(2 ** (attempt + 1), 15))
    raise RuntimeError(f'{name}: no complete response; existing outputs retained. ' + '; '.join(errors))


def make_queries(cfg):
    bbox = ','.join(map(str, cfg['bbox']))
    s, w, n, e = cfg['bbox']
    margin = max(.002, max(cfg['road_snap_distance_m'], cfg['highway_distance_m']) / 100000 + .001)
    buffered = ','.join(f'{v:.8f}'.rstrip('0').rstrip('.') for v in (s-margin,w-margin,n+margin,e+margin))
    classes = '|'.join(re.escape(v) for v in cfg['road_classes'])
    return {
        'discovery': f'[out:json][timeout:90];relation[route=bus]({bbox});out tags;',
        'stops_routes': f'[out:json][timeout:180];relation[route=bus]({bbox})->.r;.r out body;node(r.r);out body;(node[highway=bus_stop]({bbox});node[public_transport=platform][bus=yes]({bbox});node[public_transport=stop_position][bus=yes]({bbox}););out body;',
        'roads': f'[out:json][timeout:180];way[highway~"^({classes})$"]({buffered});out geom;'
    }


def projection(cfg):
    # Local equirectangular metres; appropriate for city-scale distance thresholds.
    s, w, n, e = cfg['bbox']
    origin_lat, origin_lon = (s+n)/2, (w+e)/2
    xscale = 6371008.8 * math.cos(math.radians(origin_lat)) * math.pi / 180
    yscale = 6371008.8 * math.pi / 180
    return lambda lon, lat: ((lon-origin_lon)*xscale, (lat-origin_lat)*yscale)


def segment_distance(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    length = math.hypot(dx, dy)
    if not length:
        return math.inf, 0, 0
    t = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / length**2))
    distance = math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dy)
    # Positive cross product is LEFT of the OSM way's drawn direction.
    offset = (dx*(p[1]-a[1])-dy*(p[0]-a[0])) / length
    bearing = math.degrees(math.atan2(dx, dy)) % 360
    return distance, offset, bearing


def angle_difference(a, b):
    return abs((a-b+180) % 360 - 180)


def road_context(node, roads, project, cfg):
    p = project(node['lon'], node['lat'])
    candidates = []
    for road in roads:
        x1,y1,x2,y2 = road['_bbox']
        limit = max(cfg['road_snap_distance_m'], cfg['highway_distance_m'])
        if not x1-limit <= p[0] <= x2+limit or not y1-limit <= p[1] <= y2+limit:
            continue
        points = road['_points']
        segments = [(segment_distance(p, a, b), i) for i, (a, b) in enumerate(zip(points, points[1:]))]
        if not segments:
            continue
        (distance, offset, bearing), index = min(segments)
        candidates.append((distance, road['id'], offset, bearing, index, road))
    candidates.sort(key=lambda item: (item[0], item[1]))
    highway = next((c for c in candidates if c[5].get('tags', {}).get('highway') in cfg['highway_classes']
                    and c[0] <= cfg['highway_distance_m']), None)
    result = dict(road='', road_ref='', road_way_id=None, road_distance_m=None, side='unknown',
                  bearing=None, heading='Direction not known yet', heading_source='unknown',
                  on_highway=highway is not None, highway_road='', highway_way_id=None, road_ambiguous=False)
    if highway:
        tags = highway[5].get('tags', {})
        result.update(highway_road=tags.get('name') or tags.get('ref') or '', highway_way_id=highway[1])
    if not candidates or candidates[0][0] > cfg['road_snap_distance_m']:
        return result
    # A stop-position's actual containing road is stronger than geometric proximity.
    containing = [c for c in candidates if node['id'] in c[5].get('nodes', [])]
    chosen = containing[0] if containing else candidates[0]
    distance, way_id, offset, bearing, index, road = chosen
    tags = road.get('tags', {})
    ambiguous = any(c[1] != way_id and abs(c[0]-distance) <= cfg['road_ambiguity_m'] for c in candidates) and not containing
    side = 'left' if offset >= cfg['minimum_side_offset_m'] else 'right' if offset <= -cfg['minimum_side_offset_m'] else 'unknown'
    oneway = tags.get('oneway', '').lower()
    direction = 1 if oneway in ('yes', '1', 'true') else -1 if oneway in ('-1', 'reverse') else 0
    if not oneway and (tags.get('junction') == 'roundabout' or tags.get('highway') == 'motorway'):
        direction = 1
    result.update(road=tags.get('name') or tags.get('ref') or '', road_ref=tags.get('ref', ''),
                  road_way_id=way_id, road_distance_m=round(distance, 2), side=side, road_ambiguous=ambiguous)
    # India's left-hand traffic: left of drawn direction travels FORWARD.
    if not ambiguous and (direction or side != 'unknown'):
        reverse = direction == -1 or (not direction and side == 'right')
        bearing = (bearing + (180 if reverse else 0)) % 360
        compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][int((bearing+22.5)//45) % 8]
        result.update(bearing=round(bearing, 1), heading=f'towards {compass}',
                      heading_source='oneway_geometry' if direction else 'left_hand_traffic_estimate')
    return result


def compatible_names(a, b):
    normal = lambda value: ' '.join(value.casefold().split())
    return not a['name'] or not b['name'] or normal(a['name']) == normal(b['name'])


def distance(a, b):
    return math.dist(a['_point'], b['_point'])


def duplicate_reason(a, b, cfg):
    if distance(a, b) > cfg['merge_distance_m']:
        return 'outside merge distance'
    if not compatible_names(a, b):
        return 'different names'
    if a['road_way_id'] is None or a['road_way_id'] != b['road_way_id']:
        return 'different or unknown road way'
    if a['road_ambiguous'] or b['road_ambiguous']:
        return 'ambiguous road'
    if a['side'] == 'unknown' or b['side'] == 'unknown':
        return 'side unknown'
    if a['side'] != b['side']:
        return 'opposite road sides'
    if a['bearing'] is None or b['bearing'] is None or angle_difference(a['bearing'], b['bearing']) > cfg['heading_tolerance_degrees']:
        return 'different or unknown travel headings'
    return None


def merge_stops(stops, cfg):
    groups, merged = [], []
    positions = []
    for stop in sorted(stops, key=lambda s: s['osm_node_id']):
        if stop['_position']:
            positions.append(stop)
            continue
        # Complete-link rule: no chain of unnamed nodes may bridge two named stops.
        group = next((g for g in groups if all(duplicate_reason(stop, m, cfg) is None for m in g)), None)
        if group is None:
            groups.append([stop])
        else:
            merged.append({'from': stop['osm_node_id'], 'into': group[0]['osm_node_id'],
                           'reason': 'same way, side, compatible name and heading', 'distance_m': round(distance(stop, group[0]), 2)})
            group.append(stop)
    for stop in positions:
        candidates = []
        for group in groups:
            if all(m['_position'] for m in group):
                continue
            anchor = group[0]
            shared = set(stop['_relations']) & set().union(*(set(m['_relations']) for m in group))
            if (shared and all(compatible_names(stop, member) for member in group) and stop['road_way_id'] is not None
                and stop['road_way_id'] == anchor['road_way_id'] and not stop['road_ambiguous'] and not anchor['road_ambiguous']
                and distance(stop, anchor) <= cfg['stop_position_attach_m']
                and (stop['bearing'] is None or anchor['bearing'] is None or angle_difference(stop['bearing'], anchor['bearing']) <= cfg['heading_tolerance_degrees'])):
                candidates.append(group)
        # A bidirectional relation can contain both sides: never pick a side by distance alone.
        if len(candidates) == 1:
            group = candidates[0]
            merged.append({'from': stop['osm_node_id'], 'into': group[0]['osm_node_id'],
                           'reason': 'stop-position with unique same-way platform sharing a route relation',
                           'distance_m': round(distance(stop, group[0]), 2)})
            group.append(stop)
        else:
            groups.append([stop])
    return groups, merged


def build(raw, road_data, cfg):
    project = projection(cfg)
    s, w, n, e = cfg['bbox']
    elements = {(v['type'], v['id']): v for v in raw['elements']}
    relations = [v for v in elements.values() if v['type'] == 'relation' and v.get('tags', {}).get('route') == 'bus']
    tmt = lambda tags: any(re.search(cfg['tmt_pattern'], tags.get(k, ''), re.I) for k in ('network', 'operator'))
    selected = [r for r in relations if cfg['include_other_operators'] or tmt(r.get('tags', {}))]
    memberships, route_details, stop_roles = defaultdict(set), {}, set()
    for relation in selected:
        tags = relation.get('tags', {})
        route_details[relation['id']] = dict(relation_id=relation['id'], ref=tags.get('ref', ''), name=tags.get('name', ''),
            operator=tags.get('operator') or tags.get('network') or 'Operator not recorded', network=tags.get('network', ''),
            origin=tags.get('from', ''), destination=tags.get('to', ''), is_tmt=tmt(tags))
        for member in relation.get('members', []):
            if member['type'] != 'node':
                continue
            role = member.get('role', '')
            node = elements.get(('node', member['ref']), {})
            tags_n = node.get('tags', {})
            is_stop = role.startswith(('stop', 'platform')) or tags_n.get('highway') == 'bus_stop' or tags_n.get('public_transport') in ('platform', 'stop_position')
            if is_stop:
                memberships[member['ref']].add(relation['id'])
                stop_roles.add(member['ref'])
    roads = []
    for road in road_data['elements']:
        if road['type'] == 'way' and road.get('tags', {}).get('highway') in cfg['road_classes']:
            road = dict(road)
            road['_points'] = [project(p['lon'], p['lat']) for p in road.get('geometry', []) if p]
            if len(road['_points']) >= 2:
                xs, ys = zip(*road['_points'])
                road['_bbox'] = (min(xs),min(ys),max(xs),max(ys))
                roads.append(road)
    stops = []
    for (kind, id_), node in elements.items():
        if kind != 'node' or not s <= node['lat'] <= n or not w <= node['lon'] <= e:
            continue
        tags = node.get('tags', {})
        if not (tags.get('highway') == 'bus_stop' or (tags.get('public_transport') in ('platform', 'stop_position') and tags.get('bus') == 'yes') or id_ in stop_roles):
            continue
        stop = dict(osm_node_id=id_, name=tags.get('name') or tags.get('name:en') or '', longitude=node['lon'], latitude=node['lat'],
            _point=project(node['lon'], node['lat']), _relations=sorted(memberships[id_]), _position=tags.get('public_transport') == 'stop_position',
            _address=', '.join(dict.fromkeys(tags[k] for k in ('addr:housenumber', 'addr:street', 'addr:suburb', 'addr:city', 'addr:postcode') if tags.get(k))))
        stop.update(road_context(node, roads, project, cfg))
        stops.append(stop)
    groups, merged = merge_stops(stops, cfg)
    features, representatives = [], []
    for group in groups:
        anchor = group[0]
        props = {k: v for k, v in anchor.items() if not k.startswith('_') and k not in ('latitude', 'longitude')}
        ids = sorted(m['osm_node_id'] for m in group)
        details = [route_details[id_] for id_ in sorted(set().union(*(set(m['_relations']) for m in group)))]
        refs = sorted({d['ref'] or d['name'] for d in details if d['ref'] or d['name']})
        address = next((m['_address'] for m in group if m['_address']), '')
        props.update(id=f'OSM-BUS-{anchor["osm_node_id"]}', name=next((m['name'] for m in group if m['name']), ''),
            osm_node_ids=ids, routes=refs, routes_known=bool(refs), route_details=details,
            address=address or (f'Near {props["road"]}' if props['road'] else 'Address not recorded in OpenStreetMap'),
            address_source='osm_address_tags' if address else 'nearest_road_estimate' if props['road'] else 'unknown',
            source='OpenStreetMap', source_url=f'https://www.openstreetmap.org/node/{anchor["osm_node_id"]}',
            routes_message=', '.join(refs) if refs else 'Bus routes not known yet')
        features.append(dict(type='Feature', geometry=dict(type='Point', coordinates=[anchor['longitude'], anchor['latitude']]), properties=props))
        representatives.append(anchor)
    kept = []
    for i, a in enumerate(representatives):
        for j in range(i+1, len(representatives)):
            b = representatives[j]
            if distance(a, b) <= cfg['review_distance_m']:
                reason = duplicate_reason(a, b, cfg) or 'unresolved stop-position association'
                kept.append(dict(first=features[i]['properties']['id'], second=features[j]['properties']['id'],
                    first_name=features[i]['properties']['name'], second_name=features[j]['properties']['name'],
                    distance_m=round(distance(a, b), 2), reason=reason, first_side=a['side'], second_side=b['side'],
                    first_way=a['road_way_id'], second_way=b['road_way_id']))
    summary = dict(total_stops=len(features), stops_on_highways=sum(f['properties']['on_highway'] for f in features),
        stops_without_routes=sum(not f['properties']['routes_known'] for f in features),
        stops_without_name=sum(not f['properties']['name'] for f in features), source_nodes=len(stops),
        merged_nodes=len(merged), nearby_pairs_kept_separate=len(kept),
        tmt_relations=sum(tmt(r.get('tags', {})) for r in relations), selected_relations=len(selected),
        unknown_headings=sum(f['properties']['bearing'] is None for f in features))
    return dict(type='FeatureCollection', features=features), dict(merged=merged, nearby_kept_separate=kept), summary


def export(collection, validation, summary, discovery, cfg, output):
    output.mkdir(parents=True, exist_ok=True)
    write_json(output/'thane_bus_stops.geojson', collection)
    write_json(output/'validation.json', validation)
    write_json(output/'summary.json', summary)
    for label, rows in [('merged_stops', validation['merged']), ('nearby_separate_stops', validation['nearby_kept_separate'])]:
        if rows:
            with (output/(label+'.csv')).open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)

    write_json(output/'route_tag_inventory.json', discovery)
    fields = ['id', 'name', 'latitude', 'longitude', 'address', 'address_source', 'road', 'road_ref', 'road_way_id', 'side', 'on_highway', 'highway_road', 'heading', 'heading_source', 'routes', 'routes_known', 'routes_message', 'osm_node_ids', 'source_url']
    with (output/'thane_bus_stops.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for feature in collection['features']:
            props = feature['properties']
            row = {key: props.get(key, '') for key in fields}
            row.update(longitude=feature['geometry']['coordinates'][0], latitude=feature['geometry']['coordinates'][1])
            for key in ('routes', 'osm_node_ids'):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            writer.writerow(row)
    template = (HERE/'demo-template.html').read_text(encoding='utf8')
    payload = json.dumps(collection, ensure_ascii=False).replace('<', '\\u003c')
    (output/'thane_bus_map.html').write_text(template.replace('__GEOJSON__', payload), encoding='utf8')
    write_json(output/'provenance.json', {'generated_at': datetime.now(timezone.utc).isoformat(), 'config': cfg,
        'license': 'OpenStreetMap contributors, ODbL 1.0', 'coverage': 'All eligible mapped OSM nodes in the configured bounding box; not a complete official city inventory.'})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path, default=HERE/'config.json')
    parser.add_argument('--output', type=Path, default=HERE.parent/'public/data/bus')
    parser.add_argument('--cache', type=Path, default=HERE/'cache')
    parser.add_argument('--refresh', action='store_true')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    if args.refresh and args.offline:
        parser.error('--refresh and --offline are mutually exclusive')
    cfg = json.loads(args.config.read_text(encoding='utf-8-sig'))
    s, w, n, e = cfg['bbox']
    if not (-90 <= s < n <= 90 and -180 <= w < e <= 180):
        parser.error('Invalid bbox; expected south, west, north, east')
    for key in ('merge_distance_m', 'stop_position_attach_m', 'road_snap_distance_m', 'minimum_side_offset_m', 'highway_distance_m', 'review_distance_m', 'road_ambiguity_m'):
        if cfg[key] < 0:
            parser.error(f'{key} must be nonnegative')
    if cfg['retries'] < 1 or not cfg['endpoints']:
        parser.error('At least one attempt and endpoint required')
    queries = make_queries(cfg)
    raw_discovery = query('discovery', queries['discovery'], cfg, args.cache, args.refresh, args.offline)
    tags = Counter((r.get('tags', {}).get('network', ''), r.get('tags', {}).get('operator', '')) for r in raw_discovery['elements'])
    inventory = {'tag_counts': [dict(network=n, operator=o, count=c) for (n,o),c in tags.items()], 'relations': raw_discovery['elements']}
    print('Observed route tags:', json.dumps(inventory['tag_counts'], ensure_ascii=True), flush=True)
    raw = query('stops_routes', queries['stops_routes'], cfg, args.cache, args.refresh, args.offline)
    roads = query('roads', queries['roads'], cfg, args.cache, args.refresh, args.offline)
    collection, validation, summary = build(raw, roads, cfg)
    if not collection['features']:
        raise RuntimeError('No stops found; refusing to replace the previous dataset')
    export(collection, validation, summary, inventory, cfg, args.output)
    print(json.dumps(summary, indent=2))

if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        sys.exit(1)
