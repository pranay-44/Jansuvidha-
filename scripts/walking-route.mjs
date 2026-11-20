import {facilities} from '../dist/data.js';
import {busDirections} from './bus-directions.mjs';

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
  const mode = body.mode ?? 'walk';
  if (mode === 'bus') return busDirections(points);
  if (!['walk','drive'].includes(mode)) return {status:400,message:'Choose walking, bus or driving directions.'};
  try {
    let response;
    if (key) response = await request('https://api.openrouteservice.org/v2/directions/'+(mode==='drive'?'driving-car':'foot-walking')+'/geojson', {
      method:'POST', headers:{Authorization:key, 'Content-Type':'application/json'},
      signal:AbortSignal.timeout(10000),
      body:JSON.stringify({coordinates:points,
        preference:'shortest', instructions:false}),
    });
    else {
      const start = Math.max(Date.now(),nextPublicRequest);
      const wait = start-Date.now();
      if (wait>2200) return {status:429,message:'Please wait a moment and update the route.'};
      nextPublicRequest = start+1100;
      if (wait>0) await new Promise(resolve=>setTimeout(resolve,wait));
      const costing = mode==='drive'?'auto':'pedestrian';
      const query = {locations:points.map(([lon,lat])=>({lon,lat,search_cutoff:200})),
        costing,costing_options:{[costing]:{shortest:true}},shape_format:'geojson',format:'osrm'};
      response = await request('https://valhalla1.openstreetmap.de/route?json='+encodeURIComponent(JSON.stringify(query)),
      {headers:{'User-Agent':'JanSuvidha-local-pilot/1.0','X-Client-Id':'JanSuvidha-local-pilot'},signal:AbortSignal.timeout(10000)});
    }
    const data = await response.json();
    if (['NoRoute','NoSegment'].includes(data.code) || [442,443,171].includes(data.error_code) || [2009, 2010].includes(data.error?.code)) return {status:422, message:'No mapped route connects these points in this mode. Try a nearby public street.'};
    if (response.status === 429) return {status:429, message:'Directions are busy. Try again later.'};
    const route = key ? data.features?.[0] : data.routes?.[0];
    const summary = key ? route?.properties?.summary : route;
    if (!response.ok || route?.geometry?.type !== 'LineString'
      || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2
      || !route.geometry.coordinates.every(p => Array.isArray(p) && validPoint({longitude:p[0],latitude:p[1]}))
      || !Number.isFinite(summary?.distance) || !Number.isFinite(summary?.duration)) {
      return {status:502, message:'Directions are unavailable. Try again later.'};
    }
    return {status:200, geometry:route.geometry, distanceMeters:summary.distance, durationSeconds:summary.duration};
  } catch {
    return {status:503, message:'Could not reach the directions service. Try again later.'};
  }
}
