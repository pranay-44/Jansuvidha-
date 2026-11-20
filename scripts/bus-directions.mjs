import {readFileSync} from 'node:fs';

const {stops, patterns} = JSON.parse(readFileSync(new URL('../public/data/bus/service-patterns.json',import.meta.url),'utf8'));
// Approximate access distances for the Thane-area search, in metres.
const distance = (a,b) => Math.hypot((a[0]-b[0])*105000,(a[1]-b[1])*111200);
const coordinates = id => stops[id].slice(1);
const lines = patterns.map(([service,headsign,ids])=>{
  const length = [0];
  for(let i=1;i<ids.length;i++) length.push(length[i-1]+distance(coordinates(ids[i-1]),coordinates(ids[i])));
  return {service,headsign,ids,length};
});

export function busDirections(points) {
  const [start,end] = points;
  const nearby = point => new Map(Object.entries(stops).map(([id,s])=>[id,distance(point,s.slice(1))]).filter(([,d])=>d<=800));
  const boarding = nearby(start), alighting = nearby(end);
  let best;
  const transfers = new Map();
  function consider(legs, score) {
    if(!best || score<best.score) best={legs,score};
  }
  for(const line of lines) {
    for(const [from,id] of line.ids.entries()) {
      if(!boarding.has(id)) continue;
      for(let to=from+1;to<line.ids.length;to++){
        const next=line.ids[to], leg={line,from,to};
        const score=4*boarding.get(id)+line.length[to]-line.length[from];
        if(alighting.has(next)) consider([leg],score+4*alighting.get(next));
        if(!transfers.has(next)||score<transfers.get(next).score) transfers.set(next,{leg,score});
      }
    }
  }
  for(const line of lines) {
    for(const [to,id] of line.ids.entries()) {
      if(!alighting.has(id)) continue;
      for(let from=0;from<to;from++){
        const prior=transfers.get(line.ids[from]);
        if(!prior || prior.leg.line===line) continue;
        consider([prior.leg,{line,from,to}],prior.score+2000+line.length[to]-line.length[from]+4*alighting.get(id));
      }
    }
  }
  if(!best) return {status:422,message:'No mapped bus connection with up to one change and stops within 800 m of both endpoints.'};
  const paths=[],instructions=[];
  for(const {line,from,to} of best.legs){
    const first=line.ids[from],last=line.ids[to];
    paths.push(line.ids.slice(from,to+1).map(coordinates));
    instructions.push(line.service+(line.headsign?' towards '+line.headsign:'')+' from '+stops[first][0]+' to '+stops[last][0]);
  }
  const access=Math.round(distance(start,paths[0][0])), exit=Math.round(distance(paths.at(-1).at(-1),end));
  return {status:200,geometry:{type:'MultiLineString',coordinates:[[start,paths[0][0]],...paths,[paths.at(-1).at(-1),end]]},
    description:instructions.join(' → Change to ') + '. Boarding stop ' + access + ' m from start; final stop ' + exit + ' m from destination (straight-line). Stop sequence only. Check service times.'};
}
