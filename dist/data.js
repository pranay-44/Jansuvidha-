import records from './data/thane/facilities.js';
export const facilities = records;
export const wards = [...new Set(facilities.map(f => f.ward ?? 'Ward unknown'))];
// Coordinate overview only: the decorative background is not a street map.
const located = facilities.filter(f => f.latitude !== null && f.longitude !== null);
const latitudes = located.map(f => f.latitude), longitudes = located.map(f => f.longitude);
const position = (value, values) => 12 + 76 * (value - Math.min(...values)) / (Math.max(...values) - Math.min(...values) || 1);
for (const f of located) {
  f.x = position(f.longitude, longitudes);
  f.y = 100 - position(f.latitude, latitudes);
}
export const photoUrl = path => 'data/thane/' + path;
export const dimensions = ['Provision','Availability','Accessibility','Functionality','Usability','Safety','Cleanliness','Affordability','Satisfaction'];
export const statusLabels={usable:'Usable',partial:'Partly usable',unusable:'Not usable',unverified:'Unverified'};
export function score(values){const valid=values.filter(v=>Number.isFinite(v));return valid.length?Math.round(valid.reduce((a,b)=>a+b,0)/valid.length):null;}
export function filterFacilities({query='',type='All amenities',ward='All wards',usable=false,accessible=false}){return facilities.filter(f=>(type==='All amenities'||f.type===type)&&(ward==='All wards'||(f.ward??'Ward unknown')===ward)&&(!usable||f.status==='usable')&&(!accessible||f.accessible===true)&&`${f.name} ${f.ward??''} ${f.locality} ${f.facility_id}`.toLowerCase().includes(query.toLowerCase()));}
export const initialComplaints=[];
