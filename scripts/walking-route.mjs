import {facilities} from '../dist/data.js';

const records = new Map(facilities.map(f => [f.id, f]));
let nextPublicRequest = 0;
const validPoint = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90
  && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;

export async function walkingRoute(body, key = process.env.ORS_API_KEY, request = fetch) {
  const origin = body?.origin;
  const facility = records.get(body?.facilityId);
  if (!validPoint(origin)) return {status:400, message:'Choose a valid starting point.'};
  if (!facility) return {status:404, message:'Facility not found.'};
  const destination = validPoint(facility.entrance) ? facility.entrance : facility;
  if (!validPoint(destination)) return {status:422, message:'This facility has no mapped location.'};
  const points = [origin, destination].map(p => [p.longitude, p.latitude]);
  try {
    let response;
    if (key) response = await request('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
      method:'POST', headers:{Authorization:key, 'Content-Type':'application/json'},
      signal:AbortSignal.timeout(10000),
      body:JSON.stringify({coordinates:points,
        preference:'shortest', instructions:false}),
    });
    else {
      if (Date.now() < nextPublicRequest) return {status:429,message:'Please wait a moment and update the route.'};
      nextPublicRequest = Date.now() + 1100;
      const path = points.map(pair => pair.join(',')).join(';');
      response = await request('https://routing.openstreetmap.de/routed-foot/route/v1/foot/' + path
        + '?overview=full&geometries=geojson&steps=false&radiuses=200;200',
      {headers:{'User-Agent':'JanSuvidha-local-pilot/1.0'},signal:AbortSignal.timeout(10000)});
    }
    const data = await response.json();
    if (['NoRoute','NoSegment'].includes(data.code) || [2009, 2010].includes(data.error?.code)) return {status:422, message:'No mapped walking route connects these points. Try a nearby public street.'};
    if (response.status === 429) return {status:429, message:'Walking directions are busy. Try again later.'};
    const route = key ? data.features?.[0] : data.routes?.[0];
    const summary = key ? route?.properties?.summary : route;
    if (!response.ok || route?.geometry?.type !== 'LineString'
      || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2
      || !route.geometry.coordinates.every(p => Array.isArray(p) && validPoint({longitude:p[0],latitude:p[1]}))
      || !Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration)) {
      return {status:502, message:'Walking directions are unavailable. Try again later.'};
    }
    return {status:200, geometry:route.geometry, distanceMeters:summary.distance, durationSeconds:summary.duration};
  } catch {
    return {status:503, message:'Could not reach the walking directions service. Try again later.'};
  }
}
